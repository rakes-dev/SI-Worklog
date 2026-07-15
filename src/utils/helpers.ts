import type { Job, PaintForm, SummaryRow, MeasurementRow, FormSignatures } from '@/types';

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
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
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcSummaryRow(row: SummaryRow): number {
  const qty = typeof row.qty === 'number' ? row.qty : 0;
  const rate = typeof row.rate === 'number' ? row.rate : 0;
  return parseFloat((qty * rate).toFixed(2));
}

export function calcMeasurementRow(row: MeasurementRow): number {
  const l = typeof row.length === 'number' ? row.length : 0;
  const w = typeof row.width === 'number' ? row.width : 0;
  const n = typeof row.no === 'number' ? row.no : 0;
  return parseFloat((l * w * n).toFixed(2));
}

export function calcGrandTotal(rows: SummaryRow[]): number {
  return parseFloat(rows.reduce((s, r) => s + r.amount, 0).toFixed(2));
}

export function calcTotalArea(rows: MeasurementRow[]): number {
  return parseFloat(rows.reduce((s, r) => s + r.totalArea, 0).toFixed(2));
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
    complaintSource: '',
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
    location: '',
    coat: '',
    length: '',
    width: '',
    no: '',
    totalArea: 0,
  };
}

export function defaultForm(jobName: string, formIndex: number): PaintForm {
  return {
    id: generateId('form'),
    formName: `Form ${formIndex} — ${jobName}`,
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
    measurementRows: [
      defaultMeasurementRow(1),
      defaultMeasurementRow(2),
      defaultMeasurementRow(3),
    ],
    totalArea: 0,
    signatures: defaultSignatures(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function defaultJob(): Job {
  const id = generateId('job');
  return {
    id,
    jobName: '',
    clientName: '',
    siteAddress: '',
    workStartDate: todayISO(),
    workEndDate: '',
    submittedToOffice: '',
    delay: '',
    remarks: '',
    status: 'Draft',
    forms: [],
    totalAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function statusColor(status: string): string {
  switch (status) {
    case 'Draft': return 'bg-muted text-muted-foreground';
    case 'Pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'Submitted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'Rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-900';
    default: return 'bg-muted text-muted-foreground';
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