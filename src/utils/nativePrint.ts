import { Capacitor, registerPlugin } from "@capacitor/core";
import { blobToBase64, isNativeApp, shareOrSavePdf } from "./nativePdf";

export interface NativePrintPluginInterface {
  /**
   * Hand a base64-encoded PDF to the OS print framework.
   * Implemented natively on Android (PrintManager); other platforms reject.
   */
  print(options: { base64: string; jobName: string }): Promise<void>;
}

const NativePrint = registerPlugin<NativePrintPluginInterface>("NativePrint");

export type PrintDelivery = "printed" | "shared" | "downloaded";

/**
 * Open the OS print dialog for a generated PDF.
 *
 * - **Android (native)**: system print dialog via PrintManager — shows every
 *   installed print service (physical printers) plus the built-in
 *   "Save as PDF" destination.
 * - **iOS (native)**: no local print plugin — falls back to the share sheet,
 *   which natively includes a Print action.
 * - **Browser/PWA**: caller should use `window.print()` instead; this helper
 *   only runs on native platforms.
 */
export async function printPdf(
  blob: Blob,
  jobName: string,
): Promise<Exclude<PrintDelivery, "downloaded">> {
  if (!isNativeApp()) {
    throw new Error("printPdf is only available in the native app");
  }

  const base = jobName.toLowerCase().endsWith(".pdf")
    ? jobName.slice(0, -4)
    : jobName;

  if (Capacitor.getPlatform() === "android") {
    const base64 = await blobToBase64(blob);
    try {
      await NativePrint.print({ base64, jobName: base });
      return "printed";
    } catch {
      // The installed APK predates the NativePrint plugin (needs an app
      // rebuild to include it). Fall back to the share sheet, which the
      // Android print service also appears in — still functional.
      await shareOrSavePdf(blob, `${base}.pdf`);
      return "shared";
    }
  }

  // iOS / other native platforms: share sheet includes the Print service.
  await shareOrSavePdf(blob, `${base}.pdf`);
  return "shared";
}
