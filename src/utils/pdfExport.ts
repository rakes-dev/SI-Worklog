import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Render the dedicated A4 PDF layout (the container rendered by
 * `<PdfExportLayout />`, containing one or more `.pdf-page` sheets) into a
 * downloadable A4 portrait PDF.
 *
 * The source layout is `display:none` on screen (export-only), so we clone it,
 * place the clone off-viewport and make it visible so html2canvas can capture
 * it. Each `.pdf-page` is captured separately; if a page is taller than one A4
 * sheet it is split across consecutive PDF pages.
 */
export async function exportPrintLayoutToPdf(
  root: HTMLElement,
  fileName: string,
): Promise<void> {
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
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const mmPerPx = pageWidthMm / canvas.width;
      const sliceHeightPx = Math.floor(pageHeightMm / mmPerPx);
      let yOffsetPx = 0;

      while (yOffsetPx < canvas.height) {
        const h = Math.min(sliceHeightPx, canvas.height - yOffsetPx);

        // Ignore a tiny remaining sliver (subpixel rounding can make a page a
        // couple of pixels taller than a full A4 sheet). Skipping it prevents
        // an extra, essentially-blank page from being added.
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
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          pageWidthMm,
          h * mmPerPx,
        );
        firstPdfPage = false;

        yOffsetPx += h;
      }
    }

    pdf.save(
      fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`,
    );
  } finally {
    clone.remove();
  }
}
