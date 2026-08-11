import { useEffect, useState } from "react";

/**
 * Progressive-web-app plumbing: registers the service worker so the studio can
 * be installed and opened offline, and exposes the browser's install prompt.
 */

/** The non-standard event Chromium fires when the app qualifies for install. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SW_URL = "/sw.js";

/** Registers the worker once the page is idle, in production builds only. */
export function useServiceWorker(): void {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
        if (cancelled) return;
        // A worker waiting behind an open tab should take over on the next load.
        registration.addEventListener("updatefound", () => {
          registration.installing?.addEventListener("statechange", function onChange() {
            if (this.state === "installed" && navigator.serviceWorker.controller) {
              registration.waiting?.postMessage("skip-waiting");
            }
          });
        });
      } catch {
        /* an unavailable worker must never break the studio */
      }
    };
    void register();
    return () => {
      cancelled = true;
    };
  }, []);
}

export interface InstallPrompt {
  /** True once the browser has offered an install prompt we can replay. */
  available: boolean;
  /** Shows the prompt; resolves to true when the user accepted. */
  install: () => Promise<boolean>;
}

/** Captures `beforeinstallprompt` so the app can offer its own install button. */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    available: deferred !== null,
    install: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      return outcome === "accepted";
    },
  };
}
