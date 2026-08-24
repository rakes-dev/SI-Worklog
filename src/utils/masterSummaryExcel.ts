// Builds the admin Master Summary Excel export (SpreadsheetML / XML 2003 .xls,
// opened natively by Excel with no extra dependencies).
//
// Columns are derived dynamically from the arcs actually present in the data:
//   - duplicate arcs are removed (deduped by normalized ARC number),
//   - unknown arcs found in the data are added as extra columns,
//   - each column header uses that ARC's job type (paint type / description).
//
// Layout:
//   Row 1: blank
//   Row 2: STANDARD INTERIOR                          (merged, centered, bold)
//   Row 3: (ROOM AREA MAINTENANCE JOB)                (merged, centered, bold)
//   Row 4: ENGG. PNT-POLS JOB. (<range>)/ <site>      (merged, centered, bold)
//   Row 5: column headers (SL | DATE | Description | one column per ARC)
//   Row 6: ARC SL.NO. row (ARC ref under each column)
//   Then, per site: a highlighted section row (beige fill, bold) followed by
//   its data rows (one per room/area with qty placed in the matching ARC column).

/** A single quantity line on a data row (whose column is keyed by ARC). */
export interface MasterExcelLine {
  arc: string; // ARC number, normalized on lookup
  qty: number;
  jobType: string; // job-type label shown in this ARC's column header
}

/** One exported data row (e.g. site + room + date), holding ARC/qty lines. */
export interface MasterExcelRowData {
  date: string; // ISO yyyy-mm-dd, or '' when unknown
  description: string;
  key: string;
  lines: MasterExcelLine[];
}

/** A site group: a highlighted section header followed by data rows. */
export interface MasterExcelSection {
  siteName: string;
  siteAddress: string;
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

function cell(value: string | number | '', style?: string, mergeAcross = 0): string {
  const attrs = [`ss:StyleID="${style ?? 'Default'}"`];
  if (mergeAcross > 0) attrs.push(`ss:MergeAcross="${mergeAcross}"`);
  const attr = ` ${attrs.join(' ')}`;
  if (value === '') return `<Cell${attr}><Data ss:Type="String"></Data></Cell>`;
  if (typeof value === 'number')
    return `<Cell${attr}><Data ss:Type="Number">${value}</Data></Cell>`;
  return `<Cell${attr}><Data ss:Type="String">${esc(value)}</Data></Cell>`;
}

function row(cells: string[]): string {
  return `<Row>${cells.join('')}</Row>`;
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

const STYLES_XML = `
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="subtitle"><Font ss:Bold="1"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="colHeader"><Font ss:Bold="1" ss:Size="9"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FDE9D9" ss:Pattern="Solid"/></Style>
  <Style ss:ID="arc"><Font ss:Size="9"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="section"><Font ss:Bold="1"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="sectionText"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="text"><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="num"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/></Style>
  <Style ss:ID="total"><Font ss:Bold="1"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Interior ss:Color="#FFF2CC" ss:Pattern="Solid"/></Style>
 </Styles>`;

/** Best-effort room number extraction from an area/suit name string. */
export function extractRoomNumberFromArea(areaName: string): string {
  const input = (areaName || '').trim();
  if (!input) return '';

  const prefixed = input.match(
    /(?:room|suite|flat|unit|apt|no)\s*[:.-]?\s*([a-z0-9]+(?:[-/ ]?[a-z0-9]+)?)/i
  );
  if (prefixed && prefixed[1] && /[0-9]/.test(prefixed[1])) {
    return prefixed[1].replace(/\s+/g, '').toUpperCase();
  }

  const fallback = input.match(/\b([0-9]+[a-z]?)\b/i);
  return fallback ? fallback[1].toUpperCase() : '';
}
/**
 * Build the workbook and trigger a download of the .xls file. Columns are
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
          colByArc.set(n, { arc: ln.arc.trim() || n, jobType: ln.jobType || ln.arc || n });
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

  // ---- Date-range / site label for the subtitle.
  let min = '';
  let max = '';
  let siteName = '';
  for (const s of sections) {
    if (!siteName && s.siteName) siteName = s.siteName;
    for (const r of s.rows) {
      if (!r.date) continue;
      if (!min || r.date < min) min = r.date;
      if (!max || r.date > max) max = r.date;
    }
  }
  const range = min ? `${fmtShort(min)} To ${fmtShort(max)}` : '';
  const subtitle = `ENGG. PNT-POLS JOB.${range ? ` (${range})` : ''}${siteName ? `/ ${siteName}` : ''}`;

  const LEAD = ['SL', 'DATE', 'Description'];
  const totalCols = LEAD.length + arcs.length;

  const grid: string[] = [];

  // Row 1: blank.
  grid.push('<Row/>');
  // Rows 2-4: merged titles/subtitles across all columns.
  grid.push(row([cell('STANDARD INTERIOR', 'title', totalCols - 1)]));
  grid.push(row([cell('(ROOM AREA MAINTENANCE JOB)', 'subtitle', totalCols - 1)]));
  grid.push(row([cell(subtitle, 'subtitle', totalCols - 1)]));
  // Row 5: column headers (SL, DATE, Description, then one job-type per ARC).
  grid.push(
    row([
      ...LEAD.map((h) => cell(h, 'colHeader')),
      ...arcs.map((c) => cell(c.jobType, 'colHeader')),
    ])
  );
  // Row 6: ARC SL.NO. row.
  grid.push(
    row([cell('ARC SL.NO.', 'arc', LEAD.length - 1), ...arcs.map((c) => cell(c.arc, 'arc'))])
  );
  // Sections: highlighted site row + its data rows.
  for (const s of sections) {
    grid.push(
      row([
        cell('A', 'section'),
        cell('1', 'sectionText'),
        cell(s.siteName || '—', 'section', totalCols - 3),
      ])
    );
    let sl = 1;
    const siteTotals = new Array<number>(arcs.length).fill(0);
    for (const r of s.rows) {
      const cells: string[] = [
        cell(sl, 'num'),
        cell(r.date ? fmtPadded(r.date) : '', 'text'),
        cell(r.description, 'text'),
      ];
      const byArc = new Map<string, number>();
      for (const ln of r.lines) {
        if (typeof ln.qty !== 'number') continue;
        const n = normalizeArc(ln.arc);
        const idx = colIndex.get(n);
        if (idx !== undefined) {
          byArc.set(n, (byArc.get(n) ?? 0) + ln.qty);
          siteTotals[idx] += ln.qty;
        }
      }
      for (let i = 0; i < arcs.length; i += 1) {
        const v = byArc.get(arcOrder[i]);
        cells.push(typeof v === 'number' ? cell(v, 'num') : cell('', 'text'));
      }
      grid.push(row(cells));
      sl += 1;
    }
    // Total-area row for this site (sums each ARC column).
    grid.push(
      row([
        cell('', 'text'),
        cell('', 'text'),
        cell('TOTAL', 'total'),
        ...siteTotals.map((v) => (v > 0 ? cell(v, 'total') : cell('', 'text'))),
      ])
    );
  }

  const colWidths = Array.from({ length: totalCols }, (_, i) => {
    return `<Column ss:AutoFitWidth="0" ss:Width="${i < LEAD.length ? 24 : 18}"/>`;
  }).join('\n  ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${STYLES_XML}
 <Worksheet ss:Name="Master Summary">
  <Table>
  ${colWidths}
  ${grid.join('\n  ')}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `master-summary-${new Date().toISOString().split('T')[0]}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
