import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeGoogleAuthPlugin {
  signIn(options?: { webClientId?: string }): Promise<{
    idToken?: string;
    serverAuthCode?: string;
    email: string;
    displayName?: string;
    id?: string;
    photoUrl?: string;
  }>;
  signOut(): Promise<void>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth");

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let authBootstrapPromise: Promise<void> | null = null;

function readFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  };
}

function validateFirebaseConfig(config: FirebaseConfig): void {
  const requiredKeys: (keyof FirebaseConfig)[] = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];
  const missing = requiredKeys.filter((key) => !config[key]);
  if (missing.length > 0) {
    const msg = `Missing Firebase env vars: ${missing
      .map((key) =>
        `NEXT_PUBLIC_FIREBASE_${String(key)
          .replace(/[A-Z]/g, (m) => `_${m}`)
          .toUpperCase()}`,
      )
      .join(", ")}`;
    if (typeof window === "undefined") {
      throw new Error(msg);
    }
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  const config = readFirebaseConfig();
  validateFirebaseConfig(config);

  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    const maskedApiKey = config.apiKey
      ? config.apiKey.replace(/.(?=.{4})/g, "*")
      : undefined;
    // eslint-disable-next-line no-console
    console.debug("Firebase client config:", {
      projectId: config.projectId,
      authDomain: config.authDomain,
      appId: config.appId,
      apiKey: maskedApiKey,
    });
  }

  if (typeof window === "undefined") {
    // eslint-disable-next-line no-console
    console.info("Firebase server config projectId:", config.projectId);
  }

  firebaseApp = getApps().length ? getApp() : initializeApp(config);
  return firebaseApp;
}

export function getFirestoreDb(): Firestore {
  if (firestoreDb) return firestoreDb;

  try {
    if (typeof window === "undefined") {
      firestoreDb = initializeFirestore(getFirebaseApp(), {
        experimentalForceLongPolling: true,
      });
      return firestoreDb;
    }

    const hasIndexedDB = typeof indexedDB !== "undefined" && indexedDB !== null;

    if (hasIndexedDB) {
      firestoreDb = initializeFirestore(getFirebaseApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        experimentalForceLongPolling: true,
      });
      return firestoreDb;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Could not enable persistent local cache, falling back to non-persistent Firestore.", err);
  }

  firestoreDb = initializeFirestore(getFirebaseApp(), {
    experimentalForceLongPolling: true,
  });
  return firestoreDb;
}

export function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;

  firebaseAuth = getAuth(getFirebaseApp());
  return firebaseAuth;
}

export async function ensureFirebaseAuth(): Promise<void> {
  if (typeof window === "undefined") return;

  const auth = getFirebaseAuth();

  if (auth.currentUser) return;

  if (!authBootstrapPromise) {
    authBootstrapPromise = (async () => {
      try {
        const authStateReady = (
          auth as { authStateReady?: () => Promise<void> }
        ).authStateReady;
        if (typeof authStateReady === "function") {
          await authStateReady.call(auth);
        }

        if (!auth.currentUser) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            console.warn("Navigator offline: skipping anonymous sign-in until online.");
          } else {
            await signInAnonymously(auth);
          }
        }
      } catch (error) {
        console.warn(
          "Firebase anonymous auth could not be initialized.",
          error,
        );
      }
    })().finally(() => {
      authBootstrapPromise = null;
    });
  }

  await authBootstrapPromise;
}

export function getGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/** Sign in with Google (Native device account picker on mobile / popup on web) and return the authenticated user. */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();

  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    try {
      const webClientId = process.env.NEXT_PUBLIC_FIREBASE_WEB_CLIENT_ID || "";
      const res = await NativeGoogleAuth.signIn({ webClientId });

      if (res.idToken) {
        const credential = GoogleAuthProvider.credential(res.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      }
    } catch (e: unknown) {
      console.warn("Native Google sign-in failed or was canceled:", e);
      // Fall through to web popup if native sign in fails or is canceled
    }
  }

  const credential = await signInWithPopup(auth, getGoogleAuthProvider());
  return credential.user;
}

/** Sign the current user out. */
export async function signOutUser(): Promise<void> {
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    try {
      await NativeGoogleAuth.signOut();
    } catch (ignored) {
    }
  }
  await signOut(getFirebaseAuth());
}

/** Sign in with email + password. */
export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  return credential.user;
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthStateChange(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}
