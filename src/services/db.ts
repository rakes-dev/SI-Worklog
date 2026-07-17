import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFirestoreDb } from '@/services/firebase';
import { ensureFirestoreSchema } from '@/services/firestore-schema';
import type { ArcItem, Job, JobStatus, MeasurementRow, PaintForm, SignatureEntry, SummaryRow } from '@/types';
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
} from '@/utils/helpers';

const COLLECTION_JOBS = 'jobs';
const COLLECTION_ARC = 'arc';

type FirestoreJobData = Partial<Job> & {
  forms?: Array<Partial<PaintForm>>;
};

function isJobStatus(value: unknown): value is JobStatus {
  return value === 'Draft' || value === 'Pending' || value === 'Approved';
}

function coerceString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function coerceRequiredString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

function coerceNumberOrEmpty(value: unknown): number | '' {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : '';
  }
  return '';
}

function coerceNumber(value: unknown, fallback = 0): number {
  const normalized = coerceNumberOrEmpty(value);
  return typeof normalized === 'number' ? normalized : fallback;
}

function normalizeSignatureEntry(value: Partial<SignatureEntry> | undefined): SignatureEntry {
  return {
    signature: coerceString(value?.signature),
    name: coerceString(value?.name),
    date: coerceString(value?.date),
  };
}

function normalizeSummaryRow(value: Partial<SummaryRow> | undefined, index: number): SummaryRow {
  const fallback = defaultSummaryRow(index + 1);
  const row: SummaryRow = {
    ...fallback,
    id: coerceRequiredString(value?.id, generateId('sr')),
    slNo: coerceNumber(value?.slNo, index + 1),
    complaintSource: coerceString(value?.complaintSource, fallback.complaintSource),
    paintType: coerceString(value?.paintType),
    coat: coerceString(value?.coat),
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
  index: number
): MeasurementRow {
  const fallback = defaultMeasurementRow(index + 1);
  const row: MeasurementRow = {
    ...fallback,
    id: coerceRequiredString(value?.id, generateId('mr')),
    slNo: coerceNumber(value?.slNo, index + 1),
    jobType: coerceString(value?.jobType),
    location: coerceString(value?.location),
    coat: coerceString(value?.coat),
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
  jobName: string
): PaintForm {
  const fallback = defaultForm(jobName || 'New Job', index + 1);
  const summaryRows = Array.isArray(value?.summaryRows)
    ? value.summaryRows.map((row, rowIndex) => normalizeSummaryRow(row, rowIndex))
    : fallback.summaryRows;
  const measurementRows = Array.isArray(value?.measurementRows)
    ? value.measurementRows.map((row, rowIndex) => normalizeMeasurementRow(row, rowIndex))
    : fallback.measurementRows;
  const signatures = value?.signatures
    ? {
        standardInterior: normalizeSignatureEntry(value.signatures.standardInterior),
        requestedBy: normalizeSignatureEntry(value.signatures.requestedBy),
        qualityCheckHK: normalizeSignatureEntry(value.signatures.qualityCheckHK),
        qualityCheckEngg: normalizeSignatureEntry(value.signatures.qualityCheckEngg),
        measurementCheck: normalizeSignatureEntry(value.signatures.measurementCheck),
      }
    : defaultSignatures();

  const form: PaintForm = {
    ...fallback,
    ...value,
    id: coerceRequiredString(value?.id, generateId('form')),
    formName: coerceString(value?.formName, fallback.formName),
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
    ? value.forms.map((form, index) => normalizePaintForm(form, index, coerceString(value.jobName)))
    : [];
  const job: Job = {
    ...fallback,
    ...value,
    id: coerceRequiredString(value.id, fallback.id),
    jobName: coerceString(value.jobName),
    clientName: coerceString(value.clientName),
    siteAddress: coerceString(value.siteAddress),
    workStartDate: coerceString(value.workStartDate, fallback.workStartDate),
    workEndDate: coerceString(value.workEndDate),
    submittedToOffice: coerceString(value.submittedToOffice),
    delay: coerceString(value.delay),
    remarks: coerceString(value.remarks),
    status: isJobStatus(value.status) ? value.status : 'Draft',
    forms,
    totalAmount: 0,
    createdAt: coerceString(value.createdAt, fallback.createdAt),
    updatedAt: coerceString(value.updatedAt, fallback.updatedAt),
  };

  job.totalAmount = job.forms.reduce((sum, form) => sum + (form.grandTotal || 0), 0);
  return job;
}

function jobRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_JOBS, id);
}

function arcRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_ARC, id);
}

