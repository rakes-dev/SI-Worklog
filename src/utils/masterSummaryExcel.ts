// Builds the admin Master Summary Excel export as a real .xlsx workbook
// (Office Open XML). The package is assembled from plain XML parts and zipped
// with a tiny dependency-free ZIP writer, so no runtime library is required.
//
// Columns are derived dynamically from the arcs actually present in the data:
//   - duplicate arcs are removed (deduped by normalized ARC number),
//   - unknown arcs found in the data are added as extra columns,
//   - each column header uses that ARC's job type (paint type / description).
//
// Layout:
//   Row 1: blank
//   Row 2: STANDARD INTERIOR                          (merged, centered, bold)
//   Row 3: (ROOM AREA MAINTENANCE JOB) / <site name> (merged, centered, bold);
//           reads (ROOM / PUBLIC CARPENTRY AREA MAINTENANCE JOB) instead when
//           only carpentry forms are being exported
//   Row 4: ENGG. PNT-POLS JOB. (<range>)              (merged, centered, bold)
//   Row 5: column headers (SL | DATE | Room No | Description | one per ARC)
//   Row 6: ARC SL.NO. row (ARC ref under each column)
//   Then, per category (sorted by category name): a highlighted header row with
//   the category name, then ONE data row per measurement FORM — the SL column
//   holds that form's "Measurement Sheet No." and every summary line of the form
//   is summed into the ARC columns of that same single row — and a TOTAL line;
//   a GRAND TOTAL line across every category closes the sheet.

import type { FormType } from '@/types';

/** A single quantity line on a data row (whose column is keyed by ARC). */
export interface MasterExcelLine {
  arc: string; // ARC number, normalized on lookup
  qty: number;
  jobType: string; // job-type label shown in this ARC's column header
}

/**
 * One exported data row. There is exactly ONE row per measurement FORM: all of
 * that form's summary items are merged into its `lines`, so the whole form reads
 * as a single row whose SL cell carries its "Measurement Sheet No.".
 */
export interface MasterExcelRowData {
  date: string; // ISO yyyy-mm-dd, or '' when unknown
  /** 4-digit room number, taken from the form's "Suit / Public Area Name". */
  roomNo: string;
  description: string;
  siteName: string;
  key: string;
  /** Form's "Measurement Sheet No." — written in the SL column (0 = running index). */
  sheetNo: number;
  /**
   * Source form's `formType`. When EVERY exported row is a carpentry form the
   * row-3 heading switches to the "… PUBLIC CARPENTRY …" wording.
   */
  formType: FormType;
  lines: MasterExcelLine[];
}

/**
 * A group: a highlighted section header, its data rows, then a TOTAL line.
 * `category` is the group label when grouping by category name (preferred);
 * `siteName` is used as the label fallback.
 */
export interface MasterExcelSection {
  siteName: string;
  category: string;
  rows: MasterExcelRowData[];
}

