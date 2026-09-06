export type JobStatus = "Draft" | "Pending" | "Approved";
export type FormType = "painting" | "carpenter";

export interface SummaryRow {
  id: string;
  slNo: number;
  complaintSource: string;
  paintType: string;
  coat: string;
  arcNo: string;
  qty: number | "";
  rate: number | "";
  amount: number;
}

export interface MeasurementRow {
  id: string;
  slNo: number;
  jobType: string;
  location: string;
  coat: string;
  height: number | "";
  arcNo: string;
  rate: number | "";
  uom: string;
  length: number | "";
  width: number | "";
  no: number | "";
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
  // Month partitioning (YYYY-MM)
  month: string;
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
  userId?: string; // Email of the user who created this job
  // Soft delete — jobs are never hard-deleted.
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A physical work location (e.g. ITC ROYAL, ITC SONAR). Admin-managed.
 * `address` is reference metadata used for filtering/organising and to keep the
 * printed form header identical to the legacy layout.
 */
export interface Site {
  id: string;
  name: string;
  address: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A work category within a site (Public Area, CMS, Carpentry – Room, …).
 * Admin-managed and global (same set applies across every site).
 * `defaultFormType` decides which measurement template a new form starts from:
 * the five "painting + polishing" categories use "painting"; the two carpentry
 * categories use "carpenter".
 */
export interface WorkCategory {
  id: string;
  name: string;
  defaultFormType: FormType;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A measurement form stored as its OWN Firestore document (the core of the
 * restructure — forms are no longer nested inside a single job document, which
 * is what caused concurrent/offline saves to overwrite each other).
 *
 * It carries every field of the legacy PaintForm unchanged, PLUS the links back
 * to its Site and Category, its owner, and denormalized site/employee fields so
 * the existing PrintLayout / PdfExportLayout receive an identical job-shaped
 * object and never need to change.
 */
export interface WorkForm extends PaintForm {
  siteId: string;
  categoryId: string;
  ownerEmail: string; // lowercased login email of the form's owner
  // Denormalized so the printout is byte-for-byte identical and offline display
  // never needs to join against another collection:
  siteName: string;
  siteAddress: string;
  empName: string;
  /** Set by the legacy-jobs migration tool to avoid double-migrating a form. */
  __migrated?: boolean;
  /** Month this form belongs to (format YYYY-MM). Site/category pages show only the current month by default; older forms live in the Archive. */
  month: string;
}

export interface ArcItem {
  id: string;
  arc_no: string;
  coat: string;
  description: string;
  final_rate: number | "";
  uom: string;
  job_type: string;
}

export interface AppState {
  sites: Site[];
  categories: WorkCategory[];
  forms: WorkForm[];
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  isOffline: boolean;
}
