# SI WorkLog — Restructure Plan

## STATUS — IMPLEMENTED 2026-09-03 (branch `restructure/site-category-forms`)

- [x] **Root cause fixed**: forms are now stored as **their own Firestore documents** (`forms` collection`; the old single-document-per-job `jobs` collection is no longer written by the app and remains untouched as a backup.
- [x] **Safety net in place**: Admin panel → Data Tools lets an admin **export every form to JSON**, **restore from a backup**, and **migrate the legacy `jobs` → `forms`** (best-effort site/category matching; source docs never deleted`; `jobs` is admin-read-only in Firestore rules.
 The custom `localStorage` sync queue was removed — Firestore's own per-document offline queue now handles offline edits.

- [x] **New workflow**: Sites (ITC ROYAL / ITC SONAR` → work-category cards (7 categories` → form list ("New Form" pre-fills site, category, employee from login` → form editor (unchanged print/PDF/math`.
- [x] **Per-employee visibility**: employees see only forms with `ownerEmail == their login email`; admins see everything (enforced in Firestore rules`; `app_users` allowlist + roles unchanged.
 Admin can manage Sites, Categories, Users, andreview all forms from the Admin panel (Overview/Master Summary (Excel export retained).
- [x] **Print & PDF layout UNCHANGED** — the form editor feeds the exact same `Job`-shaped object (built from the form's denormalized site/employee fields) to `PrintLayout`/`PdfExportLayout`, so output stays byte-for-byte identical.

### Open items (optional, ask user)
- Site **addresses** for ITC ROYAL / ITC SONAR are still blank — fill them from Admin → Sites & Categories → edit (they print on the form header,
- Add the 6 employees' **login emails** to the allowlist from Admin → Users (the app already routes unauthenticated → `/login`; only allowlisted emails can sign in.
- **Re-file migrated forms**: any form migrated from legacy `jobs` without a matching site/category gets `categoryId` empty — re-file it via Admin → Sites & Categories (or delete + recreate; the legacy `jobs` doc remains the reference copy.

_Drafted 2026-09-02. Original plan follows._

## Decisions locked in

| Question | Decision |
|---|---|
| Database | **Stay on Firebase** — normalize the data model + lock down security rules (no Supabase migration) |
| Offline | Occasional ("sometimes") — keep Firestore's built-in offline support |
| Work structure | **Site → Work Category → Forms** |
| Visibility | Each employee sees **only their own forms**; admin sees everything (enforced server-side) |
| Print & math | **Unchanged** — print layout, PDF export, and all measurement/calculation logic stay exactly as-is |

---

## 1. Why data is being lost (root cause)

Today, one **job** — including every form, every measurement row, and every signature — is stored as a **single Firestore document**, and the whole document is re-saved on each change. When the same job is touched from two places at once (two employees, two browser tabs, or an offline edit that syncs later — and the admin's live listener counts as one of those), the last save overwrites everything the other one did. The existing timestamp guard only compares whole jobs, so edits to *different forms in the same job* silently clobber each other. The custom offline queue in `localStorage` adds more edge cases on top.

**The fix:** make each **form its own record**. Then editing one form can never overwrite another, and we can lean on Firestore's own per-document offline sync instead of the fragile custom queue.

---

## 2. New data model (Firestore)

Four collections replace the single `jobs` collection:

**`sites/{siteId}`** — admin-managed
```
{ id, name, address, order, isActive, createdAt, updatedAt }
```
Seed: ITC ROYAL, ITC SONAR.

**`categories/{categoryId}`** — admin-managed, global (same set across sites)
```
{ id, name, defaultFormType: "painting" | "carpenter", order, isActive }
```
Seed (proposed default template in brackets):
1. Paint + Polish – Public Area  [painting]
2. CMS  [painting]
3. Kenfixt  [painting]
4. General Maintenance (GM)  [painting]
5. Guest Room Activities (Others)  [painting]
6. Carpentry – Room  [carpenter]
7. Carpentry – Public  [carpenter]

**`forms/{formId}`** — the measurement form, now standalone
```
{ ...all existing PaintForm fields (unchanged)...,
  siteId, categoryId,
  ownerEmail,                       // who it belongs to (from login)
  siteName, siteAddress, empName,   // denormalized so the printout is identical
  isDeleted, deletedAt, createdAt, updatedAt }
```
The extra denormalized fields let us hand `PrintLayout`/`PdfExportLayout` the exact same job-shaped object they already expect — so those files don't change at all.

**`app_users/{email}`** — unchanged shape (allowlist + role), but rules change (below). These are your 6 employees + admin.

> The old `jobs` collection is **kept untouched as a backup** until the new model is verified in production.

---

## 3. Security rules (server-enforced)

Replace the wide-open `allow read, write: if true` with owner-and-admin rules:

- `forms/{id}` — read/update/delete if signed in **and** (`ownerEmail == my email` **or** I'm admin); create only with my own email as owner.
- `sites`, `categories` — any signed-in user can read; only admin can write.
- `app_users/{email}` — a user can read **only their own** doc (to learn their role); only admin can write. (Today every user can read the entire email list — that gets closed.)
- `admin` = my `app_users` doc has `role == "admin"`, with the default-admin email hard-coded as a permanent fallback so you can't be locked out.
- Drop anonymous sign-in for data access; the app already routes signed-out users to `/login` (Google + email/password stay).

---

## 4. Sync simplification

Remove the custom `localStorage` sync queue and per-job merge logic. Instead: write each form directly with Firestore, which **queues offline writes per-document automatically** and replays them on reconnect. Keep Firestore IndexedDB persistence on. This removes the whole class of "lost a form" bugs and is a large net reduction in code.

---

## 5. New navigation & screens

```
Sites  →  Site (7 category cards)  →  Category (my forms list)  →  Form editor
```

- **Sites** (home): cards for ITC ROYAL / ITC SONAR with my form counts.
- **Site page**: the 7 work-category cards, each showing how many of *my* forms it holds.
- **Category page**: a list of my forms in that site+category (search/sort like today's forms table) + a **New Form** button.
- **New Form**: creates a form using the category's default template, pre-filled with my name (from login) and the site's name/address. No more typing site details. (Template can still be overridden.)
- **Form editor**: unchanged — same tables, signatures, autosave, print, PDF, copy.
- **Admin**: manage Sites, Categories, and Users; view/report across **all** employees; MasterSummary Excel export retained.
- **Dashboard**: becomes a personal stats overview (scoped to me), or folds into Sites.

The whole "New Job (free text site/employee/address)" flow is retired — that information now comes from the Site record and the logged-in user.

---

## 6. Migration (lossless — this protects your existing data)

1. **Back up**: export every current `jobs` document to a timestamped JSON file **and** copy them to a `jobs_backup` collection. Nothing is deleted.
2. **Build new collections alongside** the old one (seed sites + categories).
3. **Migrate**: for each existing job, create one `forms` doc per form, carrying over all fields and the original `userId` as `ownerEmail`. Match the site by name (ITC ROYAL/SONAR); anything unmatched keeps its original site name as a new site. Category is set to a temporary **"Unsorted"** bucket (carpenter-type forms → Carpentry – Room) for you to re-file from Admin.
4. **Verify**: form counts and grand totals reconcile against the backup.
5. **Switch** the UI to the new collections.
6. **Retire** the old `jobs` code/collection only after you confirm everything looks right.

---

## 7. Phased implementation

- **Phase 0 — Safety net**: git branch + full JSON/collection backup of `jobs`, `arc`, `app_users`.
- **Phase 1 — Foundation**: new types, collections, per-form db service, locked-down rules, sync simplification, seed sites + categories.
- **Phase 2 — Migration tool**: admin-run, lossless, with verification.
- **Phase 3 — UI restructure**: new Site→Category→Forms navigation, New Form flow, admin site/category management. Form editor + print untouched.
- **Phase 4 — Cleanup & hardening**: fix known bugs (duplicate-form, loading states, misleading toasts), turn build error-checking back on, remove dead job code.

---

## 8. Please confirm before I build

1. **Category → template mapping** above (carpentry categories = carpenter form, the other five = painting) — correct?
2. **The 6 employees**: send me each one's **login email + display name** so I can seed the allowlist. (Or I build the Admin screen and you add them yourself.)
3. **Site addresses** for ITC ROYAL and ITC SONAR (they print on the form) — or I use placeholders you edit later.
4. **"Unsorted" bucket** for existing forms during migration — OK, or do you want them mapped a specific way?
