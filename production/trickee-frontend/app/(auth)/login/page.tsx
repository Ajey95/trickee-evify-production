"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { api, resetApiClientState } from "@/lib/api";
import { writeAuthSession } from "@/lib/auth-storage";
import { homeForRole } from "@/lib/roles";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);
  const [workspaceRetryAvailable, setWorkspaceRetryAvailable] =
    useState(false);
  const mountedRef = useRef(false);
  const authAttemptRef = useRef(0);
  const router = useRouter();
  const { status, user, refreshUser } = useAuth();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authAttemptRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(homeForRole(user.role));
    }
  }, [router, status, user]);

  const handleGoogleSignIn = async (idToken: string) => {
    const attempt = ++authAttemptRef.current;
    const isCurrent = () =>
      mountedRef.current && authAttemptRef.current === attempt;
    setGoogleLoading(true);
    setError("");
    setPendingApproval(false);
    setWorkspaceRetryAvailable(false);
    try {
      const result = await api.auth.googleLogin(idToken);
      if (!isCurrent()) return;
      if (!result.success || !result.data?.access_token) {
        const message = result.error || "Could not continue with Google.";
        if (/approval|workspace access|pending/i.test(message)) {
          setPendingApproval(true);
        } else {
          setError(message);
        }
        return;
      }

      writeAuthSession(result.data);
      resetApiClientState();
      const mappedUser = await refreshUser();
      if (!isCurrent()) return;
      if (mappedUser) {
        router.replace(homeForRole(mappedUser.role));
      } else {
        setError(
          "Signed in, but your workspace could not be loaded. Retry workspace access.",
        );
        setWorkspaceRetryAvailable(true);
      }
    } catch (err) {
      if (!isCurrent()) return;
      setError(
        err instanceof Error ? err.message : "Could not continue with Google.",
      );
    } finally {
      if (isCurrent()) setGoogleLoading(false);
    }
  };

  const retryWorkspace = async () => {
    const attempt = ++authAttemptRef.current;
    const isCurrent = () =>
      mountedRef.current && authAttemptRef.current === attempt;
    setGoogleLoading(true);
    setError("");
    setWorkspaceRetryAvailable(false);
    try {
      const mappedUser = await refreshUser();
      if (!isCurrent()) return;
      if (mappedUser) {
        router.replace(homeForRole(mappedUser.role));
      } else {
        setError("Workspace is still unavailable. Please try again.");
        setWorkspaceRetryAvailable(true);
      }
    } catch (err) {
      if (!isCurrent()) return;
      setError(
        err instanceof Error ? err.message : "Could not load your workspace.",
      );
      setWorkspaceRetryAvailable(true);
    } finally {
      if (isCurrent()) setGoogleLoading(false);
    }
  };

  return (
    <main className="auth-root min-h-screen bg-[#03070b] text-text-primary">
      <ThemeToggle className="theme-toggle-floating" />
      {pendingApproval && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-accent-amber/30 bg-[#0b0f16] p-6 shadow-[0_24px_100px_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-approval-title"
            aria-describedby="pending-approval-description"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-amber/12 text-accent-amber">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2
              id="pending-approval-title"
              className="text-xl font-semibold text-white"
            >
              Waiting for admin approval
            </h2>
            <p
              id="pending-approval-description"
              className="mt-3 text-sm leading-6 text-text-dim"
            >
              Your Google account is not mapped to a Trickee workspace yet. An
              admin must approve your requested role.
            </p>
            <Button
              type="button"
              className="mt-6 h-10 w-full"
              onClick={() => setPendingApproval(false)}
              autoFocus
            >
              Close
            </Button>
          </div>
        </div>
      )}

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:px-12">
        <section className="auth-story hidden lg:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center border border-[#ffe000]/30 bg-[#ffe000]/10 text-[#ffe000]">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Trickee</p>
              <p className="text-sm text-text-dim">EV fleet intelligence</p>
            </div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-teal">
            Operations workspace
          </p>
          <h1 className="mt-5 max-w-xl text-6xl font-semibold leading-[0.9] tracking-[-0.055em] text-white">
            Step into live operations.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-dim">
            Monitor active vehicles, coordinate shifts, and keep operations
            moving.
          </p>
        </section>

        <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center lg:min-h-0">
          <div className="w-full max-w-[440px] rounded-[10px] border border-white/[0.11] bg-[#081119]/90 p-6 shadow-[0_28px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim">
              Secure access
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-dim">
              Sign in with your approved Google account.
            </p>

            <div className="mt-7">
              <GoogleSignInButton
                disabled={googleLoading}
                onCredential={handleGoogleSignIn}
                onError={setError}
              />
            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-accent-red/30 bg-accent-red/8 p-3 text-sm text-accent-red">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
                {workspaceRetryAvailable && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-9 w-full"
                    disabled={googleLoading}
                    onClick={() => void retryWorkspace()}
                  >
                    Retry workspace
                  </Button>
                )}
              </div>
            )}

            <div className="mt-6 flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
              <p className="text-xs leading-5 text-text-dim">
                Your workspace opens with the right team permissions.
              </p>
            </div>

            <p className="mt-6 text-center text-sm text-text-dim">
              Need access?{" "}
              <Link
                href="/signup"
                className="font-medium text-text-primary transition hover:text-accent-teal"
              >
                Request an account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
