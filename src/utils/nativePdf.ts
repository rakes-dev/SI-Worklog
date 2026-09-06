import { Capacitor } from "@capacitor/core";

/**
 * True when the web app is running inside a native Capacitor shell (the
 * installed Android/iOS app) rather than a regular browser.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read PDF blob"));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      // Strip the "data:application/pdf;base64," prefix.
      const commaIndex = dataUrl.indexOf(",");
      resolve(commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Deliver a generated PDF to the user.
 *
 * - **Browser**: triggers a normal file download (unchanged behaviour).
 * - **Native app (installed APK/iOS)**: WebView downloads are not supported,
 *   so the file is written to the app's cache directory and handed to the
 *   OS share sheet instead. On Android the share sheet includes the system
 *   Print service, Gmail, Drive, "Save to Files", etc.
 *
 * Returns how the file was delivered so the caller can show the right toast.
 */
export async function shareOrSavePdf(
  blob: Blob,
  fileName: string,
): Promise<"downloaded" | "shared"> {
  const name = fileName.toLowerCase().endsWith(".pdf")
    ? fileName
    : `${fileName}.pdf`;

  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "downloaded";
  }

  // Native path — dynamic imports keep these plugins out of the web bundle.
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

  const base64 = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: name,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: name,
    url: result.uri,
    dialogTitle: "Print, save or share PDF",
  });
  return "shared";
}