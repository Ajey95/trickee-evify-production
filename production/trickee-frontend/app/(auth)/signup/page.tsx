"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, resetApiClientState } from "@/lib/api";
import { homeForRole } from "@/lib/roles";
import { UserRole } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";
import { writePendingAccessRequest } from "@/lib/pending-access";

type SignupState = "idle" | "created" | "pending_mapping";
type SignupVehicleOption = { id: string; vehicle_code: string; fleet_id?: string; fleet_name?: string };

function passwordScore(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function StrengthBar({ password }: { password: string }) {
  const score = passwordScore(password);
  const labels = ["Minimum 8 characters", "Fair", "Good", "Strong"];
  const width = password ? `${Math.max(score, 1) * 25}%` : "0%";
  const color = score <= 1 ? "bg-accent-red" : score === 2 ? "bg-accent-amber" : "bg-accent-green";

  return (
    <div className="space-y-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width }} />
      </div>
      <p className="text-[11px] text-text-dim">{password ? labels[Math.min(score, 4) - 1] : "Use 8+ characters with a number or symbol."}</p>
    </div>
  );
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [requestedRole, setRequestedRole] = useState<Exclude<UserRole, "trickee_admin">>("fleet_operator");
  const [requestedVehicleId, setRequestedVehicleId] = useState("");
  const [vehicleOptions, setVehicleOptions] = useState<SignupVehicleOption[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<SignupState>("idle");
  const router = useRouter();
  const { refreshUser } = useAuth();

  useEffect(() => {
    api.auth.signupOptions().then((result) => {
      if (result.success) {
        setVehicleOptions(result.data.vehicles || []);
      }
    });
  }, []);

  const validationError = useMemo(() => {
    if (!fullName.trim()) return "Full name is required.";
    if (!company.trim()) return "Company or fleet name is required.";
    if (requestedRole === "driver" && !requestedVehicleId) return "Select your driver vehicle number.";
    if (!email.trim()) return "Work email is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  }, [company, confirmPassword, email, fullName, password, requestedRole, requestedVehicleId]);

  const canSubmit = !validationError && !isLoading;
  const canUseGoogle = Boolean(company.trim()) && (requestedRole !== "driver" || Boolean(requestedVehicleId)) && !googleLoading;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      if (!isSupabaseConfigured) {
        setError("Account access is unavailable right now.");
        setGoogleLoading(false);
        return;
      }
      if (!canUseGoogle) {
        setError("Select your access type and enter your company or fleet name before continuing with Google.");
        setGoogleLoading(false);
        return;
      }
      writePendingAccessRequest({
        full_name: fullName.trim() || undefined,
        company: company.trim(),
        requested_role: requestedRole,
        requested_vehicle_id: requestedRole === "driver" ? requestedVehicleId : undefined,
      });
      const { error: googleError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/fleet`,
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError("Account creation is unavailable right now.");
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName.trim(),
            company: company.trim(),
            requested_role: requestedRole,
            requested_vehicle_id: requestedRole === "driver" ? requestedVehicleId : undefined,
            access_request_source: "trickee_web",
          },
        },
      });

      if (signupError) {
        setError(signupError.message || "Could not create account.");
        setIsLoading(false);
        return;
      }

      resetApiClientState();
      await api.auth.accessRequest({
        email: email.trim(),
        full_name: fullName.trim(),
        company: company.trim(),
        requested_role: requestedRole,
        requested_vehicle_id: requestedRole === "driver" ? requestedVehicleId : undefined,
        supabase_user_id: data.user?.id,
      });
      if (data.session) {
        const mappedUser = await refreshUser();
        if (mappedUser) {
          router.replace(homeForRole(mappedUser.role));
          return;
        }
        setState("pending_mapping");
      } else {
        setState("created");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070a] text-text-primary">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 px-6 py-8 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:gap-16 lg:px-10">
        <section className="order-2 mt-10 lg:order-1 lg:mt-0">
          <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-text-dim transition hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          <div className="rounded-2xl border border-white/[0.09] bg-[#0b0f16] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
            {state === "idle" ? (
              <>
                <div className="mb-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim">Account access</p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Create your Trickee account</h1>
                  <p className="mt-2 text-sm leading-6 text-text-dim">
                    Select the access you need. Admin approval decides final workspace access.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="full-name" className="text-xs font-medium text-text-dim">
                        Full name
                      </label>
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                        <input
                          id="full-name"
                          autoComplete="name"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                          placeholder="Your name"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="company" className="text-xs font-medium text-text-dim">
                        Company / fleet
                      </label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                        <input
                          id="company"
                          autoComplete="organization"
                          value={company}
                          onChange={(event) => setCompany(event.target.value)}
                          className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                          placeholder="Fleet name"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-dim">
                      Requested access
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["fleet_operator", "Fleet manager"],
                        ["driver", "Driver"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setRequestedRole(value as Exclude<UserRole, "trickee_admin">);
                            if (value !== "driver") setRequestedVehicleId("");
                          }}
                          className={`h-10 rounded-lg border text-sm font-medium transition ${
                            requestedRole === value
                              ? "border-accent-teal/60 bg-accent-teal/10 text-text-primary"
                              : "border-white/[0.08] bg-white/[0.03] text-text-dim hover:text-text-primary"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] leading-5 text-text-dim">
                      This requested role is shown to the admin. It does not grant access until approval.
                    </p>
                  </div>

                  {requestedRole === "driver" && (
                    <div className="space-y-2">
                      <label htmlFor="driver-vehicle" className="text-xs font-medium text-text-dim">
                        Driver vehicle number
                      </label>
                      <select
                        id="driver-vehicle"
                        value={requestedVehicleId}
                        onChange={(event) => setRequestedVehicleId(event.target.value)}
                        className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] px-3 text-sm text-text-primary outline-none transition focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                        required
                      >
                        <option value="">Select your vehicle number</option>
                        {vehicleOptions.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.vehicle_code}{vehicle.fleet_name ? ` - ${vehicle.fleet_name}` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] leading-5 text-text-dim">
                        Admin can verify or change this vehicle before approving your driver access.
                      </p>
                    </div>
                  )}

                  <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={handleGoogleSignIn} isLoading={googleLoading} disabled={!canUseGoogle}>
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-[#111827]">G</span>
                    Continue with Google as {requestedRole === "driver" ? "Driver" : "Fleet manager"}
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.08]" />
                    <span className="text-[11px] font-medium text-text-dim">or use email password</span>
                    <div className="h-px flex-1 bg-white/[0.08]" />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-xs font-medium text-text-dim">
                      Work email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                      <input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                        placeholder="name@company.com"
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
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-11 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                        placeholder="Create password"
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
                    <StrengthBar password={password} />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-xs font-medium text-text-dim">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim/70 focus:border-accent-teal/70 focus:bg-white/[0.055] focus:ring-2 focus:ring-accent-teal/15"
                        placeholder="Confirm password"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-accent-red/25 bg-accent-red/10 p-3 text-sm text-accent-red">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" className="h-11 w-full gap-2" disabled={!canSubmit} isLoading={isLoading}>
                    Create account
                    {!isLoading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>
              </>
            ) : (
              <div className="py-4">
                <div className="mb-6 grid h-12 w-12 place-items-center rounded-full border border-accent-green/30 bg-accent-green/10 text-accent-green">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim">
                  {state === "created" ? "Verify email" : "Pending approval"}
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  {state === "created" ? "Check your inbox" : "Account created"}
                </h1>
                <p className="mt-3 text-sm leading-6 text-text-dim">
                  {state === "created"
                    ? "Check your inbox for a confirmation link, then return to sign in."
                    : "Your account is ready. Workspace access is pending approval."}
                </p>
                <Link href="/login" className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent-teal px-4 text-sm font-medium text-bg-primary transition hover:bg-[#11c1df]">
                  Go to sign in
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="order-1 lg:order-2">
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-teal text-lg font-black text-bg-primary">
              T
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Trickee</p>
              <p className="text-sm text-text-dim">EV fleet intelligence</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-teal">Team access</p>
          <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
            Built for operations teams.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-dim">
            A focused workspace for teams managing active EV fleets.
          </p>

          <div className="mt-10 grid gap-3">
            {[
              ["1", "Create account"],
              ["2", "Confirm email"],
              ["3", "Enter workspace"],
            ].map(([step, copy]) => (
              <div key={step} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.07] font-mono text-xs text-text-primary">{step}</span>
                <p className="text-sm text-text-dim">{copy}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
