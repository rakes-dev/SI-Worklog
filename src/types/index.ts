export type JobStatus = 'Draft' | 'Pending' | 'Approved';

export interface SummaryRow {
  id: string;
  slNo: number;
  complaintSource: string;
  paintType: string;
  coat: string;
  arcNo: string;
  qty: number | '';
  rate: number | '';
  amount: number;
}

export interface MeasurementRow {
  id: string;
  slNo: number;
  jobType: string;
  location: string;
  coat: string;
  length: number | '';
  width: number | '';
  no: number | '';
  totalArea: number;
}

export interface SignatureEntry {
  signature: string;
  name: string;
  date: string;
}

export interface FormSignatures {
  standardInterior: SignatureEntry;
  requestedBy: SignatureEntry;
  qualityCheckHK: SignatureEntry;
  qualityCheckEngg: SignatureEntry;
  measurementCheck: SignatureEntry;
}

export interface PaintForm {
  id: string;
  formName: string;
  suitPublicAreaName: string;
  date: string;
  workStartDate: string;
  workEndDate: string;
  submittedToOffice: string;
  delay: string;
  // Section A
  totalSheets: number;
  sheetNo: number;
  summaryRows: SummaryRow[];
  grandTotal: number;
  // Section B
  measurementRows: MeasurementRow[];
  totalArea: number;
  // Signatures
  signatures: FormSignatures;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  jobName: string;
  clientName: string;
  siteAddress: string;
  workStartDate: string;
  workEndDate: string;
  submittedToOffice: string;
  delay: string;
  remarks: string;
  status: JobStatus;
  forms: PaintForm[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArcItem {
  id: string;
  arc_no: string;
  coat: number | '';
  description: string;
  final_rate: number | '';
  uom: string;
  job_type: string;
}

export interface AppState {
  jobs: Job[];
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  isOffline: boolean;
}