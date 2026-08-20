"use client";

import type { Job } from "@/types";
import { dbService } from "@/services/db";

/**
 * Local-first sync service.
 *
 * When the device is offline, job changes are queued in localStorage.
 * When the device comes back online, queued changes are automatically
 * flushed to Firestore in order.
 */

const SYNC_QUEUE_KEY = "paintpro-sync-queue";
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
// Periodic auto-sync interval: when online with pending items, sync every 5s
const AUTO_SYNC_INTERVAL_MS = 5000;

export interface PendingSyncItem {
  id: string;
  job: Job;
  timestamp: number;
  retries: number;
}

type SyncListener = (state: {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
}) => void;

class SyncService {
  private listeners = new Set<SyncListener>();
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private syncing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
      // Start the periodic auto-sync loop
      this.startAutoSyncInterval();
    }
  }

  /** Start a periodic interval that flushes pending syncs whenever online. */
  private startAutoSyncInterval(): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      if (this.isOnline && this.getPendingCount() > 0) {
        this.flushPendingSyncs();
      }
    }, AUTO_SYNC_INTERVAL_MS);
  }

  /** Current online status. */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /** Number of jobs waiting to be synced. */
  getPendingCount(): number {
    return this.getQueue().length;
  }

  /** Whether a sync flush is currently in progress. */
  isSyncing(): boolean {
    return this.syncing;
  }

  /** Subscribe to sync state changes. Returns an unsubscribe function. */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({
      isOnline: this.isOnline,
      pendingCount: this.getPendingCount(),
      syncing: this.syncing,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Queue a job for syncing to Firestore. */
  queueJobSync(job: Job): void {
    const queue = this.getQueue();
    const existingIndex = queue.findIndex((item) => item.job.id === job.id);
    const item: PendingSyncItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      job,
      timestamp: Date.now(),
      retries: 0,
    };
    if (existingIndex >= 0) {
      queue[existingIndex] = item;
    } else {
      queue.push(item);
    }
    this.saveQueue(queue);
    this.notify();

    if (this.isOnline) {
      this.scheduleFlush(0);
    }
  }

  /** Remove a job from the pending queue (e.g. after successful sync). */
  removeFromQueue(jobId: string): void {
    const queue = this.getQueue().filter((item) => item.job.id !== jobId);
    this.saveQueue(queue);
    this.notify();
  }

  /** Attempt to sync all pending jobs to Firestore. */
  async flushPendingSyncs(): Promise<void> {
    if (this.syncing) return;
    if (!this.isOnline) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.syncing = true;
    this.notify();

    try {
      for (const item of [...queue]) {
        if (!this.isOnline) break;

        try {
          await dbService.saveJob(item.job);
          this.removeFromQueue(item.job.id);
        } catch (error) {
          console.warn(
            `Sync failed for job ${item.job.id} (attempt ${item.retries + 1}/${MAX_RETRIES}):`,
            error,
          );
          const updatedQueue = this.getQueue().map((q) =>
            q.id === item.id ? { ...q, retries: q.retries + 1 } : q,
          );
          this.saveQueue(updatedQueue);
          // Auto-retry failed items after a short delay (no manual action needed)
          this.scheduleRetry();
          break;
        }
      }
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  /** Schedule an automatic retry for failed sync items. */
  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if (this.isOnline && this.getPendingCount() > 0) {
        this.flushPendingSyncs();
      }
    }, RETRY_DELAY_MS);
  }

  /** Schedule a flush with optional delay. */
  private scheduleFlush(delayMs: number): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushPendingSyncs();
    }, delayMs);
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notify();
    this.scheduleFlush(RETRY_DELAY_MS);
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notify();
  };

  private getQueue(): PendingSyncItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: PendingSyncItem[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.warn("Could not persist sync queue:", error);
    }
  }

  private notify(): void {
    const state = {
      isOnline: this.isOnline,
      pendingCount: this.getPendingCount(),
      syncing: this.syncing,
    };
    this.listeners.forEach((listener) => listener(state));
  }
}

// Singleton instance
export const syncService = new SyncService();