/** Normalize an ARC reference: lowercase, drop punctuation, O->0. */
function normalizeArc(arcNo: string): string {
  return (arcNo || '')
    .trim()
    .toLowerCase()
    .replace(/o/g, '0')
    .replace(/[^a-z0-9]/g, '');
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** "2026-07-01" -> "1.07.26" (unpadded day, used in the header range). */
function fmtShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${parseInt(m[3], 10)}.${m[2]}.${m[1].slice(2)}` : '';
}

/** "2026-07-01" -> "01.07.26" (padded day, used in DATE cells). */
function fmtPadded(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : '';
}

/**
 * Extract the room number from a form's "Suit / Public Area Name".
 *
 * That field always holds a 4-digit room number, usually padded with spaces
 * (e.g. " 4028 "). Anything that is not a standalone 4-digit number is not a
 * real room number, so it is dropped and the Room No cell stays blank.
 */
export function extractRoomNumberFromArea(areaName: string): string {
  const input = (areaName || '').trim();
  if (!input) return '';
  const fourDigit = input.match(/(?:^|\D)(\d{4})(?:\D|$)/);
  return fourDigit ? fourDigit[1] : '';
}

// ---------------------------------------------------------------------------
// Cell styles — mapped onto OOXML fonts / fills / alignments at build time.
// Style names below are referenced by the row builder at the end of the file.
// ---------------------------------------------------------------------------
interface StyleSpec {
  bold?: boolean;
  size?: number;
  fill?: string; // RRGGBB (no leading '#')
  halign?: 'left' | 'center' | 'right';
  wrap?: boolean;
}

const STYLES: Record<string, StyleSpec> = {
  Default: {},
  title: { bold: true, size: 14, halign: 'center' },
  subtitle: { bold: true, halign: 'center' },
  colHeader: { bold: true, size: 9, halign: 'center', wrap: true, fill: 'FDE9D9' },
  arc: { size: 9, halign: 'center' },
  section: { bold: true, halign: 'center', fill: 'FFF2CC' },
  sectionText: { halign: 'left', fill: 'FFF2CC' },
  text: {},
  num: { halign: 'right' },
  total: { bold: true, halign: 'right', fill: 'FFF2CC' },
  grandTotal: { bold: true, halign: 'right', fill: 'FFD966' },
};

/** One grid cell: a value, a style name, and how many extra columns it spans. */
interface XlsxCell {
  value: string | number;
  style: string;
  mergeAcross?: number;
}

type XlsxRow = XlsxCell[];

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Column index -> spreadsheet letter (0 -> A, 25 -> Z, 26 -> AA). */
function colLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Build xl/styles.xml plus the style-name -> cellXfs index map. */
function buildStyles(): { xml: string; index: Map<string, number> } {
  const fonts: string[] = [];
  const fontIds = new Map<string, number>();
  const fills: string[] = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  const fillIds = new Map<string, number>([
    ['none', 0],
    ['gray125', 1],
  ]);
  const xfs: string[] = [];
  const index = new Map<string, number>();

  const fontId = (spec: StyleSpec) => {
    const size = spec.size ?? 11;
    const key = `${spec.bold ? 'b' : 'n'}${size}`;
    let id = fontIds.get(key);
    if (id === undefined) {
      id = fonts.length;
      fonts.push(
        `<font>${spec.bold ? '<b/>' : ''}<sz val="${size}"/>` +
          `<name val="Calibri"/></font>`,
      );
      fontIds.set(key, id);
    }
    return id;
  };

  const fillId = (spec: StyleSpec) => {
    const key = spec.fill ?? 'none';
    let id = fillIds.get(key);
    if (id === undefined) {
      id = fills.length;
      fills.push(
        `<fill><patternFill patternType="solid"><fgColor rgb="FF${key}"/>` +
          `<bgColor indexed="64"/></patternFill></fill>`,
      );
      fillIds.set(key, id);
    }
    return id;
  };

  for (const name of Object.keys(STYLES)) {
    const spec = STYLES[name];
    const align: string[] = [];
    if (spec.halign) align.push(`horizontal="${spec.halign}"`);
    if (spec.wrap) align.push('wrapText="1"');
    align.push('vertical="center"');
    index.set(name, xfs.length);
    xfs.push(
      `<xf numFmtId="0" fontId="${fontId(spec)}" fillId="${fillId(spec)}" ` +
        `borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">` +
        `<alignment ${align.join(' ')}/></xf>`,
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
    `<fills count="${fills.length}">${fills.join('')}</fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/>` +
    `<diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" ` +
    `borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" ` +
    `builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  return { xml, index };
}

/** Build xl/worksheets/sheet1.xml from the grid. */
function buildSheet(
  rows: XlsxRow[],
  widths: number[],
  styleIndex: Map<string, number>,
): string {
  const rowXml: string[] = [];
  const merges: string[] = [];

  rows.forEach((cells, rowIdx) => {
    const r = rowIdx + 1;
    const cellXml: string[] = [];
    let col = 0;

    for (const c of cells) {
      const ref = `${colLetter(col)}${r}`;
      const style = styleIndex.get(c.style) ?? 0;
      const span = c.mergeAcross ?? 0;
      if (span > 0) merges.push(`${ref}:${colLetter(col + span)}${r}`);

      if (typeof c.value === 'number') {
        cellXml.push(`<c r="${ref}" s="${style}"><v>${c.value}</v></c>`);
      } else if (c.value === '') {
        cellXml.push(`<c r="${ref}" s="${style}"/>`);
      } else {
        cellXml.push(
          `<c r="${ref}" s="${style}" t="inlineStr"><is>` +
            `<t xml:space="preserve">${esc(c.value)}</t></is></c>`,
        );
      }
      col += span + 1;
    }

    rowXml.push(`<row r="${r}">${cellXml.join('')}</row>`);
  });

  const cols =
    `<cols>` +
    widths
      .map(
        (w, i) =>
          `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
      )
      .join('') +
    `</cols>`;

  const mergeXml =
    merges.length > 0
      ? `<mergeCells count="${merges.length}">${merges
          .map((m) => `<mergeCell ref="${m}"/>`)
          .join('')}</mergeCells>`
      : '';

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    cols +
    `<sheetData>${rowXml.join('')}</sheetData>` +
    mergeXml +
    `</worksheet>`
  );
}

// ---------------------------------------------------------------------------
// Minimal ZIP writer (stored / uncompressed entries — no dependencies).
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const u16 = (v: number) => Uint8Array.of(v & 0xff, (v >>> 8) & 0xff);

