"use client";

import { create } from "zustand";
import type { User } from "firebase/auth";
import {
  onAuthStateChange,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
} from "@/services/firebase";
import {
  fetchMyUser,
  type AllowedUser,
  type UserRole,
} from "@/services/auth-users";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: User | null;
  status: AuthStatus;
  /** Role within the allowlist — null while deciding / unknown. */
  role: UserRole | null;
  /** true if the signed-in email is in the allowlist; null while deciding. */
  authorized: boolean | null;
  allowedUsers: AllowedUser[];
  accessError: string | null;
  setAuth: (user: User | null) => Promise<void>;
  refreshAccess: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

let listenerStarted = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "loading",
  role: null,
  authorized: null,
  allowedUsers: [],
  accessError: null,

  setAuth: async (user) => {
    set({ user, status: user ? "authenticated" : "unauthenticated" });
    if (user) {
      await get().refreshAccess();
    } else {
      set({
        role: null,
        authorized: null,
        allowedUsers: [],
        accessError: null,
      });
    }
  },

  refreshAccess: async () => {
    const user = get().user;
    if (!user?.email) {
      set({ role: null, authorized: false, accessError: null });
      return;
    }
    set({ accessError: null });
    const myEmail = user.email.trim().toLowerCase();
    try {
      // Read ONLY our own allowlist record — this is all the security rules let
      // a non-admin read. Admin surfaces load the full list separately.
      const me = await fetchMyUser(myEmail);
      set({
        allowedUsers: me ? [me] : [],
        role: me?.role ?? null,
        authorized: Boolean(me),
        accessError: null,
      });

      // EVENT-DRIVEN live-sync bridge: on a cold page reload, AppLayout's
      // effects can fire before Firebase restores the session / the allowlist
      // read settles. Now that the role is known, bind the Firestore listeners
      // directly — this closes that race. (Dynamic import avoids a static
      // module cycle between the two stores.)
      void import("@/store/useAppStore").then(({ useAppStore }) => {
        useAppStore.getState().startLiveSync();
      });
    } catch (error) {
      // The read failed for CONNECTIVITY reasons (the answer is unknown, not
      // "unauthorized"). Keep the gate OPEN while the app stays usable; the
      // security rules still protect all data server-side.
      console.warn(
        "Could not load your access record; opening the app with limited role info until the connection returns.",
        error,
      );
      set({
        allowedUsers: [],
        role: null,
        authorized: null,
        accessError:
          "Connection to the database was lost. You can keep using the app — everything syncs automatically once you're back online.",
      });
    }
  },

  signInGoogle: async () => {
    set({ accessError: null, status: "loading" });
    try {
      const user = await signInWithGoogle();
      await get().setAuth(user);
    } catch (error) {
      console.error("Google sign-in error:", error);
      set({
        status: "unauthenticated",
        accessError:
          "Google sign-in failed. Make sure the Google provider is enabled and the current origin is an authorized domain in Firebase Authentication.",
      });
    }
  },

  signInEmail: async (email, password) => {
    set({ accessError: null, status: "loading" });
    try {
      const user = await signInWithEmailPassword(email, password);
      await get().setAuth(user);
    } catch (error) {
      console.error("Email/password sign-in error:", error);
      set({
        status: "unauthenticated",
        accessError:
          "Invalid email or password, or this account is not registered.",
      });
    }
  },

  logOut: async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Sign out error:", error);
    }
    set({
      user: null,
      status: "unauthenticated",
      role: null,
      authorized: null,
      allowedUsers: [],
      accessError: null,
    });
  },
}));

// Subscribe once (client only) so refresh/token changes stay in sync.
if (typeof window !== "undefined" && !listenerStarted) {
  listenerStarted = true;
  onAuthStateChange((user) => {
    useAuthStore.getState().setAuth(user);
  });
}
