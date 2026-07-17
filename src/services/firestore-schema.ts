import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreDb } from '@/services/firebase';

const SCHEMA_COLLECTION = 'app_meta';
const SCHEMA_DOC = 'schema';
const SCHEMA_VERSION = 1;

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

export type FirestoreSchema = {
  version: number;
  collections: {
    jobs: 'jobs';
  };
  createdAt: unknown;
  updatedAt: unknown;
};

export function ensureFirestoreSchema(): Promise<void> {
  if (schemaReady) return Promise.resolve();

  if (!schemaPromise) {
    schemaPromise = (async () => {
      try {
        const db = getFirestoreDb();
        await setDoc(
          doc(db, SCHEMA_COLLECTION, SCHEMA_DOC),
          {
            version: SCHEMA_VERSION,
            collections: {
              jobs: 'jobs',
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } satisfies FirestoreSchema,
          { merge: true }
        );
        schemaReady = true;
      } catch (error) {
        // Schema write is non-critical — allow jobs CRUD to proceed even if it fails
        console.warn('Firestore schema initialization skipped (non-critical):', error);
        schemaReady = true; // Mark ready so we don't keep retrying
      }
    })();
  }

  return schemaPromise;
}