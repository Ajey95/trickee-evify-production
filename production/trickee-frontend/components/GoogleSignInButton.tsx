"use client";

import { useEffect, useRef, useState } from "react";
import {
  googleClientId,
  loadGoogleIdentityScript,
} from "@/lib/google-identity";
import { createGoogleIdentityButtonController } from "@/lib/google-button-controller.mjs";

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
  const [ready, setReady] = useState(false);

  credentialHandlerRef.current = onCredential;
  errorHandlerRef.current = onError;

  useEffect(() => {
    let active = true;
    const container = containerRef.current;
    const clientId = googleClientId();
    if (!container || !clientId) {
      errorHandlerRef.current("Google OAuth client ID is not configured.");
      return;
    }

    let controller: ReturnType<typeof createGoogleIdentityButtonController> | null = null;
    const render = () => {
      if (!active || !controller || !containerRef.current) return;
      controller.render(containerRef.current);
      setReady(true);
    };

    loadGoogleIdentityScript()
      .then(() => {
        if (!active || !window.google?.accounts.id) return;
        controller = createGoogleIdentityButtonController({
          googleIdentity: window.google.accounts.id,
          clientId,
          onCredential: (credential: string) =>
            credentialHandlerRef.current(credential),
          onError: (message: string) => errorHandlerRef.current(message),
        });
        render();
      })
      .catch(() => {
        if (active) errorHandlerRef.current("Unable to load Google sign-in.");
      });
    window.addEventListener("resize", render);
    return () => {
      active = false;
      window.removeEventListener("resize", render);
      container.replaceChildren();
    };
  }, []);

  return (
    <div
      className={`relative flex h-11 w-full justify-center overflow-hidden ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
      aria-busy={!ready}
      aria-disabled={disabled}
    >
      <div ref={containerRef} className="h-11 w-full" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center rounded border border-white/15 text-sm text-text-dim">
          Loading Google sign-in...
        </div>
      )}
    </div>
  );
}
