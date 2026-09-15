package com.si_worklog.com;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Objects;

/**
 * Local Capacitor plugin: opens Android's system print dialog (PrintManager)
 * and saves PDFs directly to Android's default Downloads location via MediaStore.
 */
@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String base64Input = call.getString("base64");
        String jobName = call.getString("jobName", "Document");
        if (base64Input == null || base64Input.isEmpty()) {
            call.reject("Missing PDF data");
            return;
        }

        // Handle base64 strings containing data URI schemes (e.g. "data:application/pdf;base64,") or whitespace
        String cleanBase64 = base64Input;
        if (cleanBase64.contains(",")) {
            cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
        }
        cleanBase64 = cleanBase64.replaceAll("\\s+", "");

        final byte[] pdfBytes;
        try {
            pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid PDF data: " + e.getMessage());
            return;
        }

        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("No activity available");
            return;
        }

        final String name = (jobName != null && !jobName.trim().isEmpty()) ? jobName.trim() : "Document";

        activity.runOnUiThread(() -> {
            try {
                Context context = getContext();
                PrintManager printManager =
                        (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    call.reject("Print service unavailable");
                    return;
                }

                PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                        .build();

                printManager.print(name, new PdfPrintAdapter(context, pdfBytes, name), attributes);
                call.resolve();
            } catch (Exception e) {
                call.reject("Print failed: " + e.getMessage());
            }
        });
    }

    /**
     * Saves a PDF directly to Android's default Downloads location via MediaStore.Downloads.
     */
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String base64Input = call.getString("base64");
        String fileName = call.getString("fileName", "Document.pdf");
        if (base64Input == null || base64Input.isEmpty()) {
            call.reject("Missing PDF data");
            return;
        }

        String cleanBase64 = base64Input;
        if (cleanBase64.contains(",")) {
            cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
        }
        cleanBase64 = cleanBase64.replaceAll("\\s+", "");

        final byte[] pdfBytes;
        try {
            pdfBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid PDF data: " + e.getMessage());
            return;
        }

        String name = (fileName != null && !fileName.trim().isEmpty()) ? fileName.trim() : "Document.pdf";
        if (!name.toLowerCase().endsWith(".pdf")) {
            name += ".pdf";
        }

        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+): Use MediaStore.Downloads
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                ContentResolver resolver = context.getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Could not create MediaStore entry");
                    return;
                }

                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) {
                        call.reject("OutputStream is null");
                        return;
                    }
                    out.write(pdfBytes);
                    out.flush();
                }
            } else {
                // Android 9 and lower
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    downloadsDir.mkdirs();
                }
                File file = new File(downloadsDir, name);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }
            }

            JSObject ret = new JSObject();
            ret.put("path", Environment.DIRECTORY_DOWNLOADS + "/" + name);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save PDF to Downloads via MediaStore: " + e.getMessage());
        }
    }

    /**
     * Streams the already-rendered PDF bytes into Android's print framework.
     */
    private static class PdfPrintAdapter extends PrintDocumentAdapter {
        private final Context context;
        private final byte[] pdfBytes;
        private final String jobName;

        PdfPrintAdapter(Context context, byte[] pdfBytes, String jobName) {
            this.context = context;
            this.pdfBytes = pdfBytes;
            this.jobName = jobName;
        }

        private int getPdfPageCount(Context ctx, byte[] bytes) {
            File tempFile = null;
            try {
                tempFile = File.createTempFile("print_preview", ".pdf", ctx.getCacheDir());
                try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                    fos.write(bytes);
                }
                try (ParcelFileDescriptor pfd = ParcelFileDescriptor.open(tempFile, ParcelFileDescriptor.MODE_READ_ONLY);
                     PdfRenderer renderer = new PdfRenderer(pfd)) {
                    return renderer.getPageCount();
                }
            } catch (Exception ignored) {
            } finally {
                if (tempFile != null && tempFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tempFile.delete();
                }
            }
            return PrintDocumentInfo.PAGE_COUNT_UNKNOWN;
        }

        @Override
        public void onLayout(
                PrintAttributes oldAttributes,
                PrintAttributes newAttributes,
                CancellationSignal cancellationSignal,
                LayoutResultCallback callback,
                Bundle extras) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }

            int pageCount = getPdfPageCount(context, pdfBytes);
            String fileName = jobName.toLowerCase().endsWith(".pdf") ? jobName : jobName + ".pdf";

            PrintDocumentInfo info = new PrintDocumentInfo.Builder(fileName)
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(pageCount)
                    .build();

            boolean changed = !Objects.equals(newAttributes, oldAttributes);
            callback.onLayoutFinished(info, changed);
        }

        @Override
        public void onWrite(
                PageRange[] pages,
                ParcelFileDescriptor destination,
                CancellationSignal cancellationSignal,
                WriteResultCallback callback) {
            if (cancellationSignal.isCanceled()) {
                callback.onWriteCancelled();
                return;
            }

            try (OutputStream out = new FileOutputStream(destination.getFileDescriptor())) {
                out.write(pdfBytes);
                out.flush();

                if (cancellationSignal.isCanceled()) {
                    callback.onWriteCancelled();
                } else {
                    callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                }
            } catch (Exception e) {
                callback.onWriteFailed(e.getMessage());
            }
        }
    }
}
