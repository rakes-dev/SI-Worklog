import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativePrintPluginInterface {
  print(options: { base64: string; jobName: string }): Promise<void>;
  saveToDownloads(options: { base64: string; fileName: string }): Promise<{ path: string }>;
}

const NativePrint = registerPlugin<NativePrintPluginInterface>("NativePrint");

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
 * - **Browser**: triggers a normal file download.
 * - **Android (Native)**: saves PDF directly into Android's default Downloads folder (`MediaStore.Downloads`).
 * - **iOS / Fallback**: writes to Cache directory and opens the OS Share sheet.
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

  const base64 = await blobToBase64(blob);

  if (Capacitor.getPlatform() === "android") {
    try {
      // Use native MediaStore.Downloads API on Android to write directly to Android's default Downloads folder
      await NativePrint.saveToDownloads({ base64, fileName: name });
      return "downloaded";
    } catch (e) {
      console.warn("MediaStore saveToDownloads failed, falling back to Share sheet:", e);
    }
  }

  // Fallback for iOS or if MediaStore fails
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

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
