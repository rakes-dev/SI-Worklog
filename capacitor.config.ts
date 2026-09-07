import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: This is the ONLY Capacitor config — the CLI prefers .ts over .json,
// so capacitor.config.json was removed to avoid divergent configs.
const config: CapacitorConfig = {
  appId: 'com.si_worklog.com',
  appName: 'SI WorkLog',
  webDir: 'public',
  android: {
    allowMixedContent: false,
  },
  // Load the live app directly inside the WebView (no redirector, no
  // escaping to the system browser).
  server: {
    androidScheme: 'https',
    url: 'https://si-worklog.netlify.app',
    allowNavigation: [
      'si-worklog.netlify.app',
      '*.netlify.app',
      '*.firebaseapp.com',
      '*.google.com',
      'accounts.google.com',
      'accounts.google.*',
    ],
  },
};

export default config;