const u32 = (v: number) =>
  Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);

/** Zip named parts into an uncompressed (stored) archive. */
function zipStore(parts: { name: string; data: Uint8Array }[]): Uint8Array {
  const now = new Date();
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) &
    0xffff;
  const dosDate =
    (((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate()) &
    0xffff;

  const encoder = new TextEncoder();
  const body: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const part of parts) {
    const name = encoder.encode(part.name);
    const crc = crc32(part.data);
    const size = part.data.length;

    const local = concatBytes([
      u32(0x04034b50),
      u16(20), // version needed
      u16(0), // flags
      u16(0), // method: stored
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0), // extra field length
      name,
    ]);

    body.push(local, part.data);

    central.push(
      concatBytes([
        u32(0x02014b50),
        u16(20), // version made by
        u16(20), // version needed
        u16(0), // flags
        u16(0), // method: stored
        u16(dosTime),
        u16(dosDate),
        u32(crc),
        u32(size),
        u32(size),
        u16(name.length),
        u16(0), // extra field length
        u16(0), // comment length
        u16(0), // disk number
        u16(0), // internal attributes
        u32(0), // external attributes
        u32(offset), // local header offset
        name,
      ]),
    );

    offset += local.length + size;
  }

  const centralBytes = concatBytes(central);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0), // disk number
    u16(0), // disk with central directory
    u16(parts.length),
    u16(parts.length),
    u32(centralBytes.length),
    u32(offset), // central directory offset
    u16(0), // comment length
  ]);

  return concatBytes([...body, centralBytes, end]);
}

