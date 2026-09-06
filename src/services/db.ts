"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/services/firebase";
import {
  SEED_CATEGORIES,
  SEED_SITES,
  slugify,
} from "@/constants/seed";
import type {
  ArcItem,
  FormType,
  MeasurementRow,
  Site,
  SignatureEntry,
  SummaryRow,
  WorkCategory,
  WorkForm,
} from "@/types";
import {
  calcGrandTotal,
  calcMeasurementRow,
  calcSummaryRow,
  calcTotalArea,
  currentMonth,
  defaultForm,
  defaultMeasurementRow,
  defaultSignatures,
  defaultSummaryRow,
  generateId,
} from "@/utils/helpers";

const COLLECTION_FORMS = "forms";
const COLLECTION_SITES = "sites";
const COLLECTION_CATEGORIES = "categories";
const COLLECTION_ARC = "arc";

/** Outcome of pushing the structure blueprint (sites + categories). */
export interface SeedResult {
  sitesCreated: number;
  categoriesCreated: number;
  /** Human-readable reason for every document that could not be written. */
  failures: string[];
}

// ---------------------------------------------------------------------------
// Coercion helpers (shared with the legacy normalizer behaviour)
// ---------------------------------------------------------------------------

function isFormType(value: unknown): value is FormType {
  return value === "painting" || value === "carpenter";
}

function coerceString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function coerceRequiredString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

// coat is a string now but legacy docs may hold a number — preserve it.
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

function coerceBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normEmail(value: unknown): string {
  return coerceString(value).trim().toLowerCase();
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

/** Build a fully-formed, calculation-consistent WorkForm from raw Firestore data. */
export function normalizeWorkForm(value: Partial<WorkForm> | undefined): WorkForm {
  const siteName = coerceString(value?.siteName);
  const fallback = defaultForm(siteName || "Form", coerceNumber(value?.sheetNo, 1));

  const summaryRows = Array.isArray(value?.summaryRows)
    ? value!.summaryRows.map((row, i) => normalizeSummaryRow(row, i))
    : fallback.summaryRows;
  const measurementRows = Array.isArray(value?.measurementRows)
    ? value!.measurementRows.map((row, i) => normalizeMeasurementRow(row, i))
    : fallback.measurementRows;
  const signatures = value?.signatures
    ? {
        standardInterior: normalizeSignatureEntry(
          value.signatures.standardInterior,
        ),
        requestedBy: normalizeSignatureEntry(value.signatures.requestedBy),
        qualityCheckHK: normalizeSignatureEntry(value.signatures.qualityCheckHK),
        qualityCheckEngg: normalizeSignatureEntry(
          value.signatures.qualityCheckEngg,
        ),
        measurementCheck: normalizeSignatureEntry(
          value.signatures.measurementCheck,
        ),
      }
    : defaultSignatures();

  const form: WorkForm = {
    ...fallback,
    ...value,
    id: coerceRequiredString(value?.id, generateId("form")),
    formName: coerceString(value?.formName, fallback.formName),
    formType: isFormType(value?.formType) ? value!.formType : "painting",
    suitPublicAreaName: coerceString(value?.suitPublicAreaName),
    date: coerceString(value?.date, fallback.date),
    workStartDate: coerceString(value?.workStartDate),
    workEndDate: coerceString(value?.workEndDate),
    submittedToOffice: coerceString(value?.submittedToOffice),
    delay: coerceString(value?.delay),
    totalSheets: coerceNumber(value?.totalSheets, fallback.totalSheets),
    sheetNo: coerceNumber(value?.sheetNo, 1),
    summaryRows,
    grandTotal: 0,
    measurementRows,
    totalArea: 0,
    signatures,
    // Links + denormalized fields (the new part):
    month: coerceString(value?.month, currentMonth()),
    siteId: coerceString(value?.siteId),
    categoryId: coerceString(value?.categoryId),
    ownerEmail: normEmail(value?.ownerEmail),
    siteName,
    siteAddress: coerceString(value?.siteAddress),
    empName: coerceString(value?.empName),
    isDeleted: value?.isDeleted === true,
    deletedAt: coerceString(value?.deletedAt),
    createdAt: coerceString(value?.createdAt, fallback.createdAt),
    updatedAt: coerceString(value?.updatedAt, fallback.updatedAt),
  };

  form.grandTotal = calcGrandTotal(form.summaryRows);
  form.totalArea = calcTotalArea(form.measurementRows);
  return form;
}

function normalizeSite(value: Partial<Site> | undefined, id: string): Site {
  const now = new Date().toISOString();
  return {
    id: coerceRequiredString(value?.id, id),
    name: coerceString(value?.name),
    address: coerceString(value?.address),
    order: coerceNumber(value?.order, 0),
    isActive: coerceBool(value?.isActive, true),
    createdAt: coerceString(value?.createdAt, now),
    updatedAt: coerceString(value?.updatedAt, now),
  };
}

function normalizeCategory(
  value: Partial<WorkCategory> | undefined,
  id: string,
): WorkCategory {
  const now = new Date().toISOString();
  return {
    id: coerceRequiredString(value?.id, id),
    name: coerceString(value?.name),
    defaultFormType: isFormType(value?.defaultFormType)
      ? value!.defaultFormType
      : "painting",
    order: coerceNumber(value?.order, 0),
    isActive: coerceBool(value?.isActive, true),
    createdAt: coerceString(value?.createdAt, now),
    updatedAt: coerceString(value?.updatedAt, now),
  };
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

/**
 * Recursively strip `undefined` — Firestore rejects undefined field values.
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
      if (val !== undefined) result[key] = sanitizeForFirestore(val);
    }
    return result as T;
  }
  return value;
}

function formRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_FORMS, id);
}
function siteRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_SITES, id);
}
function categoryRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_CATEGORIES, id);
}
function arcRef(id: string) {
  return doc(getFirestoreDb(), COLLECTION_ARC, id);
}

function sortByCreatedDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
function sortByOrder<T extends { order: number; name: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
}

const WRITE_TIMEOUT_MS = 15000; // single-doc writes (autosave, saves, deletes)
const READ_TIMEOUT_MS = 20000; // blueprint existence checks
const SEED_WRITE_TIMEOUT_MS = 45000; // blueprint writes get extra headroom

function withTimeout<T>(
  work: Promise<T>,
  label: string,
  ms: number = WRITE_TIMEOUT_MS,
): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    ),
  );
  return Promise.race([work, timeout]);
}

/** Human-readable one-liner for a Firestore/unknown error (code + message). */
export function describeError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    const message = (error as { message?: unknown }).message;
    const parts = [
      typeof code === "string" && code ? code : "",
      typeof message === "string" && message ? message.trim() : "",
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
  }
  return String(error);
}

export const dbService = {
  // === FORMS ===================================================

  /** Live subscription to every form (admin view). */
  observeForms(
    onChange: (forms: WorkForm[]) => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe {
    const db = getFirestoreDb();
    return onSnapshot(
      collection(db, COLLECTION_FORMS),
      (snap) =>
        onChange(
          sortByCreatedDesc(
            snap.docs.map((d) =>
              normalizeWorkForm(d.data() as Partial<WorkForm>),
            ),
          ),
        ),
      (error) => {
        console.warn("Live form sync unavailable.", error);
        onError?.(error);
      },
    );
  },

  /** Live subscription to forms owned by a single user. */
  observeUserForms(
    userEmail: string,
    onChange: (forms: WorkForm[]) => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION_FORMS),
      where("ownerEmail", "==", userEmail.trim().toLowerCase()),
    );
    return onSnapshot(
      q,
      (snap) =>
        onChange(
          sortByCreatedDesc(
            snap.docs.map((d) =>
              normalizeWorkForm(d.data() as Partial<WorkForm>),
            ),
          ),
        ),
      (error) => {
        console.warn("Live form sync unavailable.", error);
        onError?.(error);
      },
    );
  },

  async getForm(id: string): Promise<WorkForm | undefined> {
    const snap = await getDoc(formRef(id));
    if (!snap.exists()) return undefined;
    return normalizeWorkForm(snap.data() as Partial<WorkForm>);
  },

  /**
   * Save a single form. Each form is its own document, so a write can never
   * clobber a different form. `setDoc` also queues automatically while offline
   * and replays on reconnect (Firestore's built-in per-document sync).
   */
  async saveForm(form: WorkForm): Promise<void> {
    const normalized = normalizeWorkForm(form);
    const sanitized = sanitizeForFirestore(normalized);
    await withTimeout(
      setDoc(formRef(normalized.id), sanitized),
      "Form save",
    );
  },

  /** Permanently remove a form document (used only from the trash). */
  async deleteFormDoc(id: string): Promise<void> {
    await withTimeout(deleteDoc(formRef(id)), "Form delete");
  },

  /** Admin backup: export every form as JSON. */
  async exportAllForms(): Promise<string> {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTION_FORMS));
    const forms = snap.docs.map((d) =>
      normalizeWorkForm(d.data() as Partial<WorkForm>),
    );
    return JSON.stringify(
      { version: 2, exportedAt: new Date().toISOString(), forms },
      null,
      2,
    );
  },

  /**
   * Restore forms from a JSON file produced by {@link exportAllForms} (or a
   * plain array of form documents). Idempotent per document id — existing
   * forms are overwritten with the imported copy (same shape as a manual save).
   */
  async importForms(text: string): Promise<{ imported: number; errors: number }> {
    const parsed = JSON.parse(text) as unknown;
    const rawList = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { forms?: unknown[] })?.forms)
        ? (parsed as { forms: unknown[] }).forms
        : null;
    if (!rawList) throw new Error("Not a valid form backup file.");
    const now = new Date().toISOString();
    let imported = 0;
    let errors = 0;
    const db = getFirestoreDb();
    const batch = writeBatch(db);
    for (const raw of rawList) {
      try {
        const norm = normalizeWorkForm(raw as Partial<WorkForm>);
        if (!norm.id || !norm.ownerEmail) throw new Error("missing owner/id");
        const doc = { ...sanitizeForFirestore(norm), updatedAt: now };
        batch.set(formRef(norm.id), doc);
        imported += 1;
        // Batches cap at 500 writes — flush and start a fresh batch.
        if (imported % 400 === 0) {
          await withTimeout(batch.commit(), "Form import");
        }
      } catch {
        errors += 1;
      }
    }
    if (imported % 400 !== 0 && imported > 0) {
      await withTimeout(batch.commit(), "Form import");
    }
    return { imported, errors };
  },

  /**
   * Migrate the legacy `jobs` collection (job docs each containing a `forms`
   * array) into the new per-form `forms` collection. The source documents are
   * never modified — it is a pure read + write of new docs. Site and category
   * are matched best-effort by name/type; anything unmatched keeps its original
   * site name (as a fallback site field) for re-filing from Admin.
   */
  async migrateLegacyJobs(): Promise<{
    migrated: number;
    skipped: number;
    totalForms: number;
  }> {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, "jobs"));
    const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>);
    const sites = await this.getSites();
    const categories = await this.getCategories();

    const now = new Date().toISOString();
    let migrated = 0;
    let skipped = 0;
    let totalForms = 0;
    const batch = writeBatch(db);

    for (const job of jobs) {
      const jobId = coerceString(job.id);
      if (job.isDeleted === true) skipped += 1;
      const forms = Array.isArray(job.forms) ? (job.forms as unknown[]) : [];
      for (const rawForm of forms) {
        const legacy = (rawForm as Record<string, unknown>) ?? {};
        // Legacy forms already migrated carry a marker — skip re-migrating.
        if (legacy.__migrated === true) continue;

        const siteName = coerceString(job.siteName);
        const site = sites.find(
          (s) => slugify(s.name) === slugify(siteName),
        );
        const formType = isFormType(legacy.formType)
          ? legacy.formType
          : "painting";
        // Best-effort category: carpenter-type forms go to Carpentry – Room,
        // everything else to Public Area; the legacy `jobs` docs remain intact
        // as the reference copy.
        const category =
          formType === "carpenter"
            ? categories.find((c) => slugify(c.name) === "carpentry-room")
            : categories.find((c) => slugify(c.name) === "public-area");

        const partial: Partial<WorkForm> = {
          ...(legacy as Partial<WorkForm>),
          id: coerceRequiredString(legacy.id, generateId("form")),
          formType,
          siteId: site?.id ?? coerceString(job.siteId) ?? "",
          categoryId: category?.id ?? "",
          ownerEmail: normEmail(job.userId),
          siteName: site?.name ?? siteName,
          siteAddress: coerceString(job.siteAddress),
          empName: coerceString(job.empName),
          isDeleted: legacy.isDeleted === true,
          deletedAt: coerceString(legacy.deletedAt),
          createdAt: coerceString(legacy.createdAt) || now,
          updatedAt: now,
        };
        const norm = normalizeWorkForm(partial);
        norm.__migrated = true;
        batch.set(formRef(norm.id), sanitizeForFirestore(norm));
        migrated += 1;
        totalForms += 1;
        if (migrated % 400 === 0) {
          await withTimeout(batch.commit(), "Legacy migration");
        }
      }
    }

    if (migrated % 400 !== 0 && migrated > 0) {
      await withTimeout(batch.commit(), "Legacy migration");
    }
    return { migrated, skipped, totalForms };
  },

  // === SITES ===================================================

  observeSites(
    onChange: (sites: Site[]) => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe {
    const db = getFirestoreDb();
    return onSnapshot(
      collection(db, COLLECTION_SITES),
      (snap) =>
        onChange(
          sortByOrder(snap.docs.map((d) => normalizeSite(d.data(), d.id))),
        ),
      (error) => {
        console.warn("Live site sync unavailable.", error);
        onError?.(error);
      },
    );
  },

  async getSites(): Promise<Site[]> {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTION_SITES));
    return sortByOrder(snap.docs.map((d) => normalizeSite(d.data(), d.id)));
  },

  async saveSite(site: Site): Promise<void> {
    const sanitized = sanitizeForFirestore(site);
    await withTimeout(setDoc(siteRef(site.id), sanitized), "Site save");
  },

  async deleteSiteDoc(id: string): Promise<void> {
    await withTimeout(deleteDoc(siteRef(id)), "Site delete");
  },

  // === CATEGORIES ==============================================

  observeCategories(
    onChange: (categories: WorkCategory[]) => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe {
    const db = getFirestoreDb();
    return onSnapshot(
      collection(db, COLLECTION_CATEGORIES),
      (snap) =>
        onChange(
          sortByOrder(snap.docs.map((d) => normalizeCategory(d.data(), d.id))),
        ),
      (error) => {
        console.warn("Live category sync unavailable.", error);
        onError?.(error);
      },
    );
  },

  async getCategories(): Promise<WorkCategory[]> {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTION_CATEGORIES));
    return sortByOrder(snap.docs.map((d) => normalizeCategory(d.data(), d.id)));
  },

  async saveCategory(category: WorkCategory): Promise<void> {
    const sanitized = sanitizeForFirestore(category);
    await withTimeout(
      setDoc(categoryRef(category.id), sanitized),
      "Category save",
    );
  },

  async deleteCategoryDoc(id: string): Promise<void> {
    await withTimeout(deleteDoc(categoryRef(id)), "Category delete");
  },

  // === SEED ====================================================

  /**
   * Push the structure blueprint (2 default sites + 7 work categories).
   * Idempotent: existing docs (and any admin edits to them, like addresses)
   * are left untouched. Admin-only per security rules.
   *
   * Reliability: every document is written INDIVIDUALLY — never one big batch —
   * so one slow/failed write can never hold the other nine hostage. Each write
   * gets a generous timeout plus one automatic retry (safe because blueprint
   * ids are deterministic slugs), and partial failures are reported back with
   * the real Firestore error instead of a single opaque "timed out".
   */
  async seedDefaults(): Promise<SeedResult> {
    const db = getFirestoreDb();
    const now = new Date().toISOString();
    let sitesCreated = 0;
    let categoriesCreated = 0;
    const failures: string[] = [];

    // 1. Read what already exists so admin-edited docs are never overwritten.
    let readsFailed = false;
    let siteIds = new Set<string>();
    let categoryIds = new Set<string>();
    try {
      const [existingSites, existingCategories] = await Promise.all([
        withTimeout(
          getDocs(collection(db, COLLECTION_SITES)),
          "Blueprint read (sites)",
          READ_TIMEOUT_MS,
        ),
        withTimeout(
          getDocs(collection(db, COLLECTION_CATEGORIES)),
          "Blueprint read (categories)",
          READ_TIMEOUT_MS,
        ),
      ]);
      siteIds = new Set(existingSites.docs.map((d) => d.id));
      categoryIds = new Set(existingCategories.docs.map((d) => d.id));
    } catch (readError) {
      // The database may be mid-clear or the network flaky. Fall through and
      // use merge:true writes, which are safe even if a doc already exists.
      readsFailed = true;
      console.warn(
        "Blueprint existence check failed — writing with merge instead.",
        readError,
      );
    }

    // 2. Ensure one document, with one automatic retry (idempotent slug ids).
    const ensureDoc = async (
      label: string,
      ref: DocumentReference,
      data: Record<string, unknown>,
      merge: boolean,
    ): Promise<void> => {
      const attempt = () =>
        merge ? setDoc(ref, data, { merge: true }) : setDoc(ref, data);
      try {
        await withTimeout(attempt(), `${label} write`, SEED_WRITE_TIMEOUT_MS);
      } catch {
        await withTimeout(
          attempt(),
          `${label} write (retry)`,
          SEED_WRITE_TIMEOUT_MS,
        );
      }
    };

    const jobs: Promise<void>[] = [];

    SEED_SITES.forEach((seed, index) => {
      const id = slugify(seed.name);
      if (!readsFailed && siteIds.has(id)) return;
      const site: Site = {
        id,
        name: seed.name,
        address: seed.address,
        order: index,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      jobs.push(
        ensureDoc(
          `site "${seed.name}"`,
          siteRef(id),
          sanitizeForFirestore(site) as unknown as Record<string, unknown>,
          readsFailed,
        )
          .then(() => {
            sitesCreated += 1;
          })
          .catch((error: unknown) => {
            failures.push(`${seed.name}: ${describeError(error)}`);
          }),
      );
    });

    SEED_CATEGORIES.forEach((seed, index) => {
      const id = slugify(seed.name);
      if (!readsFailed && categoryIds.has(id)) return;
      const category: WorkCategory = {
        id,
        name: seed.name,
        defaultFormType: seed.defaultFormType,
        order: index,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      jobs.push(
        ensureDoc(
          `category "${seed.name}"`,
          categoryRef(id),
          sanitizeForFirestore(category) as unknown as Record<string, unknown>,
          readsFailed,
        )
          .then(() => {
            categoriesCreated += 1;
          })
          .catch((error: unknown) => {
            failures.push(`${seed.name}: ${describeError(error)}`);
          }),
      );
    });

    await Promise.all(jobs);
    return { sitesCreated, categoriesCreated, failures };
  },

  // === ARC (rate card) — unchanged behaviour ===================

  async getAllArcItems(): Promise<ArcItem[]> {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, COLLECTION_ARC));
    return snapshot.docs.map((item) =>
      normalizeArcItem(item.data() as Partial<ArcItem>),
    );
  },

  async saveArcItem(item: ArcItem): Promise<void> {
    const normalized = normalizeArcItem(item);
    const sanitized = sanitizeForFirestore(normalized);
    await withTimeout(setDoc(arcRef(normalized.id), sanitized), "ARC save");
  },

  async deleteArcItem(id: string): Promise<void> {
    await withTimeout(deleteDoc(arcRef(id)), "ARC delete");
  },

  async saveAllArcItems(items: ArcItem[]): Promise<void> {
    const db = getFirestoreDb();
    const batch = writeBatch(db);
    for (const item of items) {
      const normalized = normalizeArcItem(item);
      batch.set(arcRef(normalized.id), sanitizeForFirestore(normalized));
    }
    await withTimeout(batch.commit(), "ARC bulk save");
  },
};
