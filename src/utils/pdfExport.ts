import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { shareOrSavePdf } from "./nativePdf";
import { printPdf } from "./nativePrint";

/**
 * Render the dedicated A4 PDF layout (the container rendered by
 * `<PdfExportLayout />`, containing one or more `.pdf-page` sheets) into an
 * A4 portrait PDF.
 *
 * Captures high-DPI lossless images of the layout to ensure razor-sharp text
 * and crisp table borders when printing from mobile devices or saving as PDF.
 */
export async function exportPrintLayoutToPdf(
  root: HTMLElement,
  fileName: string,
  mode: "deliver" | "print" = "deliver",
): Promise<"downloaded" | "shared" | "printed"> {
  const clone = root.cloneNode(true) as HTMLElement;
  // Show the clone, tucked behind the app UI.
  clone.style.cssText +=
    ";position:fixed;top:0;left:0;background:#ffffff;z-index:-1000;display:block;transform:none;";

  document.body.appendChild(clone);

  try {
    // Give the browser a couple of frames to lay out the clone before capturing.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    const pageEls = Array.from(
      clone.querySelectorAll<HTMLElement>(".pdf-page"),
    );
    const targets = pageEls.length > 0 ? pageEls : [clone];

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const pageWidthMm = 210;
    const pageHeightMm = 297;

    let firstPdfPage = true;

    for (const el of targets) {
      // Use scale: 3.5 for 300+ DPI razor-sharp print resolution
      const canvas = await html2canvas(el, {
        scale: 3.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const mmPerPx = pageWidthMm / canvas.width;
      const sliceHeightPx = Math.floor(pageHeightMm / mmPerPx);
      let yOffsetPx = 0;

      while (yOffsetPx < canvas.height) {
        const h = Math.min(sliceHeightPx, canvas.height - yOffsetPx);

        if (h * mmPerPx < 3) break;

        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = h;
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(
          canvas,
          0,
          yOffsetPx,
          canvas.width,
          h,
          0,
          0,
          slice.width,
          h,
        );

        if (!firstPdfPage) pdf.addPage();
        // Use lossless PNG to prevent JPEG compression blur on text and borders
        pdf.addImage(
          slice.toDataURL("image/png"),
          "PNG",
          0,
          0,
          pageWidthMm,
          h * mmPerPx,
          undefined,
          "FAST",
        );
        firstPdfPage = false;

        yOffsetPx += h;
      }
    }

    const blob = pdf.output("blob");
    if (mode === "print") {
      return printPdf(blob, fileName);
    }
    return shareOrSavePdf(blob, fileName);
  } finally {
    clone.remove();
  }
}