/** Assemble the .xlsx package (content types + workbook + sheet + styles). */
function buildXlsx(rows: XlsxRow[], widths: number[]): Blob {
  const { xml: stylesXml, index } = buildStyles();
  const sheetXml = buildSheet(rows, widths, index);
  const encoder = new TextEncoder();

  const bytes = zipStore([
    {
      name: '[Content_Types].xml',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          `</Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
          `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="Master Summary" sheetId="1" r:id="rId1"/></sheets>` +
          `</workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', data: encoder.encode(stylesXml) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml) },
  ]);

  // `zipStore` always returns a freshly allocated, exactly-sized view, so its
  // backing buffer can be handed to Blob as-is.
  return new Blob([bytes.buffer as ArrayBuffer], { type: XLSX_MIME });
}

/**
 * Build the workbook and trigger a download of the .xlsx file. Columns are
 * derived from the ARC numbers that actually appear in the sections (in order
 * of first appearance), so duplicates are collapsed and unknown/new arcs get
 * their own column automatically.
 */
export function downloadMasterSummaryExcel(sections: MasterExcelSection[]): void {
  // ---- Derive the dynamic column set from the data (dedup + add unknown). ----
  const colByArc = new Map<string, { arc: string; jobType: string }>();
  const arcOrder: string[] = [];

  for (const s of sections) {
    for (const r of s.rows) {
      for (const ln of r.lines) {
        const n = normalizeArc(ln.arc);
        if (!n) continue;
        const existing = colByArc.get(n);
        if (!existing) {
          colByArc.set(n, {
            arc: ln.arc.trim() || n,
            jobType: ln.jobType || ln.arc || n,
          });
          arcOrder.push(n);
        } else if (!existing.jobType && ln.jobType) {
          existing.jobType = ln.jobType;
        }
      }
    }
  }

  const arcs = arcOrder.map((n) => colByArc.get(n)!);
  const colIndex = new Map<string, number>();
  arcs.forEach((c, i) => colIndex.set(normalizeArc(c.arc), i));

  // ---- Site name shown beside the row-3 heading (blank when none known). ----
  const siteLabel = Array.from(
    new Set(sections.flatMap((s) => s.rows.map((r) => (r.siteName || '').trim()))),
  )
    .filter((v) => v !== '' && v !== '—')
    .join(', ');

  // ---- Row-3 heading: name the trade when only carpentry is exported. ----
  // Every exported row coming from a carpentry form means the caller filtered
  // down to carpentry-only data, so the heading names that trade; a mixed or
  // painting-only export keeps the generic room-area wording.
  const exportRows = sections.flatMap((s) => s.rows);
  const carpentryOnly =
    exportRows.length > 0 && exportRows.every((r) => r.formType === 'carpenter');
  const heading = carpentryOnly
    ? 'ROOM / PUBLIC CARPENTRY AREA MAINTENANCE JOB'
    : 'ROOM AREA MAINTENANCE JOB';

  // ---- Date range for the row-4 subtitle. ----
  let min = '';
  let max = '';
  for (const s of sections) {
    for (const r of s.rows) {
      if (!r.date) continue;
      if (!min || r.date < min) min = r.date;
      if (!max || r.date > max) max = r.date;
    }
  }
  const range = min ? `${fmtShort(min)} To ${fmtShort(max)}` : '';
  const subtitle = `ENGG. PNT-POLS JOB.${range ? ` (${range})` : ''}`;

  const LEAD = ['SL', 'DATE', 'Room No', 'Description'];
  const totalCols = LEAD.length + arcs.length;

  const rows: XlsxRow[] = [];
  const addRow = (...cells: XlsxCell[]) => {
    rows.push(cells);
  };

  // Row 1: blank.
  addRow();
  // Row 2: title.
  addRow({
    value: 'STANDARD INTERIOR',
    style: 'title',
    mergeAcross: totalCols - 1,
  });
  // Row 3: room-area heading (carpentry wording when only carpentry is
  // exported), with the site name appended after a slash.
  addRow({
    value: `(${heading})${siteLabel ? ` / ${siteLabel}` : ''}`,
    style: 'subtitle',
    mergeAcross: totalCols - 1,
  });
  // Row 4: subtitle.
  addRow({ value: subtitle, style: 'subtitle', mergeAcross: totalCols - 1 });
  // Row 5: column headers (SL, DATE, Room No, Description, one job-type per ARC).
  addRow(
    ...LEAD.map((h) => ({ value: h, style: 'colHeader' })),
    ...arcs.map((c) => ({ value: c.jobType, style: 'colHeader' })),
  );
  // Row 6: ARC SL.NO. row.
  addRow(
    { value: 'ARC SL.NO.', style: 'arc', mergeAcross: LEAD.length - 1 },
    ...arcs.map((c) => ({ value: c.arc, style: 'arc' })),
  );

  // Grand total across every category (written as the sheet's final row).
  const grandTotals = new Array<number>(arcs.length).fill(0);

  // Sections: highlighted category header + its data rows + category total.
  for (const s of sections) {
    addRow(
      { value: 'A', style: 'section' },
      { value: '1', style: 'sectionText' },
      { value: '', style: 'sectionText' },
      {
        value: s.category || s.siteName || '—',
        style: 'section',
        mergeAcross: totalCols - 4,
      },
    );

    let sl = 1;
    const totals = new Array<number>(arcs.length).fill(0);

    for (const r of s.rows) {
      // SL carries the form's Measurement Sheet No.; a form that was never
      // assigned one falls back to the running row index.
      const slValue = r.sheetNo > 0 ? r.sheetNo : sl;
      const cells: XlsxCell[] = [
        { value: slValue, style: 'num' },
        { value: r.date ? fmtPadded(r.date) : '', style: 'text' },
        { value: r.roomNo, style: 'text' },
        { value: r.description, style: 'text' },
      ];

      const byArc = new Map<string, number>();
      for (const ln of r.lines) {
        if (typeof ln.qty !== 'number') continue;
        const n = normalizeArc(ln.arc);
        const idx = colIndex.get(n);
        if (idx !== undefined) {
          byArc.set(n, (byArc.get(n) ?? 0) + ln.qty);
          totals[idx] += ln.qty;
          grandTotals[idx] += ln.qty;
        }
      }

      for (const arcKey of arcOrder) {
        const v = byArc.get(arcKey);
        cells.push(
          typeof v === 'number'
            ? { value: v, style: 'num' }
            : { value: '', style: 'text' },
        );
      }

      addRow(...cells);
      sl += 1;
    }

    // Total line for this category (sums every ARC column in the group).
    addRow(
      { value: '', style: 'text' },
      { value: '', style: 'text' },
      { value: '', style: 'text' },
      { value: 'TOTAL', style: 'total' },
      ...totals.map((v) =>
        v > 0 ? { value: v, style: 'total' } : { value: '', style: 'text' },
      ),
    );
  }

  // GRAND TOTAL line — every category combined (last line of the sheet).
  addRow(
    { value: '', style: 'text' },
    { value: '', style: 'text' },
    { value: '', style: 'text' },
    { value: 'GRAND TOTAL', style: 'grandTotal' },
    ...grandTotals.map((v) =>
      v > 0 ? { value: v, style: 'grandTotal' } : { value: '', style: 'text' },
    ),
  );

  // ---- Column widths, in Excel character units. ----
  const widths = [
    ...LEAD.map((h) =>
      h === 'Description' ? 26 : h === 'SL' ? 5 : h === 'DATE' ? 11 : 10,
    ),
    ...arcs.map(() => 13),
  ];

  // ---- Write the .xlsx download. ----
  const url = URL.createObjectURL(buildXlsx(rows, widths));
  const a = document.createElement('a');
  a.href = url;
  a.download = `master-summary-${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
