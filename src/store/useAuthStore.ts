'use client';

import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  onAuthStateChange,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutUser,
} from '@/services/firebase';
import {
  fetchAllowedUsers,
  DEFAULT_ADMIN_EMAIL,
  type AllowedUser,
  type UserRole,
} from '@/services/auth-users';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

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
  status: 'loading',
  role: null,
  authorized: null,
  allowedUsers: [],
  accessError: null,

  setAuth: async (user) => {
    set({ user, status: user ? 'authenticated' : 'unauthenticated' });
    if (user) {
      await get().refreshAccess();
    } else {
      set({ role: null, authorized: null, allowedUsers: [], accessError: null });
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
      const users = await fetchAllowedUsers();
      const me = users.find((u) => u.email === myEmail);
      set({
        allowedUsers: users,
        role: me?.role ?? null,
        authorized: Boolean(me),
      });
    } catch (error) {
      console.warn('Could not load the access list; defaulting to admin-only access.', error);
      // Safe fallback: only the default admin can use the app when the allowlist
      // cannot be loaded (e.g. Firestore unreachable).
      const isAdmin = myEmail === DEFAULT_ADMIN_EMAIL;
      set({
        allowedUsers: [{ email: DEFAULT_ADMIN_EMAIL, role: 'admin' }],
        role: isAdmin ? 'admin' : null,
        authorized: isAdmin,
        accessError:
          'The access list could not be loaded right now, so only the default admin can sign in.',
      });
    }
  },

  signInGoogle: async () => {
    set({ accessError: null, status: 'loading' });
    try {
      const user = await signInWithGoogle();
      await get().setAuth(user);
    } catch (error) {
      console.error('Google sign-in error:', error);
      set({
        status: 'unauthenticated',
        accessError:
          'Google sign-in failed. Make sure the Google provider is enabled and the current origin is an authorized domain in Firebase Authentication.',
      });
    }
  },

  signInEmail: async (email, password) => {
    set({ accessError: null, status: 'loading' });
    try {
      const user = await signInWithEmailPassword(email, password);
      await get().setAuth(user);
    } catch (error) {
      console.error('Email/password sign-in error:', error);
      set({
        status: 'unauthenticated',
        accessError: 'Invalid email or password, or this account is not registered.',
      });
    }
  },

  logOut: async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
    set({ user: null, status: 'unauthenticated', role: null, authorized: null, allowedUsers: [], accessError: null });
  },
}));

// Subscribe once (client only) so refresh/token changes stay in sync.
if (typeof window !== 'undefined' && !listenerStarted) {
  listenerStarted = true;
  onAuthStateChange((user) => {
    useAuthStore.getState().setAuth(user);
  });
}