function normalizeArcItem(value: Partial<ArcItem>): ArcItem {
  return {
    id: coerceRequiredString(value.id, generateId('arc')),
    arc_no: coerceString(value.arc_no),
    coat: coerceNumberOrEmpty(value.coat),
    description: coerceString(value.description),
    final_rate: coerceNumberOrEmpty(value.final_rate),
    uom: coerceString(value.uom),
    job_type: coerceString(value.job_type),
  };
}

async function getAllJobsFromFirestore(): Promise<Job[]> {
  ensureFirestoreSchema().catch(() => {});
  const db = getFirestoreDb();
  const snapshot = await getDocs(collection(db, COLLECTION_JOBS));
  return snapshot.docs.map((item) => normalizeJob(item.data() as FirestoreJobData));
}

export const dbService = {
  ensureSchema: ensureFirestoreSchema,

  async getAllJobs(): Promise<Job[]> {
    const jobs = await getAllJobsFromFirestore();
    return jobs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getJob(id: string): Promise<Job | undefined> {
    ensureFirestoreSchema().catch(() => {});
    const snapshot = await getDoc(jobRef(id));
    if (!snapshot.exists()) return undefined;
    return normalizeJob(snapshot.data() as FirestoreJobData);
  },

  async saveJob(job: Job): Promise<void> {
    // Fire schema init in background — non-blocking
    ensureFirestoreSchema().catch(() => {});
    const normalized = normalizeJob(job);
    // Add timeout to prevent infinite hanging
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore write timed out')), 10000)
    );
    await Promise.race([
      setDoc(jobRef(normalized.id), {
        ...normalized,
        updatedAt: new Date().toISOString(),
      }),
      timeout,
    ]);
  },

  async deleteJob(id: string): Promise<void> {
    ensureFirestoreSchema().catch(() => {});
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore delete timed out')), 10000)
    );
    await Promise.race([
      deleteDoc(jobRef(id)),
      timeout,
    ]);
  },

  async exportAllJobs(): Promise<string> {
    const jobs = await this.getAllJobs();
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), jobs }, null, 2);
  },

  async importJobs(jsonString: string): Promise<{ imported: number; errors: number }> {
    let imported = 0;
    let errors = 0;

    try {
      await ensureFirestoreSchema();
      const data = JSON.parse(jsonString);
      const jobs: FirestoreJobData[] = data.jobs || (Array.isArray(data) ? data : []);
      const db = getFirestoreDb();
      let batch = writeBatch(db);
      let queued = 0;

      for (const rawJob of jobs) {
        try {
          const normalized = normalizeJob(rawJob);
          batch.set(jobRef(normalized.id), {
            ...normalized,
            updatedAt: new Date().toISOString(),
          });
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
    ensureFirestoreSchema().catch(() => {});
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTION_ARC));
    return snapshot.docs.map((item) => normalizeArcItem(item.data() as Partial<ArcItem>));
  },

  async saveArcItem(item: ArcItem): Promise<void> {
    ensureFirestoreSchema().catch(() => {});
    const normalized = normalizeArcItem(item);
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore write timed out')), 10000)
    );
    await Promise.race([
      setDoc(arcRef(normalized.id), {
        ...normalized,
      }),
      timeout,
    ]);
  },

  async deleteArcItem(id: string): Promise<void> {
    ensureFirestoreSchema().catch(() => {});
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore delete timed out')), 10000)
    );
    await Promise.race([deleteDoc(arcRef(id)), timeout]);
  },

  async saveAllArcItems(items: ArcItem[]): Promise<void> {
    ensureFirestoreSchema().catch(() => {});
    const db = getFirestoreDb();
    const batch = writeBatch(db);
    for (const item of items) {
      const normalized = normalizeArcItem(item);
      batch.set(arcRef(normalized.id), { ...normalized });
    }
    await batch.commit();
  },
};