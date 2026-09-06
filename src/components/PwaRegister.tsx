"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let interval: ReturnType<typeof setInterval> | undefined;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);

        // Check for a new service worker every 30 minutes so app updates
        // roll out without the user having to hard-refresh.
        interval = setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((error) => {
        console.warn("Service Worker registration failed:", error);
      });

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
