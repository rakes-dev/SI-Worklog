import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { enableMultiTabIndexedDbPersistence, getFirestore, type Firestore } from 'firebase/firestore';

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
let persistenceEnabled = false;

function readFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
  };
}

function validateFirebaseConfig(config: FirebaseConfig): void {
  const requiredKeys: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  const missing = requiredKeys.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase env vars: ${missing
        .map((key) => `NEXT_PUBLIC_FIREBASE_${String(key).replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}`)
        .join(', ')}`
    );
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  const config = readFirebaseConfig();
  validateFirebaseConfig(config);

  firebaseApp = getApps().length ? getApp() : initializeApp(config);
  return firebaseApp;
}

export function getFirestoreDb(): Firestore {
  if (firestoreDb) return firestoreDb;

  firestoreDb = getFirestore(getFirebaseApp());

  if (typeof window !== 'undefined' && !persistenceEnabled) {
    persistenceEnabled = true;
    enableMultiTabIndexedDbPersistence(firestoreDb).catch((error: unknown) => {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (code !== 'failed-precondition' && code !== 'unimplemented') {
        // Keep Firestore usable even when persistence cannot be enabled.
        console.warn('Firestore persistence could not be enabled.', error);
      }
    });
  }

  return firestoreDb;
}
