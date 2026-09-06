# SI WorkLog → APK / iOS (Capacitor) Setup

## Why your APK opened the website in Chrome instead of the app

The splash page (`public/index.html`) redirects to your hosted app.
By default, **Capacitor opens any navigation to a non-allowed domain in the
system browser** — that's why the app "redirected to a weblink" instead of
staying inside the app window. This is a native setting, not a bug in the
page itself.

**Fixed by** `capacitor.config.json` in the project root:

```json
"server": {
  "url": "https://si-worklog.netlify.app",
  "allowNavigation": ["si-worklog.netlify.app", "*.netlify.app"]
}
```

- `server.url` → the app opens your hosted site **directly inside the
  WebView** at launch (no redirect at all — this is the "real app" feel).
- `allowNavigation` → even if navigation happens (e.g. from `index.html`),
  it stays **inside the app**, never jumps to Chrome.

## Path A — Capacitor CLI (recommended, full control)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap add android        # and/or: npx cap add ios
npx cap sync               # copies public/ into the native project
npx cap open android       # opens Android Studio → Build APK / AAB
```

`capacitor.config.json` is already in the project root — nothing else to
configure. The splash (`index.html`) is bundled too and serves as the
offline/error fallback page.

## Path B — GUI converter tools ("web to APK" sites)

The tool can't read `capacitor.config.json`, so set it in the tool's UI:

1. **Website URL**: `https://si-worklog.netlify.app`
2. **Open links in**: *In-app browser / WebView* — **NOT** "external browser"
3. If it has an **allowed domains / navigation domains** field, add:
   `si-worklog.netlify.app`
4. If the tool demands an entry HTML file, upload `public/index.html`.

## When your domain changes — update ALL of these places

| File | Line to edit |
|---|---|
| `capacitor.config.json` | `server.url` + `server.allowNavigation` |
| `public/index.html` | `var APP_URL = "…"` (≈ line 148) |
| `android/app/src/main/assets/capacitor.config.json` | same server block (baked-in copy the APK actually reads) |
| `ios/App/App/capacitor.config.json` | same server block |

…then run `npx cap sync` to re-copy `public/` into both native projects.

## Notes

- `appId` is `com.si_worklog.com` (matches the existing native Android/iOS
  projects). Keep it in sync everywhere — it's the Play Store package name,
  hard to change after publishing.
- Firebase Auth + Firestore need internet on first launch; after the first
  visit the PWA service worker + Firestore offline cache keep forms usable
  offline.
- iOS: `npx cap add ios` needs macOS/Xcode; on Windows use a CI service or
  PWABuilder for the iOS package.
