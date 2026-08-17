# Firebase Setup Guide

## Why data shows empty / doesn't sync with Firestore

The app reads/writes jobs from **Cloud Firestore**. If you see
`auth/configuration-not-found` or `Missing or insufficient permissions` in the
browser console, it means your Firebase project is not configured for this app
yet. The app gracefully falls back to local (IndexedDB) data, but Firestore
won't sync until the two steps below are done.

## Prerequisites

All `NEXT_PUBLIC_FIREBASE_*` variables in `.env` must point to a **real**
Firebase project (they should already be filled in). If you are using a fresh
project, get these from:
Firebase Console -> Project settings -> General -> Your apps -> Web app.

## Step 1 — Enable Anonymous authentication

`auth/configuration-not-found` means the Anonymous sign-in provider is not
turned on. To enable it:

1. Open the [Firebase Console](https://console.firebase.google.com) and select
   your project.
2. Go to **Build -> Authentication -> Sign-in method**.
3. Find **Anonymous** and click the pencil / toggle to **Enable** it.
4. Click **Save**.

(Docs: https://firebase.google.com/docs/auth/web/anonymous-auth)

## Step 2 — Allow Firestore read/write (security rules)

`Missing or insufficient permissions` means your Firestore rules deny access.
Two options:

### Option A (quickest for development) — deploy the shipped rules
A permissive `firestore.rules` file is included in this repo. Deploy it with the
Firebase CLI:

```bash
npm i -g firebase-tools
firebase login
firebase init firestore      # choose your project, use existing firestore.rules
firebase deploy --only firestore
```

The shipped rules allow full read/write (`allow read, write: if true;`), which
lets the app sync without authentication — ideal for testing.

### Option B — authenticate-based rules
Replace the contents of `firestore.rules` with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Then deploy as in Option A and make sure Step 1 (Anonymous) is enabled, because
the app signs in anonymously before reading/writing.

## After setup

- Restart the dev server: `npm run dev` (port 4028).
- Hard-refresh the browser (Ctrl+Shift+R) so the Firebase module reloads.
- Create a job/form — it should now appear in Firestore and load on other
  devices/sessions.

> Note: Once Firestore works, data written while offline (local persistence) is
> also preserved; the app merges behavior is local-first then syncs best-effort.
