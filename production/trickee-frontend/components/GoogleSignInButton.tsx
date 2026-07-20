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
          if (response.credential) {
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
      setReady(true);
    };

    loadGoogleIdentityScript().then(render).catch(() => {
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
