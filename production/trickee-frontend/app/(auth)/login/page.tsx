"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { api, resetApiClientState } from "@/lib/api";
import { writeAuthSession } from "@/lib/auth-storage";
import { homeForRole } from "@/lib/roles";

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);
  const router = useRouter();
  const { status, user, refreshUser } = useAuth();

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(homeForRole(user.role));
    }
  }, [router, status, user]);

  const handleGoogleSignIn = async (idToken: string) => {
    setGoogleLoading(true);
    setError("");
    try {
      const result = await api.auth.googleLogin(idToken);
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
      if (mappedUser) {
        router.replace(homeForRole(mappedUser.role));
      } else {
        setPendingApproval(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not continue with Google.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070a] text-text-primary">
      {pendingApproval && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-accent-amber/30 bg-[#0b0f16] p-6 shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-amber/12 text-accent-amber">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Waiting for admin approval
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-dim">
              Your Google account is not mapped to a Trickee workspace yet. An
              admin must approve your requested role.
            </p>
            <Button
              type="button"
              className="mt-6 h-10 w-full"
              onClick={() => setPendingApproval(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 px-6 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:px-10">
        <section className="hidden lg:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-teal text-lg font-black text-bg-primary">
              T
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Trickee</p>
              <p className="text-sm text-text-dim">EV fleet intelligence</p>
            </div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-teal">
            Operations workspace
          </p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[0.98] text-white">
            Access your fleet workspace.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-dim">
            Monitor active vehicles, coordinate shifts, and keep operations
            moving.
          </p>
        </section>

        <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center lg:min-h-0">
          <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.09] bg-[#0b0f16] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
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
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-accent-red/30 bg-accent-red/8 p-3 text-sm text-accent-red">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
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
