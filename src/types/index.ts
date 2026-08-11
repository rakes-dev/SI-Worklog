export type JobStatus = 'Draft' | 'Pending' | 'Approved';
export type FormType = 'painting' | 'carpenter';

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
  height: number | '';
  arcNo: string;
  rate: number | '';
  uom: string;
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
  formType: FormType;
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
  // Soft delete
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  empName: string;
  siteName: string;
  siteAddress: string;
  remarks: string;
  forms: PaintForm[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArcItem {
  id: string;
  arc_no: string;
  coat: string;
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