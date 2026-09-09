"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Android hardware back-button handling for the installed Capacitor app.
 *
 * Registering a `backButton` listener takes over completely:
 *   - if an input is currently focused → blur it (dismiss keyboard & suggestions)
 *   - if the WebView can go back      → navigate back (previous app state)
 *   - otherwise                       → exit the app (expected on the home page)
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
            const active = document.activeElement;
            if (
              active instanceof HTMLInputElement ||
              active instanceof HTMLTextAreaElement ||
              active instanceof HTMLSelectElement
            ) {
              active.blur();
              return;
            }

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
