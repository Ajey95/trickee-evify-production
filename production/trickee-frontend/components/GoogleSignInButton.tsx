"use client";

import { useEffect, useRef, useState } from "react";
import {
  googleClientId,
  loadGoogleIdentityScript,
} from "@/lib/google-identity";

type GoogleSignInButtonProps = {
  onCredential: (idToken: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export function GoogleSignInButton({
  onCredential,
  onError,
  disabled = false,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const credentialHandlerRef = useRef(onCredential);
  const errorHandlerRef = useRef(onError);
  const disabledRef = useRef(disabled);
  const credentialPendingRef = useRef(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadAttempt, setLoadAttempt] = useState(0);

  disabledRef.current = disabled;

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
    errorHandlerRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    if (!disabled) credentialPendingRef.current = false;
  }, [disabled]);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;
    const clientId = googleClientId();
    if (!container || !clientId) {
      setLoadState("error");
      errorHandlerRef.current("Google OAuth client ID is not configured.");
      return;
    }

    setLoadState("loading");

    const render = () => {
      if (!active || !window.google?.accounts.id || !containerRef.current)
        return;
      const target = containerRef.current;
      target.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          if (
            !active ||
            disabledRef.current ||
            credentialPendingRef.current
          )
            return;
          if (response.credential) {
            credentialPendingRef.current = true;
            credentialHandlerRef.current(response.credential);
          } else {
            errorHandlerRef.current("Google did not return an ID token.");
          }
        },
      });
      window.google.accounts.id.renderButton(target, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.min(Math.max(target.clientWidth, 240), 400),
      });
      setLoadState("ready");
    };

    loadGoogleIdentityScript().then(render).catch(() => {
      if (active) {
        setLoadState("error");
        errorHandlerRef.current("Unable to load Google sign-in.");
      }
    });
    window.addEventListener("resize", render);
    return () => {
      active = false;
      window.removeEventListener("resize", render);
      container.replaceChildren();
    };
  }, [loadAttempt]);

  const retry = () => {
    errorHandlerRef.current("");
    setLoadAttempt((attempt) => attempt + 1);
  };

  return (
    <div
      className={`relative flex h-11 w-full justify-center overflow-hidden ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
      aria-busy={loadState === "loading"}
      aria-disabled={disabled}
    >
      <div
        ref={containerRef}
        className="h-11 w-full"
        inert={disabled ? true : undefined}
      />
      {loadState === "loading" && (
        <div
          className="absolute inset-0 grid place-items-center rounded border border-white/15 text-sm text-text-dim"
          role="status"
        >
          Loading Google sign-in...
        </div>
      )}
      {loadState === "error" && (
        <button
          type="button"
          className="absolute inset-0 rounded border border-accent-red/40 bg-accent-red/8 text-sm font-medium text-text-primary transition hover:border-accent-teal/60 hover:text-accent-teal"
          onClick={retry}
        >
          Retry Google sign-in
        </button>
      )}
    </div>
  );
}
