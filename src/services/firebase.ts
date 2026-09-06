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
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

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
    // During SSR/build we want to fail fast — give a clear error. In the
    // browser, prefer a soft failure so the app can still render and provide
    // a useful UI (the runtime will later surface Firebase errors if used).
    if (typeof window === "undefined") {
      throw new Error(msg);
    }
    // Client-side: warn but don't throw to avoid crashing in environments
    // where NEXT_PUBLIC env vars are not present (e.g. local experiments).
    // Firebase usage will still fail later if actually invoked.
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  const config = readFirebaseConfig();
  validateFirebaseConfig(config);

  // Dev-only client-side debug: log the project and domain so developers can
  // verify the client is pointed at the intended Firebase project. Mask the
  // API key partially to avoid accidental exposure in logs.
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

  // Server-side debug: log project id used by server processes.
  if (typeof window === "undefined") {
    // eslint-disable-next-line no-console
    console.info("Firebase server config projectId:", config.projectId);
  }

  firebaseApp = getApps().length ? getApp() : initializeApp(config);
  return firebaseApp;
}

export function getFirestoreDb(): Firestore {
  if (firestoreDb) return firestoreDb;

  // Long polling is forced to make the SDK more robust on restrictive
  // networks (corporate proxies, antivirus, CGNAT ISPs) where the default
  // WebChannel transport can be interrupted. Prefer a persistent local cache
  // when available, but gracefully fall back when IndexedDB/persistence is
  // not supported (SSR, private browsing, or blocked storage).
  try {
    if (typeof window === "undefined") {
      // Server-side: do not attempt to use IndexedDB/persistence.
      firestoreDb = initializeFirestore(getFirebaseApp(), {
        experimentalForceLongPolling: true,
      });
      return firestoreDb;
    }

    // Quick feature-detect for IndexedDB. Some browsers disable it (private
    // modes) which makes persistentLocalCache throw when used.
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
    // Fall through to a safe non-persistent initialization below.
    // The SDK will still work online; it just won't persist data across
    // reloads or support multi-tab coordination.
    // eslint-disable-next-line no-console
    console.warn("Could not enable persistent local cache, falling back to non-persistent Firestore.", err);
  }

  // Fallback: initialize without the persistent local cache.
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
          // If the browser is currently offline, skip anonymous sign-in —
          // it will fail and only produces noisy warnings. The app can still
          // function in a read-only/offline capacity until connectivity.
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
  return provider;
}

/** Sign in with a Google popup and return the authenticated user. */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await signInWithPopup(auth, getGoogleAuthProvider());
  return credential.user;
}

/** Sign the current user out. */
export async function signOutUser(): Promise<void> {
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
