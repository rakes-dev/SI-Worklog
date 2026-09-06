"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Android hardware back-button handling for the installed Capacitor app.
 *
 * Without this listener the default behaviour navigates the WebView back only
 * while it has entries — and with the remote-loaded Next.js app the history
 * is often exhausted, so pressing back immediately CLOSES the app instead of
 * returning to the previous screen.
 *
 * Registering a `backButton` listener takes over completely:
 *   - if the WebView can go back  → navigate back (previous app state)
 *   - otherwise                   → exit the app (expected on the home page)
 *
 * No-op in a regular browser.
 */
export default function NativeBackHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener(
          "backButton",
          ({ canGoBack }) => {
            if (canGoBack) {
              window.history.back();
            } else {
              App.exitApp();
            }
          },
        );
        if (cancelled) {
          listener.remove();
          return;
        }
        cleanup = () => listener.remove();
      } catch (error) {
        console.warn("Back-button handler unavailable:", error);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}