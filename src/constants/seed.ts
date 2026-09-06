import type { FormType } from "@/types";

/**
 * Turn a human name into a stable, readable document id.
 * "General Maintenance (GM)" -> "general-maintenance-gm"
 * "Carpentry – Room"         -> "carpentry-room"
 * Using deterministic ids makes seeding idempotent (re-running never duplicates).
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface SeedSite {
  name: string;
  address: string;
}

export interface SeedCategory {
  name: string;
  defaultFormType: FormType;
}

/** Initial sites. Addresses are left blank for the admin to fill in later. */
export const SEED_SITES: SeedSite[] = [
  { name: "ITC ROYAL", address: "" },
  { name: "ITC SONAR", address: "" },
];

/**
 * The seven work categories. The first five are "painting + polishing" work and
 * use the existing painting template; the two carpentry categories use the
 * carpenter template.
 */
export const SEED_CATEGORIES: SeedCategory[] = [
  { name: "Public Area", defaultFormType: "painting" },
  { name: "CMS", defaultFormType: "painting" },
  { name: "Kenfixt", defaultFormType: "painting" },
  { name: "General Maintenance (GM)", defaultFormType: "painting" },
  { name: "Guest Room Activities (Others)", defaultFormType: "painting" },
  { name: "Carpentry – Room", defaultFormType: "carpenter" },
  { name: "Carpentry – Public", defaultFormType: "carpenter" },
];
