// BACKEND INTEGRATION POINT: Replace IndexedDB with Firebase/Supabase calls here

import { openDB, IDBPDatabase } from 'idb';
import type { Job } from '@/types';

const DB_NAME = 'paintpro-db';
const DB_VERSION = 1;
const STORE_JOBS = 'jobs';

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_JOBS)) {
        const store = db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('clientName', 'clientName');
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });
  return dbInstance;
}

export const dbService = {
  async getAllJobs(): Promise<Job[]> {
    try {
      const db = await getDB();
      const jobs = await db.getAll(STORE_JOBS);
      return jobs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  },

  async getJob(id: string): Promise<Job | undefined> {
    try {
      const db = await getDB();
      return db.get(STORE_JOBS, id);
    } catch {
      return undefined;
    }
  },

  async saveJob(job: Job): Promise<void> {
    const db = await getDB();
    await db.put(STORE_JOBS, { ...job, updatedAt: new Date().toISOString() });
  },

  async deleteJob(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_JOBS, id);
  },

  async exportAllJobs(): Promise<string> {
    const jobs = await this.getAllJobs();
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), jobs }, null, 2);
  },

  async importJobs(jsonString: string): Promise<{ imported: number; errors: number }> {
    let imported = 0;
    let errors = 0;
    try {
      const data = JSON.parse(jsonString);
      const jobs: Job[] = data.jobs || (Array.isArray(data) ? data : []);
      for (const job of jobs) {
        try {
          await this.saveJob(job);
          imported++;
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    }
    return { imported, errors };
  },
};