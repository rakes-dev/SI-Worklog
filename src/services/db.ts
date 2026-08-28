import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/services/firebase";
import { ensureFirestoreSchema } from "@/services/firestore-schema";
import type {
  ArcItem,
  Job,
  JobStatus,
  MeasurementRow,
  PaintForm,
  SignatureEntry,
  SummaryRow,
  FormType,
} from "@/types";
import {
  calcGrandTotal,
  calcMeasurementRow,
  calcSummaryRow,
  calcTotalArea,
  defaultForm,
  defaultJob,
  defaultMeasurementRow,
  defaultSignatures,
  defaultSummaryRow,
  generateId,
} from "@/utils/helpers";

const COLLECTION_JOBS = "jobs";
const COLLECTION_ARC = "arc";

/** Parse an ISO timestamp into epoch milliseconds (0 when missing/invalid). */
function parseTimestamp(value: unknown): number {
  if (typeof value !== "string" || !value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export type SaveJobResult =
  | { status: "saved" }
  | { status: "skipped" }; // Server copy is newer — local snapshot retained locally only.

type FirestoreJobData = Partial<Job> & {
  forms?: Array<Partial<PaintForm>>;
};

function isJobStatus(value: unknown): value is JobStatus {
  return value === "Draft" || value === "Pending" || value === "Approved";
}

function isFormType(value: unknown): value is FormType {
  return value === "painting" || value === "carpenter";
}

function coerceString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function coerceRequiredString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

// Coerce a field that is now a string but may hold legacy values in Firestore
// as numbers (e.g. coat stored as 2). Numeric legacy values are preserved as
// their string representation so no existing data is lost during migration.
function coerceStringFromLegacy(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function coerceNumberOrEmpty(value: unknown): number | "" {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : "";
  }
  return "";
}

function coerceNumber(value: unknown, fallback = 0): number {
  const normalized = coerceNumberOrEmpty(value);
  return typeof normalized === "number" ? normalized : fallback;
}

function normalizeSignatureEntry(
  value: Partial<SignatureEntry> | undefined,
): SignatureEntry {
  return {
    signature: coerceString(value?.signature),
    name: coerceString(value?.name),
    date: coerceString(value?.date),
  };
}

function normalizeSummaryRow(
  value: Partial<SummaryRow> | undefined,
  index: number,
): SummaryRow {
  const fallback = defaultSummaryRow(index + 1);
  const row: SummaryRow = {
    ...fallback,
    id: coerceRequiredString(value?.id, generateId("sr")),
    slNo: coerceNumber(value?.slNo, index + 1),
    complaintSource: coerceString(
      value?.complaintSource,
      fallback.complaintSource,
    ),
    paintType: coerceString(value?.paintType),
    // coat is now a string. Legacy Firestore docs may still hold a number —
    // preserve it as its string representation instead of discarding it.
    coat: coerceStringFromLegacy(value?.coat),
    arcNo: coerceString(value?.arcNo),
    qty: coerceNumberOrEmpty(value?.qty),
    rate: coerceNumberOrEmpty(value?.rate),
    amount: 0,
  };
  row.amount = calcSummaryRow(row);
  return row;
}

function normalizeMeasurementRow(
  value: Partial<MeasurementRow> | undefined,
  index: number,
): MeasurementRow {
  const fallback = defaultMeasurementRow(index + 1);
  const row: MeasurementRow = {
    ...fallback,
    id: coerceRequiredString(value?.id, generateId("mr")),
    slNo: coerceNumber(value?.slNo, index + 1),
    jobType: coerceString(value?.jobType),
    location: coerceString(value?.location),
    // coat is now a string; migrate any legacy numeric value to a string.
    coat: coerceStringFromLegacy(value?.coat),
    height: coerceNumberOrEmpty(value?.height),
    arcNo: coerceString(value?.arcNo),
    rate: coerceNumberOrEmpty(value?.rate),
    uom: coerceString(value?.uom),
    length: coerceNumberOrEmpty(value?.length),
    width: coerceNumberOrEmpty(value?.width),
    no: coerceNumberOrEmpty(value?.no),
    totalArea: 0,
  };
  row.totalArea = calcMeasurementRow(row);
  return row;
}

function normalizePaintForm(
  value: Partial<PaintForm> | undefined,
  index: number,
  jobName: string,
): PaintForm {
  const fallback = defaultForm(jobName || "New Job", index + 1);
  const summaryRows = Array.isArray(value?.summaryRows)
    ? value.summaryRows.map((row, rowIndex) =>
        normalizeSummaryRow(row, rowIndex),
      )
    : fallback.summaryRows;
  const measurementRows = Array.isArray(value?.measurementRows)
    ? value.measurementRows.map((row, rowIndex) =>
        normalizeMeasurementRow(row, rowIndex),
      )
    : fallback.measurementRows;
  const signatures = value?.signatures
    ? {
        standardInterior: normalizeSignatureEntry(
          value.signatures.standardInterior,
        ),
        requestedBy: normalizeSignatureEntry(value.signatures.requestedBy),
        qualityCheckHK: normalizeSignatureEntry(
          value.signatures.qualityCheckHK,
        ),
        qualityCheckEngg: normalizeSignatureEntry(
          value.signatures.qualityCheckEngg,
        ),
        measurementCheck: normalizeSignatureEntry(
          value.signatures.measurementCheck,
        ),
      }
    : defaultSignatures();

  const form: PaintForm = {
    ...fallback,
    ...value,
    id: coerceRequiredString(value?.id, generateId("form")),
    formName: coerceString(value?.formName, fallback.formName),
    formType: isFormType(value?.formType) ? value.formType : "painting",
    suitPublicAreaName: coerceString(value?.suitPublicAreaName),
    date: coerceString(value?.date, fallback.date),
    workStartDate: coerceString(value?.workStartDate),
    workEndDate: coerceString(value?.workEndDate),
    submittedToOffice: coerceString(value?.submittedToOffice),
    delay: coerceString(value?.delay),
    totalSheets: coerceNumber(value?.totalSheets, fallback.totalSheets),
    sheetNo: coerceNumber(value?.sheetNo, index + 1),
    summaryRows,
    grandTotal: 0,
    measurementRows,
    totalArea: 0,
    signatures,
    isDeleted: value?.isDeleted === true,
    deletedAt: coerceString(value?.deletedAt),
    createdAt: coerceString(value?.createdAt, fallback.createdAt),
    updatedAt: coerceString(value?.updatedAt, fallback.updatedAt),
  };

  form.grandTotal = calcGrandTotal(form.summaryRows);
  form.totalArea = calcTotalArea(form.measurementRows);
  return form;
}

function normalizeJob(value: FirestoreJobData): Job {
  const fallback = defaultJob();
  const forms = Array.isArray(value.forms)
    ? value.forms.map((form, index) =>
        normalizePaintForm(form, index, coerceString(value.siteName)),
      )
    : [];
  const job: Job = {
    ...fallback,
    ...value,
    id: coerceRequiredString(value.id, fallback.id),
    empName: coerceString(value.empName),
    siteName: coerceString(value.siteName),
    siteAddress: coerceString(value.siteAddress),
    remarks: coerceString(value.remarks),
    isDeleted: value.isDeleted === true,
    deletedAt: coerceString(value.deletedAt),
    forms,
    totalAmount: 0,
    createdAt: coerceString(value.createdAt, fallback.createdAt),
    updatedAt: coerceString(value.updatedAt, fallback.updatedAt),
  };

  job.totalAmount = job.forms.reduce(
    (sum, form) => sum + (form.grandTotal || 0),
    0,
  );
  return job;
}

/**
 * Recursively remove `undefined` values from an object so Firestore accepts it.
 * Firestore throws "Unsupported field value: undefined" when any field is undefined.
 */
function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return undefined as unknown as T;
  if (value === null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        result[key] = sanitizeForFirestore(val);
      }
    }
    return result as T;
  }
  return value;
}

function jobRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_JOBS, id);
}

function arcRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_ARC, id);
}

function normalizeArcItem(value: Partial<ArcItem>): ArcItem {
  return {
    id: coerceRequiredString(value.id, generateId("arc")),
    arc_no: coerceString(value.arc_no),
    coat: coerceStringFromLegacy(value.coat),
    description: coerceString(value.description),
    final_rate: coerceNumberOrEmpty(value.final_rate),
    uom: coerceString(value.uom),
    job_type: coerceString(value.job_type),
  };
}

async function getAllJobsFromFirestore(): Promise<Job[]> {
  // Firestore rules allow unauthenticated reads — no auth dependency needed.
  ensureFirestoreSchema().catch(() => {});
  const db = getFirestoreDb();
  const snapshot = await getDocs(collection(db, COLLECTION_JOBS));
  return snapshot.docs.map((item) =>
    normalizeJob(item.data() as FirestoreJobData),
  );
}

/**
 * Subscribe to real-time changes in the jobs collection. The callback fires
 * immediately with the current data and again whenever any device changes a
 * job on the server — this is what makes edits reflect live across devices.
 */
function observeJobsFromFirestore(
  onChange: (jobs: Job[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  ensureFirestoreSchema().catch(() => {});
  const db = getFirestoreDb();
  return onSnapshot(
    collection(db, COLLECTION_JOBS),
    (snapshot) => {
      const jobs = snapshot.docs.map((item) =>
        normalizeJob(item.data() as FirestoreJobData),
      );
      jobs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      onChange(jobs);
    },
    (error) => {
      // Live sync is best-effort — surface it but keep the app usable.
      console.warn("Live job sync unavailable; falling back to manual refresh.", error);
      onError?.(error);
    },
  );
}

async function getUserJobsFromFirestore(userEmail: string): Promise<Job[]> {
  // Firestore rules allow unauthenticated reads — no auth dependency needed.
  ensureFirestoreSchema().catch(() => {});
  const db = getFirestoreDb();
  const snapshot = await getDocs(collection(db, COLLECTION_JOBS));
  const jobs = snapshot.docs.map((item) =>
    normalizeJob(item.data() as FirestoreJobData),
  );
  // Filter jobs: show if created by this user or if no userId is set (legacy jobs)
  const normalizedEmail = userEmail.trim().toLowerCase();
  return jobs.filter(
    (job) => !job.userId || job.userId.toLowerCase() === normalizedEmail,
  );
}

export const dbService = {
  ensureSchema: ensureFirestoreSchema,

  async getAllJobs(): Promise<Job[]> {
    const jobs = await getAllJobsFromFirestore();
    return jobs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  async getUserJobs(userEmail: string): Promise<Job[]> {
    const jobs = await getUserJobsFromFirestore(userEmail);
    return jobs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  /** Live: subscribe to all jobs (admin view). */
  observeJobs(
    onChange: (jobs: Job[]) => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe {
    return observeJobsFromFirestore(onChange, onError);
  },

  /** Live: subscribe to jobs scoped to a single user. */
  observeUserJobs(
    userEmail: string,
    onChange: (jobs: Job[]) => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe {
    const normalizedEmail = userEmail.trim().toLowerCase();
    return observeJobsFromFirestore(
      (jobs) => {
        onChange(
          jobs.filter(
            (job) =>
              !job.userId || job.userId.toLowerCase() === normalizedEmail,
          ),
        );
      },
      onError,
    );
  },

  async getJob(id: string): Promise<Job | undefined> {
    // Firestore rules allow unauthenticated reads — no auth dependency needed.
    ensureFirestoreSchema().catch(() => {});
    const snapshot = await getDoc(jobRef(id));
    if (!snapshot.exists()) return undefined;
    return normalizeJob(snapshot.data() as FirestoreJobData);
  },

  async saveJob(job: Job): Promise<SaveJobResult> {
    // Firestore rules allow unauthenticated writes — no auth dependency needed.
    // Fire schema init in background — non-blocking
    ensureFirestoreSchema().catch(() => {});
    const normalized = normalizeJob(job);
    // Remove undefined values — Firestore rejects them.
    // NOTE: the caller's updatedAt is preserved (NOT replaced with "now") so the
    // server timestamp still reflects when the user actually made the change and
    // can be used for conflict detection below.
    const sanitized = sanitizeForFirestore(normalized);
    const ref = jobRef(normalized.id);
    const snapshotUpdatedAtMs = parseTimestamp(normalized.updatedAt);

    // Add timeout to prevent infinite hanging
    const timeout = new Promise<SaveJobResult>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore write timed out")), 10000),
    );

    // Transaction + timestamp guard: never overwrite a strictly NEWER server
    // copy with an older offline snapshot. This prevents one device/tab from
    // silently wiping changes made on another (the "lost a lot of data" case).
    const write = runTransaction(getFirestoreDb(), async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists()) {
        const serverUpdatedAtMs = parseTimestamp(
          (existing.data() as FirestoreJobData).updatedAt,
        );
        if (snapshotUpdatedAtMs > 0 && serverUpdatedAtMs > snapshotUpdatedAtMs) {
          return { status: "skipped" } as const;
        }
      }
      await tx.set(ref, sanitized);
      return { status: "saved" } as const;
    });

    return Promise.race([write, timeout]);
  },

  async deleteJob(id: string): Promise<void> {
    // Firestore rules allow unauthenticated writes — no auth dependency needed.
    ensureFirestoreSchema().catch(() => {});
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore delete timed out")), 10000),
    );
    await Promise.race([deleteDoc(jobRef(id)), timeout]);
  },

  async exportAllJobs(): Promise<string> {
    const jobs = await this.getAllJobs();
    return JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), jobs },
      null,
      2,
    );
  },

  async importJobs(
    jsonString: string,
  ): Promise<{ imported: number; errors: number }> {
    let imported = 0;
    let errors = 0;

    try {
      // Firestore rules allow unauthenticated writes — no auth dependency needed.
      await ensureFirestoreSchema();
      const data = JSON.parse(jsonString);
      const jobs: FirestoreJobData[] =
        data.jobs || (Array.isArray(data) ? data : []);
      const db = getFirestoreDb();
      let batch = writeBatch(db);
      let queued = 0;

      for (const rawJob of jobs) {
        try {
          const normalized = normalizeJob(rawJob);
          // Remove undefined values — Firestore rejects them
          const sanitized = sanitizeForFirestore({
            ...normalized,
            updatedAt: new Date().toISOString(),
          });
          batch.set(jobRef(normalized.id), sanitized);
          queued++;
          imported++;

          if (queued === 450) {
            await batch.commit();
            batch = writeBatch(db);
            queued = 0;
          }
        } catch {
          errors++;
        }
      }

      if (queued > 0) {
        await batch.commit();
      }
    } catch {
      errors++;
    }

    return { imported, errors };
  },

  // === ARC Collection ===

  async getAllArcItems(): Promise<ArcItem[]> {
    // Firestore rules allow unauthenticated reads — no auth dependency needed.
    ensureFirestoreSchema().catch(() => {});
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTION_ARC));
    return snapshot.docs.map((item) =>
      normalizeArcItem(item.data() as Partial<ArcItem>),
    );
  },

  async saveArcItem(item: ArcItem): Promise<void> {
    // Firestore rules allow unauthenticated writes — no auth dependency needed.
    ensureFirestoreSchema().catch(() => {});
    const normalized = normalizeArcItem(item);
    // Remove undefined values — Firestore rejects them
    const sanitized = sanitizeForFirestore(normalized);
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore write timed out")), 10000),
    );
    await Promise.race([setDoc(arcRef(normalized.id), sanitized), timeout]);
  },

  async deleteArcItem(id: string): Promise<void> {
    // Firestore rules allow unauthenticated writes — no auth dependency needed.
    ensureFirestoreSchema().catch(() => {});
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore delete timed out")), 10000),
    );
    await Promise.race([deleteDoc(arcRef(id)), timeout]);
  },

  async saveAllArcItems(items: ArcItem[]): Promise<void> {
    // Firestore rules allow unauthenticated writes — no auth dependency needed.
    ensureFirestoreSchema().catch(() => {});
    const db = getFirestoreDb();
    const batch = writeBatch(db);
    for (const item of items) {
      const normalized = normalizeArcItem(item);
      // Remove undefined values — Firestore rejects them
      const sanitized = sanitizeForFirestore(normalized);
      batch.set(arcRef(normalized.id), sanitized);
    }
    await batch.commit();
  },
};
