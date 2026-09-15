import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PaintForm, Job } from "@/types";
import {
  formatDate,
  formatCurrency,
  calcAreaUnitLabel,
  aggregateAreaUnitLabel,
  linearUnitLabel,
  linearCellValue,
  linearUnitSuffix,
} from "@/utils/helpers";
import { shareOrSavePdf } from "./nativePdf";
import { printPdf } from "./nativePrint";

/**
 * Vector PDF generator for the paint/carpenter measurement sheet.
 *
 * Unlike raster image export (html2canvas -> raster image -> jsPDF), this builds
 * the PDF directly from `form`/`job` data using jsPDF + autoTable, so every
 * page is real text and vector line-art — identical crispness on screen,
 * in "Save as PDF", and on a physical printer via the Android app, at any
 * DPI. It also sidesteps the Android WebView's canvas-size ceiling that
 * caused pixelation in the html2canvas pipeline, since no canvas capture
 * happens at all.
 */

function isEmptySummaryRow(row: PaintForm["summaryRows"][number]): boolean {
  return (
    (!row.complaintSource.trim() ||
      row.complaintSource.trim() === "Engineer Dept.") &&
    !row.paintType.trim() &&
    !row.coat.trim() &&
    !row.arcNo.trim() &&
    (row.qty === "" || row.qty === 0) &&
    (row.rate === "" || row.rate === 0) &&
    row.amount === 0
  );
}

function isEmptyMeasurementRow(
  row: PaintForm["measurementRows"][number],
): boolean {
  return (
    !row.jobType?.trim() &&
    !row.location.trim() &&
    !row.coat.trim() &&
    (row.height === "" || row.height === 0) &&
    (row.length === "" || row.length === 0) &&
    (row.width === "" || row.width === 0) &&
    (row.no === "" || row.no === 0) &&
    row.totalArea === 0
  );
}

const SIG_LABELS = [
  { key: "standardInterior" as const, label: "Standard Interior" },
  { key: "requestedBy" as const, label: "Requested By" },
  { key: "qualityCheckHK" as const, label: "Quality check by HK" },
  { key: "qualityCheckEngg" as const, label: "Quality check by Engg" },
  { key: "measurementCheck" as const, label: "Measurement Check" },
];

const PAGE_W = 210; // A4 portrait, mm
const PAGE_H = 297;
const MARGIN = 10; // matches the 10mm padding used in PdfExportLayout/PrintLayout
const CONTENT_W = PAGE_W - MARGIN * 2;
const CURRENCY_PREFIX = "Rs. ";

function money(n: number): string {
  return `${CURRENCY_PREFIX}${formatCurrency(n)}`;
}

function drawSectionHeader(doc: jsPDF, label: string, y: number): number {
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.1);
  doc.rect(MARGIN, y, CONTENT_W, 6, "FD");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(label, MARGIN + 2, y + 4.2);
  doc.setFont("helvetica", "normal");
  return y + 9;
}

function drawSignatureRow(doc: jsPDF, y: number): void {
  const colW = CONTENT_W / SIG_LABELS.length;
  SIG_LABELS.forEach((s, i) => {
    const x = MARGIN + i * colW;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.rect(x, y, colW, 20);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(s.label, x + 2, y + 4, { maxWidth: colW - 4 });
    doc.setFont("helvetica", "normal");

    doc.setFontSize(9);
    doc.text("Sign:", x + 2, y + 13);
    doc.setLineDashPattern([0.6, 0.6], 0);
    doc.line(x + 2, y + 15, x + colW - 2, y + 15);
    doc.setLineDashPattern([], 0);
  });
}

