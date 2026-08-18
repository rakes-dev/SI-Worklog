"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/services/firebase";

export const DEFAULT_ADMIN_EMAIL = "rakesh.sardar.12@gmail.com";

export type UserRole = "user" | "admin";

export interface AllowedUser {
  email: string;
  role: UserRole;
  displayName?: string;
  addedBy?: string;
  createdAt?: string;
}

const COLLECTION = "app_users";

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Load the allowlist of users who may sign in. The default admin is always
 * included so the primary admin can never be locked out.
 */
export async function fetchAllowedUsers(): Promise<AllowedUser[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, COLLECTION));
  const users: AllowedUser[] = snap.docs.map((d) => ({
    email: String(d.id).toLowerCase(),
    ...(d.data() as Omit<AllowedUser, "email">),
  }));
  if (!users.some((u) => u.email === DEFAULT_ADMIN_EMAIL)) {
    users.push({ email: DEFAULT_ADMIN_EMAIL, role: "admin" });
  }
  return users;
}

/** Add the given email to the allowlist (admin action). */
export async function addAllowedUser(
  email: string,
  role: UserRole,
  addedBy: string,
): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(
    doc(db, COLLECTION, normEmail(email)),
    {
      email: normEmail(email),
      role,
      displayName: "",
      addedBy,
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

/** Change a user's role (admin action). */
export async function updateAllowedUserRole(
  email: string,
  role: UserRole,
): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, normEmail(email)), { role });
}

/** Remove an email from the allowlist (admin action). */
export async function removeAllowedUser(email: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, normEmail(email)));
}
