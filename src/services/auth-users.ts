"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/services/firebase";

export type UserRole = "user" | "admin" | "admin_viewer";

export interface AllowedUser {
  email: string;
  role: UserRole;
  assignedSiteIds?: string[];
  displayName?: string;
  addedBy?: string;
  createdAt?: string;
}

const COLLECTION = "app_users";

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeAssignedSiteIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function normalizeAllowedUser(record: AllowedUser): AllowedUser {
  return {
    ...record,
    assignedSiteIds: normalizeAssignedSiteIds(record.assignedSiteIds),
  };
}

/**
 * Small sequential retry for Firestore calls. The client can briefly report
 * "offline" (proxies/ISPs kill the channel with 408s) — a couple of short
 * retries turns those blips into non-events. Reads are always safe to retry,
 * and the writes here are idempotent (setDoc/merge with deterministic ids).
 */
const RETRY_DELAYS_MS = [0, 1200, 3000];

async function withRetry<T>(work: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      return await work();
    } catch (error) {
      lastError = error;
      console.warn(
        `${label} failed (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length}).`,
        error,
      );
    }
  }
  throw lastError;
}

/**
 * Load the allowlist of users who may sign in. The default admin is always
 * included so the primary admin can never be locked out.
 *
 * NOTE: under the security rules only an admin can read the whole `app_users`
 * collection. Regular users must use {@link fetchMyUser} to read just their own
 * record. Call this only from admin surfaces (e.g. User Management).
 */
export async function fetchAllowedUsers(): Promise<AllowedUser[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Offline: cannot read allowlist while offline");
  }
  const db = getFirestoreDb();
  const snap = await withRetry(
    () => getDocs(collection(db, COLLECTION)),
    "Allowlist read",
  );
  return snap.docs.map((d) =>
    normalizeAllowedUser({
      email: String(d.id).toLowerCase(),
      ...(d.data() as Omit<AllowedUser, "email">),
    }),
  );
}

/**
 * Read only the signed-in user's own allowlist record — this is what every
 * user is permitted to read under the security rules. Returns null if the user
 * is not on the allowlist (the default admin is always treated as admin, even
 * without a stored record, so it can never be locked out).
 */
export async function fetchMyUser(email: string): Promise<AllowedUser | null> {
  const norm = normEmail(email);
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.warn("Offline: cannot read access record while offline.");
      throw new Error("Offline: access unknown until connection returns");
    }
    const db = getFirestoreDb();
    const snap = await withRetry(
      () => getDoc(doc(db, COLLECTION, norm)),
      "Access record read",
    );
    if (snap.exists()) {
      return normalizeAllowedUser({
        email: norm,
        ...(snap.data() as Omit<AllowedUser, "email">),
      });
    }
    // The server answered definitively: this email is not on the allowlist.
    return null;
  } catch (error) {
    // We could NOT reach the server — the answer is unknown, NOT "unauthorized".
    // Throw so the caller can keep the app open with `authorized: null` until
    // the connection returns. The security rules still protect all data
    // server-side, and reads simply stay empty until the connection returns.
    console.warn("Could not read your access record (connectivity).", error);
    throw error;
  }
}

/** Add the given email to the allowlist (admin action). */
export async function addAllowedUser(
  email: string,
  role: UserRole,
  addedBy: string,
  assignedSiteIds: string[] = [],
): Promise<void> {
  const db = getFirestoreDb();
  const normalizedAssignedSiteIds = normalizeAssignedSiteIds(assignedSiteIds);
  await withRetry(
    () =>
      setDoc(
        doc(db, COLLECTION, normEmail(email)),
        {
          email: normEmail(email),
          role,
          assignedSiteIds: normalizedAssignedSiteIds,
          displayName: "",
          addedBy,
          createdAt: new Date().toISOString(),
        },
        { merge: true },
      ),
    "Add user write",
  );
}

/** Change a user's role (admin action). */
export async function updateAllowedUserRole(
  email: string,
  role: UserRole,
): Promise<void> {
  const db = getFirestoreDb();
  // setDoc+merge (not updateDoc) so it also works if the doc is missing.
  await withRetry(
    () =>
      setDoc(doc(db, COLLECTION, normEmail(email)), { role }, { merge: true }),
    "Role update write",
  );
}

/** Update a user's assigned site ids (admin action). */
export async function updateAllowedUserAssignedSites(
  email: string,
  assignedSiteIds: string[],
): Promise<void> {
  const db = getFirestoreDb();
  await withRetry(
    () =>
      setDoc(
        doc(db, COLLECTION, normEmail(email)),
        { assignedSiteIds: normalizeAssignedSiteIds(assignedSiteIds) },
        { merge: true },
      ),
    "Assigned sites update write",
  );
}

/** Remove an email from the allowlist (admin action). */
export async function removeAllowedUser(email: string): Promise<void> {
  const db = getFirestoreDb();
  await withRetry(
    () => deleteDoc(doc(db, COLLECTION, normEmail(email))),
    "Remove user write",
  );
}
