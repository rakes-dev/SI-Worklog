/**
 * Per-user "last worked" memory (localStorage).
 *
 * Remembers which site/category a user worked on last so that:
 *  - the New Form modal preselects the same site + category as defaults,
 *  - the site page orders categories by recency (most recently worked first).
 *
 * Keyed by the lowercased user email, so each employee keeps their own memory
 * on the device. All reads are defensive: missing/corrupt data returns empty.
 */

const KEY_PREFIX = "si-worklog:last-work:";

export interface LastWork {
  /** Most recently used site id ("" if none). */
  lastSiteId: string;
  /** Most recently used category id ("" if none). */
  lastCategoryId: string;
  /** categoryId -> epoch ms of last work in that category. */
  categoryAt: Record<string, number>;
  /** siteId -> epoch ms of last work in that site. */
  siteAt: Record<string, number>;
}

function storageKey(email: string): string {
  return KEY_PREFIX + email.trim().toLowerCase();
}

export function loadLastWork(email: string | null | undefined): LastWork {
  const empty: LastWork = {
    lastSiteId: "",
    lastCategoryId: "",
    categoryAt: {},
    siteAt: {},
  };
  if (!email) return empty;
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(storageKey(email))
        : null;
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LastWork> | null;
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      lastSiteId: typeof parsed.lastSiteId === "string" ? parsed.lastSiteId : "",
      lastCategoryId:
        typeof parsed.lastCategoryId === "string" ? parsed.lastCategoryId : "",
      categoryAt:
        parsed.categoryAt && typeof parsed.categoryAt === "object"
          ? (parsed.categoryAt as Record<string, number>)
          : {},
      siteAt:
        parsed.siteAt && typeof parsed.siteAt === "object"
          ? (parsed.siteAt as Record<string, number>)
          : {},
    };
  } catch {
    return empty;
  }
}

export function rememberWork(
  email: string | null | undefined,
  siteId: string,
  categoryId: string,
): void {
  if (!email || !siteId || !categoryId) return;
  if (typeof window === "undefined") return;
  const current = loadLastWork(email);
  const now = Date.now();
  const next: LastWork = {
    lastSiteId: siteId,
    lastCategoryId: categoryId,
    siteAt: { ...current.siteAt, [siteId]: now },
    categoryAt: { ...current.categoryAt, [categoryId]: now },
  };
  try {
    window.localStorage.setItem(storageKey(email), JSON.stringify(next));
  } catch {
    // Storage full / private mode — memory is best-effort, never break the flow.
  }
}

/**
 * Sort helper: entries with recency come first (most recent first), the rest
 * keep their original relative order (by `order`, then by original index).
 */
export function byRecencyThenOrder<T>(
  items: T[],
  getId: (item: T) => string,
  getRecency: (item: T) => number,
  getOrder: (item: T) => number,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = getRecency(a.item) || 0;
      const rb = getRecency(b.item) || 0;
      if (ra !== rb) return rb - ra; // recent (larger timestamp) first
      const oa = getOrder(a.item) || 0;
      const ob = getOrder(b.item) || 0;
      if (oa !== ob) return oa - ob;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
