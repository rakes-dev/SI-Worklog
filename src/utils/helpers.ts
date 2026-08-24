import type { Job, PaintForm, SummaryRow, MeasurementRow, FormSignatures, FormType } from '@/types';

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${day}/${mon}/${yr}`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function calcSummaryRow(row: SummaryRow): number {
  const qty = typeof row.qty === 'number' ? row.qty : 0;
  const rate = typeof row.rate === 'number' ? row.rate : 0;
  return parseFloat((qty * rate).toFixed(2));
}

export function calcMeasurementRow(row: MeasurementRow): number {
  const l = typeof row.length === 'number' ? row.length : 0;
  const w = typeof row.width === 'number' ? row.width : 0;
  const h = typeof row.height === 'number' ? row.height : 0;
  const n = typeof row.no === 'number' ? row.no : 0;

  // Feet dimensions kept at full precision (trimmed to 5 decimals) so the
  // calculated total uses the ACTUAL value; only the final total is rounded.
  const lf = parseFloat((l * M_TO_FT).toFixed(5));
  const wf = parseFloat((w * M_TO_FT).toFixed(5));
  const hf = parseFloat((h * M_TO_FT).toFixed(5));

  // RFT — running feet (linear measurement). Length is entered in meters, so
  // convert to feet and multiply by the number of pieces. Width is not used.
  if (isRftUom(row.uom)) {
    return parseFloat((lf * n).toFixed(2));
  }

  // CFT — cubic feet (volume, e.g. carpenter items with height).
  // Dimensions are in meters → m³ × 35.3147 = ft³.
  if (isCftUom(row.uom)) {
    return parseFloat((lf * wf * hf * n).toFixed(2));
  }

  let area: number;

  // If only length is given (width is 0/empty), treat as circle item.
  // Area = π × (diameter/2)² × no
  if (l > 0 && w === 0) {
    const radius = l / 2;
    area = Math.PI * radius * radius * n;
  } else {
    area = l * w * n;
  }

  // Length & breadth are entered in meters. If the billing UOM is square feet,
  // convert the resulting area to square feet (1 m² = 10.76391 ft²).
  if (isSqftUom(row.uom)) {
    return parseFloat((lf * wf * n).toFixed(2));
  }

  return parseFloat(area.toFixed(2));
}

// 1 square meter = 10.76391 square feet
const SQM_TO_SQFT = 10.76391;
// 1 meter = 3.28084 feet
const M_TO_FT = 3.28084;
// 1 cubic meter = 35.3147 cubic feet
const M3_TO_FT3 = 35.3147;

/** Convert a length entered in meters to feet. */
export function metersToFeet(meters: number): number {
  return meters * M_TO_FT;
}

/** Convert a length entered in feet to meters (inverse of metersToFeet). */
export function feetToMeters(feet: number): number {
  return feet / M_TO_FT;
}

/** True when the unit of measurement is "sqft" (case/whitespace/punctuation insensitive). */
export function isSqftUom(uom?: string): boolean {
  return (
    (uom ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s._-]/g, '') === 'sqft'
  );
}

/** True when the unit of measurement is "rft" (running feet). */
export function isRftUom(uom?: string): boolean {
  return (
    (uom ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s._-]/g, '') === 'rft'
  );
}

/** True when the unit of measurement is "cft" (cubic feet). */
export function isCftUom(uom?: string): boolean {
  return (
    (uom ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s._-]/g, '') === 'cft'
  );
}

/** True when linear dimensions (m → ft) should be used for this UOM. */
export function isFtBasedUom(uom?: string): boolean {
  return isSqftUom(uom) || isRftUom(uom) || isCftUom(uom);
}

/** Human-readable unit label strictly per measurement row UOM. */
export function calcAreaUnitLabel(uom?: string): string {
  if (isRftUom(uom)) return 'rft';
  if (isCftUom(uom)) return 'cft';
  return isSqftUom(uom) ? 'ft²' : 'm²';
}

/** Unit label across a set of rows (e.g. a form). Mixed units → joined, e.g. "m²/ft²". */
export function aggregateAreaUnitLabel(uoms: (string | undefined)[]): string {
  const has = { m2: false, ft2: false, rft: false, cft: false };
  for (const u of uoms) {
    if (isCftUom(u)) has.cft = true;
    else if (isRftUom(u)) has.rft = true;
    else if (isSqftUom(u)) has.ft2 = true;
    else has.m2 = true; // empty / default rows are treated as m²
  }
  const parts: string[] = [];
  if (has.m2) parts.push('m²');
  if (has.rft) parts.push('rft');
  if (has.cft) parts.push('cft');
  if (has.ft2) parts.push('ft²');
  return parts.length ? parts.join('/') : 'm²';
}

/**
 * Header unit label for the linear columns (Length/Width/Height) across a set of
 * rows: "m" (all metric), "ft" (all feet-based), or "m/ft" (mixed).
 */
export function linearUnitLabel(uoms: (string | undefined)[]): string {
  const hasFt = uoms.some((u) => isFtBasedUom(u));
  const hasM = uoms.some((u) => !isFtBasedUom(u));
  if (hasFt && hasM) return 'm/ft';
  return hasFt ? 'ft' : 'm';
}

/** Format a number trimmed of trailing zeros, up to maxDecimals (no forced rounding for display). */
export function trimNumber(value: number, maxDecimals = 5): string {
  if (!Number.isFinite(value)) return '';
  return parseFloat(value.toFixed(maxDecimals)).toString();
}

/** Cell value for a linear column: shows feet when the row UOM is feet-based, otherwise meters. */
export function linearCellValue(uom: string | undefined, value: number | ''): string {
  if (value === '') return '';
  if (isFtBasedUom(uom)) return metersToFeet(value).toFixed(2);
  return value.toFixed(2);
}

/** "ft" for feet-based UOMs, otherwise "m" — used to append a per-cell unit suffix. */
export function linearUnitSuffix(uom?: string): 'ft' | 'm' {
  return isFtBasedUom(uom) ? 'ft' : 'm';
}

export function calcGrandTotal(rows: SummaryRow[]): number {
  return parseFloat(rows.reduce((s, r) => s + r.amount, 0).toFixed(2));
}

export function calcTotalArea(rows: MeasurementRow[]): number {
  return parseFloat(rows.reduce((s, r) => s + r.totalArea, 0).toFixed(2));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalize a free-text value (site name, site address, employee name, area
 * name, etc.) into a case-insensitive comparison key. Values differing only in
 * letter case ("ITC ROYAL" vs "Itc royal") produce the same key so they can be
 * grouped, deduped, and filtered together.
 */
export function normalizeKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function isBlankSummaryRow(row: SummaryRow): boolean {
  return (
    !row.paintType.trim() &&
    !row.coat.trim() &&
    !row.arcNo.trim() &&
    (row.qty === '' || row.qty === 0) &&
    (row.rate === '' || row.rate === 0) &&
    row.amount === 0
  );
}

export function syncSummaryRowsWithMeasurements(
  summaryRows: SummaryRow[],
  measurementRows: MeasurementRow[]
): SummaryRow[] {
  const groupedRows = new Map<
    string,
    {
      jobType: string;
      totalArea: number;
      arcNo: string;
      rate: number | '';
      coat: string;
    }
  >();
  const jobTypeOrder: string[] = [];

  measurementRows.forEach((row) => {
    const jobType = (row.jobType ?? '').trim();
    if (!jobType) return;

    const arcNo = (row.arcNo ?? '').trim();
    // Split the summary Qty per job type + ARC no. Rows without an ARC no are
    // kept together under just the (job type) name.
    const key = `${normalizeText(jobType)}::${normalizeText(arcNo)}`;
    const totalArea = row.totalArea || 0;
    const existing = groupedRows.get(key);

    if (existing) {
      existing.totalArea = parseFloat((existing.totalArea + totalArea).toFixed(2));
      return;
    }

    groupedRows.set(key, {
      jobType,
      totalArea: parseFloat(totalArea.toFixed(2)),
      arcNo: row.arcNo ?? '',
      rate: row.rate ?? '',
      coat: row.coat ?? '',
    });
    jobTypeOrder.push(key);
  });

  const availableRows = summaryRows.map((row) => ({ ...row }));
  const usedRowIds = new Set<string>();
  const syncedRows: SummaryRow[] = [];

  const takeRowForJobType = (jobType: string): SummaryRow | undefined => {
    const normalized = normalizeText(jobType);
    return availableRows.find(
      (row) => !usedRowIds.has(row.id) && normalizeText(row.paintType) === normalized
    );
  };

  const takeBlankRow = (): SummaryRow | undefined =>
    availableRows.find((row) => !usedRowIds.has(row.id) && isBlankSummaryRow(row));

  jobTypeOrder.forEach((groupKey) => {
    const group = groupedRows.get(groupKey);
    if (!group) return;

    const matchedRow = takeRowForJobType(group.jobType) ?? takeBlankRow();
    if (matchedRow) {
      usedRowIds.add(matchedRow.id);
    }

    const baseRow = matchedRow ?? defaultSummaryRow(syncedRows.length + 1);
    const row: SummaryRow = {
      ...baseRow,
      complaintSource: baseRow.complaintSource.trim() ? baseRow.complaintSource : 'Engineer Dept.',
      paintType: group.jobType,
      coat: group.coat || baseRow.coat,
      arcNo: group.arcNo || baseRow.arcNo,
      rate: group.rate !== '' ? group.rate : baseRow.rate,
      qty: group.totalArea,
      amount: 0,
    };
    row.amount = calcSummaryRow(row);
    syncedRows.push(row);
  });

  availableRows.forEach((row) => {
    if (usedRowIds.has(row.id)) return;
    syncedRows.push({ ...row, amount: calcSummaryRow(row) });
  });

  return syncedRows.map((row, index) => ({
    ...row,
    slNo: index + 1,
    amount: calcSummaryRow(row),
  }));
}

const defaultSig = (): import('@/types').SignatureEntry => ({
  signature: '',
  name: '',
  date: '',
});

export function defaultSignatures(): FormSignatures {
  return {
    standardInterior: defaultSig(),
    requestedBy: defaultSig(),
    qualityCheckHK: defaultSig(),
    qualityCheckEngg: defaultSig(),
    measurementCheck: defaultSig(),
  };
}

export function defaultSummaryRow(slNo: number): SummaryRow {
  return {
    id: generateId('sr'),
    slNo,
    complaintSource: 'Engineer Dept.',
    paintType: '',
    coat: '',
    arcNo: '',
    qty: '',
    rate: '',
    amount: 0,
  };
}

export function defaultMeasurementRow(slNo: number): MeasurementRow {
  return {
    id: generateId('mr'),
    slNo,
    jobType: '',
    location: '',
    coat: '',
    height: '',
    arcNo: '',
    rate: '',
    uom: '',
    length: '',
    width: '',
    no: '',
    totalArea: 0,
  };
}

export function defaultForm(
  jobName: string,
  formIndex: number,
  formType: FormType = 'painting'
): PaintForm {
  return {
    id: generateId('form'),
    formName:
      formType === 'carpenter'
        ? `Carpenter Form ${formIndex} — ${jobName}`
        : `Form ${formIndex} — ${jobName}`,
    formType,
    suitPublicAreaName: '',
    date: todayISO(),
    workStartDate: '',
    workEndDate: '',
    submittedToOffice: '',
    delay: '',
    totalSheets: 1,
    sheetNo: formIndex,
    summaryRows: [defaultSummaryRow(1), defaultSummaryRow(2), defaultSummaryRow(3)],
    grandTotal: 0,
    measurementRows: [defaultMeasurementRow(1), defaultMeasurementRow(2), defaultMeasurementRow(3)],
    totalArea: 0,
    signatures: defaultSignatures(),
    isDeleted: false,
    deletedAt: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function defaultJob(): Job {
  const id = generateId('job');
  return {
    id,
    empName: '',
    siteName: '',
    siteAddress: '',
    remarks: '',
    forms: [],
    totalAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function statusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return 'bg-muted text-muted-foreground';
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'Submitted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'Rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-900';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
