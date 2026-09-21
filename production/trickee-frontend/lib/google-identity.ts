"use client";

export type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type: "standard";
              theme: "outline";
              size: "large";
              text: "continue_with";
              shape: "rectangular";
              logo_alignment: "left";
              width: number;
            },
          ) => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_IDENTITY_SCRIPT_TIMEOUT_MS = 10_000;
const DEFAULT_GOOGLE_CLIENT_ID =
  "397358873357-qfd1kdt5fhgduu4tvq92l5dg8otmh6ln.apps.googleusercontent.com";

export function loadGoogleIdentityScript({
  timeoutMs = GOOGLE_IDENTITY_SCRIPT_TIMEOUT_MS,
}: { timeoutMs?: number } = {}) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  let script = document.querySelector<HTMLScriptElement>(
    `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`,
  );
  if (script?.dataset.googleIdentityState === "failed") {
    script.remove();
    script = null;
  }

  const pending = new Promise<void>((resolve, reject) => {
    const target = script ?? document.createElement("script");
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      target.removeEventListener("load", handleLoad);
      target.removeEventListener("error", handleError);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        target.dataset.googleIdentityState = "failed";
        target.remove();
        reject(error);
      } else {
        target.dataset.googleIdentityState = "loaded";
        resolve();
      }
    };
    const handleLoad = () => {
      if (window.google?.accounts?.id) {
        finish();
      } else {
        finish(new Error("Google sign-in loaded without becoming available."));
      }
    };
    const handleError = () => finish(new Error("Unable to load Google sign-in."));
    const timeout = window.setTimeout(
      () => finish(new Error("Google sign-in timed out while loading.")),
      timeoutMs,
    );

    target.addEventListener("load", handleLoad, { once: true });
    target.addEventListener("error", handleError, { once: true });
    if (!script) {
      target.src = GOOGLE_IDENTITY_SCRIPT_SRC;
      target.async = true;
      target.defer = true;
      target.dataset.googleIdentityState = "loading";
      document.head.appendChild(target);
    }
  });

  const retryable = pending.catch((error) => {
    if (scriptPromise === retryable) scriptPromise = null;
    throw error;
  });
  scriptPromise = retryable;
  return scriptPromise;
}

export function googleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
}