export async function exportFormToPdf(
  form: PaintForm,
  job: Job,
  fileName: string,
  mode: "deliver" | "print" = "deliver",
): Promise<"downloaded" | "shared" | "printed"> {
  const isCarpenter = form.formType === "carpenter";

  const visibleSummaryRows = form.summaryRows.filter(
    (r) => !isEmptySummaryRow(r),
  );
  const visibleMeasurementRows = form.measurementRows
    .filter((r) => !isEmptyMeasurementRow(r))
    .map((row, index) => ({ ...row, slNo: index + 1 }));

  const areaUnit = aggregateAreaUnitLabel(
    visibleMeasurementRows.map((r) => r.uom),
  );
  const linUnit = linearUnitLabel(visibleMeasurementRows.map((r) => r.uom));
  const isMixedLinear = linUnit === "m/ft";
  const linHeader = (what: string) =>
    isMixedLinear ? what : `${what} (${linUnit})`;
  const linCell = (uom: string | undefined, value: number | "") =>
    value === ""
      ? ""
      : `${linearCellValue(uom, value)}${isMixedLinear ? ` ${linearUnitSuffix(uom)}` : ""}`;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  let cursorY = MARGIN;

  // ---- Title row ----
  doc.setFontSize(9);
  doc.text(`Measurement Sheet No.: ${form.sheetNo}`, MARGIN, cursorY + 3);
  doc.text(`Date: ${formatDate(form.date)}`, PAGE_W - MARGIN, cursorY + 3, {
    align: "right",
  });
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("STANDARD INTERIOR", PAGE_W / 2, cursorY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  cursorY += 9;

  // ---- Header info table ----
  autoTable(doc, {
    startY: cursorY,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
    },
    body: [
      [
        { content: "Suit / Public Area Name:", styles: { fontStyle: "bold" } },
        form.suitPublicAreaName || "—",
        { content: "Work Start Date:", styles: { fontStyle: "bold" } },
        formatDate(form.workStartDate),
      ],
      [
        { content: "Total Sheets:", styles: { fontStyle: "bold" } },
        String(form.totalSheets),
        { content: "Work End Date:", styles: { fontStyle: "bold" } },
        formatDate(form.workEndDate),
      ],
    ],
    columnStyles: {
      0: { cellWidth: CONTENT_W * 0.25 },
      1: { cellWidth: CONTENT_W * 0.25 },
      2: { cellWidth: CONTENT_W * 0.25 },
      3: { cellWidth: CONTENT_W * 0.25 },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 4;

  // ---- Section A: Summary ----
  if (visibleSummaryRows.length > 0) {
    cursorY = drawSectionHeader(doc, "A. SUMMARY", cursorY);

    const summaryHead = isCarpenter
      ? [
          [
            "Sl. No.",
            "Complaint Source",
            "Paint Type",
            "ARC No.",
            "Qty",
            "Rate (Rs.)",
            "Amount (Rs.)",
          ],
        ]
      : [
          [
            "Sl. No.",
            "Complaint Source",
            "Paint Type",
            "Coat",
            "ARC No.",
            "Qty",
            "Rate (Rs.)",
            "Amount (Rs.)",
          ],
        ];

    const summaryBody = visibleSummaryRows.map((row, i) => {
      const cells: string[] = [String(i + 1), row.complaintSource, row.paintType];
      if (!isCarpenter) cells.push(row.coat);
      cells.push(
        row.arcNo,
        typeof row.qty === "number" ? row.qty.toFixed(2) : "",
        typeof row.rate === "number" ? formatCurrency(row.rate) : "",
        row.amount > 0 ? formatCurrency(row.amount) : "",
      );
      return cells;
    });

    const amountColIdx = isCarpenter ? 6 : 7;
    const qtyColIdx = isCarpenter ? 4 : 5;
    const rateColIdx = isCarpenter ? 5 : 6;
    const coatOrArcColIdx = isCarpenter ? 3 : 4;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      head: summaryHead,
      body: summaryBody,
      foot: [
        [
          {
            content: "GRAND TOTAL",
            colSpan: amountColIdx,
            styles: { halign: "right", fontStyle: "bold" },
          },
          {
            content: money(form.grandTotal),
            styles: { halign: "right", fontStyle: "bold" },
          },
        ],
      ],
      styles: {
        fontSize: 8,
        cellPadding: 1,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        textColor: [0, 0, 0],
      },
      headStyles: { fillColor: [242, 242, 242], textColor: [0, 0, 0], fontStyle: "bold" },
      footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: "center", cellWidth: CONTENT_W * 0.06 },
        [coatOrArcColIdx]: { halign: "center" },
        [qtyColIdx]: { halign: "right" },
        [rateColIdx]: { halign: "right" },
        [amountColIdx]: { halign: "right" },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (doc as any).lastAutoTable.finalY + 4;
  }

  // ---- Section B: Measurement Sheet ----
  cursorY = drawSectionHeader(doc, "B. MEASUREMENT SHEET", cursorY);

  const measurementHead = [
    [
      "Sl. No.",
      "Job Type",
      "Location",
      isCarpenter ? linHeader("Height") : "Coat",
      linHeader("Length"),
      linHeader("Width"),
      "No.",
      `Total Area (${areaUnit})`,
    ],
  ];

  const measurementBody = visibleMeasurementRows.map((row) => [
    String(row.slNo),
    row.jobType ?? "",
    row.location,
    isCarpenter ? linCell(row.uom, row.height) : row.coat,
    linCell(row.uom, row.length),
    linCell(row.uom, row.width),
    typeof row.no === "number" ? String(row.no) : "",
    Number.isFinite(row.totalArea) && row.totalArea !== 0
      ? `${row.totalArea.toFixed(2)} ${calcAreaUnitLabel(row.uom)}`
      : "",
  ]);

  autoTable(doc, {
    startY: cursorY,
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 6 },
    theme: "grid",
    head: measurementHead,
    body: measurementBody,
    styles: {
      fontSize: 8,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
      overflow: "linebreak",
    },
    headStyles: { fillColor: [242, 242, 242], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: CONTENT_W * 0.06 },
      1: { cellWidth: CONTENT_W * 0.18 },
      2: { cellWidth: CONTENT_W * 0.3 },
      3: { halign: "center", cellWidth: CONTENT_W * 0.12 },
      4: { halign: "right", cellWidth: CONTENT_W * 0.1 },
      5: { halign: "right", cellWidth: CONTENT_W * 0.1 },
      6: { halign: "right", cellWidth: CONTENT_W * 0.04 },
      7: { halign: "right", cellWidth: CONTENT_W * 0.1 },
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("B. MEASUREMENT SHEET (cont'd)", MARGIN, MARGIN + 4);
        doc.setFont("helvetica", "normal");
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 8;

  // ---- Signature block ----
  const SIG_BLOCK_H = 20;
  if (cursorY + SIG_BLOCK_H > PAGE_H - MARGIN - 6) {
    doc.addPage();
    cursorY = MARGIN;
  }
  drawSignatureRow(doc, cursorY);

  // ---- "Page X of Y" footer on every page ----
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(85, 85, 85);
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 6, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }

  const blob = doc.output("blob");
  if (mode === "print") return printPdf(blob, fileName);
  return shareOrSavePdf(blob, fileName);
}
