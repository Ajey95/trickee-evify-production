"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { api, resetApiClientState } from "@/lib/api";
import { writeLegacyToken } from "@/lib/auth-storage";
import { homeForRole } from "@/lib/roles";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";

const legacyAuthEnabled = process.env.NEXT_PUBLIC_LEGACY_AUTH_ENABLED === "true";
type LoginMode = "password" | "code";
type CodeChannel = "email" | "phone";

function AuthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("password");
  const [codeChannel, setCodeChannel] = useState<CodeChannel>("email");
  const [codeTarget, setCodeTarget] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { status, user, refreshUser } = useAuth();

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length > 0 && !isLoading, [email, password, isLoading]);
  const canSendOtp = useMemo(() => codeTarget.trim().length > 3 && !otpLoading, [codeTarget, otpLoading]);
  const canVerifyOtp = useMemo(() => otpSent && otpCode.trim().length >= 6 && !otpLoading, [otpCode, otpLoading, otpSent]);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(homeForRole(user.role));
    }
  }, [router, status, user]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "access") {
      setError("We could not complete sign in. Please try again.");
    }
  }, []);

  const redirectAfterAuth = async () => {
    resetApiClientState();
    const nextUser = await refreshUser();
    if (!nextUser) {
      setError("This account is waiting for workspace access.");
      return false;
    }
    router.replace(homeForRole(nextUser.role));
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError("");

    try {
      if (isSupabaseConfigured) {
        const supabase = createClient();
        const { error: supabaseError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (supabaseError) {
          setError(supabaseError.message || "Invalid email or password.");
          setIsLoading(false);
          return;
        }
      } else if (legacyAuthEnabled) {
        const result = await api.auth.legacyLogin(email.trim(), password);
        if (!result.success || !result.data?.access_token) {
          setError(result.error || "Invalid email or password.");
          setIsLoading(false);
          return;
        }
        writeLegacyToken(result.data.access_token);
      } else {
        setError("Account access is unavailable right now.");
        setIsLoading(false);
        return;
      }

      await redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      if (!isSupabaseConfigured) {
        setError("Account access is unavailable right now.");
        setGoogleLoading(false);
        return;
      }
      const redirectTo = `${window.location.origin}/auth/callback?next=/fleet`;
      const { error: googleError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (googleError) {
        setError(googleError.message || "Could not continue with Google.");
        setGoogleLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue with Google.");
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!canSendOtp) return;
    setOtpLoading(true);
    setError("");
    try {
      if (!isSupabaseConfigured) {
        setError("Account access is unavailable right now.");
        setOtpLoading(false);
        return;
      }
      const target = codeTarget.trim();
      const supabase = createClient();
      const result =
        codeChannel === "email"
          ? await supabase.auth.signInWithOtp({
              email: target,
              options: {
                shouldCreateUser: false,
                emailRedirectTo: `${window.location.origin}/auth/callback?next=/fleet`,
              },
            })
          : await supabase.auth.signInWithOtp({
              phone: target,
              options: {
                shouldCreateUser: false,
              },
            });

      if (result.error) {
        setError(result.error.message || "Could not send the code.");
        setOtpLoading(false);
        return;
      }
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!canVerifyOtp) return;
    setOtpLoading(true);
    setError("");
    try {
      const target = codeTarget.trim();
      const supabase = createClient();
      const result =
        codeChannel === "email"
          ? await supabase.auth.verifyOtp({ email: target, token: otpCode.trim(), type: "email" })
          : await supabase.auth.verifyOtp({ phone: target, token: otpCode.trim(), type: "sms" });

      if (result.error) {
        setError(result.error.message || "That code did not work.");
        setOtpLoading(false);
        return;
      }
      await redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070a] text-text-primary">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 px-6 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:px-10">
        <section className="hidden lg:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-teal text-lg font-black text-bg-primary">
              T
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Trickee AI</p>
              <p className="text-sm text-text-dim">EV fleet intelligence</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-teal">Operations workspace</p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white">
            Access your fleet workspace.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-dim">
            Monitor active vehicles, coordinate shifts, and keep operations moving.
          </p>

          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            <AuthMetric label="Access" value="Secure" />
            <AuthMetric label="Teams" value="Ready" />
            <AuthMetric label="Fleet" value="Real-time" />
          </div>

          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-accent-green" />
              <div>
                <p className="text-sm font-semibold text-text-primary">Trusted access</p>
                <p className="mt-1 text-sm leading-6 text-text-dim">
                  Built for approved teams running daily fleet operations.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center lg:min-h-0">
          <div className="w-full max-w-[440px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-teal text-lg font-black text-bg-primary">
                T
              </div>
              <div>
                <p className="text-base font-semibold leading-tight">Trickee AI</p>
                <p className="text-sm text-text-dim">EV fleet intelligence</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-[#0b0f16] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
              <div className="mb-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim">Secure access</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Welcome back</h2>
                <p className="mt-2 text-sm leading-6 text-text-dim">Use your approved Trickee account to continue.</p>
              </div>

              <div className="space-y-5">
                <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={handleGoogleSignIn} isLoading={googleLoading}>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-[#111827]">G</span>
                  Continue with Google
                </Button>

                <div className="grid grid-cols-2 rounded-lg border border-white/[0.08] bg-white/[0.035] p-1">
                  {[
                    ["password", "Password"],
                    ["code", "One-time code"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setMode(value as LoginMode);
                        setError("");
                      }}
                      className={`h-9 rounded-md text-sm font-medium transition ${
                        mode === value ? "bg-white/[0.09] text-text-primary" : "text-text-dim hover:text-text-primary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {mode === "password" ? (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-xs font-medium text-text-dim">
                        Work email
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="name@company.com"
                          className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="password" className="text-xs font-medium text-text-dim">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Enter password"
                          className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-11 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                          required
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-text-dim transition hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/40"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="h-11 w-full gap-2" disabled={!canSubmit} isLoading={isLoading}>
                      Sign in
                      {!isLoading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["email", "Email"],
                        ["phone", "Mobile"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setCodeChannel(value as CodeChannel);
                            setOtpSent(false);
                            setOtpCode("");
                            setError("");
                          }}
                          className={`h-10 rounded-lg border text-sm font-medium transition ${
                            codeChannel === value
                              ? "border-accent-teal/60 bg-accent-teal/10 text-text-primary"
                              : "border-white/[0.08] bg-white/[0.03] text-text-dim hover:text-text-primary"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="code-target" className="text-xs font-medium text-text-dim">
                        {codeChannel === "email" ? "Work email" : "Mobile number"}
                      </label>
                      <div className="relative">
                        {codeChannel === "email" ? (
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                        ) : (
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                        )}
                        <input
                          id="code-target"
                          type={codeChannel === "email" ? "email" : "tel"}
                          inputMode={codeChannel === "email" ? "email" : "tel"}
                          autoComplete={codeChannel === "email" ? "email" : "tel"}
                          value={codeTarget}
                          onChange={(event) => {
                            setCodeTarget(event.target.value);
                            setOtpSent(false);
                            setOtpCode("");
                          }}
                          placeholder={codeChannel === "email" ? "name@company.com" : "+91 98765 43210"}
                          className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                        />
                      </div>
                    </div>

                    {otpSent && (
                      <div className="space-y-2">
                        <label htmlFor="otp-code" className="text-xs font-medium text-text-dim">
                          Verification code
                        </label>
                        <input
                          id="otp-code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={otpCode}
                          onChange={(event) => setOtpCode(event.target.value)}
                          placeholder="Enter code"
                          className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] px-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                        />
                      </div>
                    )}

                    <Button
                      type="button"
                      className="h-11 w-full gap-2"
                      disabled={otpSent ? !canVerifyOtp : !canSendOtp}
                      isLoading={otpLoading}
                      onClick={otpSent ? handleVerifyOtp : handleSendOtp}
                    >
                      {otpSent ? "Verify code" : "Send code"}
                    </Button>
                  </div>
                )}

                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-accent-red/25 bg-accent-red/10 p-3 text-sm text-accent-red">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
                <p className="text-xs leading-5 text-text-dim">
                  Your workspace opens with the right team permissions.
                </p>
              </div>

              <p className="mt-6 text-center text-sm text-text-dim">
                Need access?{" "}
                <Link href="/signup" className="font-medium text-text-primary underline-offset-4 transition hover:text-accent-teal hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
