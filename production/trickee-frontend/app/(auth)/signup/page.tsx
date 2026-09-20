"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, CheckCircle2, UserRound } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/AuthProvider";
import { api, resetApiClientState } from "@/lib/api";
import { writeAuthSession } from "@/lib/auth-storage";
import { homeForRole } from "@/lib/roles";
import type { UserRole } from "@/types";
import { ThemeToggle } from "@/components/ThemeToggle";

type SignupState = "idle" | "pending_mapping";
type SignupVehicleOption = {
  id: string;
  vehicle_code: string;
  fleet_id?: string;
  fleet_name?: string;
};

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [requestedRole, setRequestedRole] =
    useState<Exclude<UserRole, "trickee_admin">>("fleet_operator");
  const [requestedVehicleId, setRequestedVehicleId] = useState("");
  const [vehicleOptions, setVehicleOptions] = useState<SignupVehicleOption[]>(
    [],
  );
  const [vehicleOptionsState, setVehicleOptionsState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [vehicleOptionsError, setVehicleOptionsError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [workspaceRetryAvailable, setWorkspaceRetryAvailable] =
    useState(false);
  const [state, setState] = useState<SignupState>("idle");
  const mountedRef = useRef(false);
  const authAttemptRef = useRef(0);
  const router = useRouter();
  const { refreshUser } = useAuth();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authAttemptRef.current += 1;
    };
  }, []);

  const loadVehicleOptions = useCallback(async () => {
    setVehicleOptionsState("loading");
    setVehicleOptionsError("");
    try {
      const result = await api.auth.signupOptions();
      if (result.success) {
        setVehicleOptions(result.data?.vehicles || []);
        setVehicleOptionsState("ready");
        return;
      }
      setVehicleOptions([]);
      setVehicleOptionsError(
        result.error || "Could not load the available vehicles.",
      );
      setVehicleOptionsState("error");
    } catch (err) {
      setVehicleOptions([]);
      setVehicleOptionsError(
        err instanceof Error
          ? err.message
          : "Could not load the available vehicles.",
      );
      setVehicleOptionsState("error");
    }
  }, []);

  useEffect(() => {
    void loadVehicleOptions();
  }, [loadVehicleOptions]);

  const validationError = useMemo(() => {
    if (!company.trim()) return "Company or fleet name is required.";
    if (requestedRole === "driver" && !requestedVehicleId)
      return "Select your driver vehicle number.";
    return "";
  }, [company, requestedRole, requestedVehicleId]);

  const handleGoogleSignup = async (idToken: string) => {
    if (validationError) {
      setError(validationError);
      return;
    }

    const attempt = ++authAttemptRef.current;
    const isCurrent = () =>
      mountedRef.current && authAttemptRef.current === attempt;
    setGoogleLoading(true);
    setError("");
    setWorkspaceRetryAvailable(false);
    try {
      const result = await api.auth.googleLogin(idToken, {
        full_name: fullName.trim() || undefined,
        company: company.trim(),
        requested_role: requestedRole,
        requested_vehicle_id:
          requestedRole === "driver" ? requestedVehicleId : undefined,
      });
      if (!isCurrent()) return;

      if (result.success && result.data?.access_token) {
        writeAuthSession(result.data);
        resetApiClientState();
        const mappedUser = await refreshUser();
        if (!isCurrent()) return;
        if (mappedUser) {
          router.replace(homeForRole(mappedUser.role));
          return;
        }
        setError(
          "Signed in, but your workspace could not be loaded. Retry workspace access.",
        );
        setWorkspaceRetryAvailable(true);
        return;
      }

      const message = result.error || "Could not continue with Google.";
      if (/approval|workspace access|pending/i.test(message)) {
        setState("pending_mapping");
      } else {
        setError(message);
      }
    } catch (err) {
      if (!isCurrent()) return;
      const message =
        err instanceof Error ? err.message : "Could not continue with Google.";
      if (/approval|workspace access|pending/i.test(message)) {
        setState("pending_mapping");
      } else {
        setError(message);
      }
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

  if (state === "pending_mapping") {
    return (
      <main className="auth-root grid min-h-screen place-items-center bg-[#03070b] px-6 text-text-primary">
        <ThemeToggle className="theme-toggle-floating" />
        <section className="w-full max-w-md rounded-2xl border border-accent-amber/30 bg-[#0b0f16] p-7 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-amber/12 text-accent-amber">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Request received
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-dim">
            An admin must map your Google account to the requested Trickee
            workspace and role.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-accent-teal"
          >
            Return to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-root min-h-screen bg-[#03070b] px-6 py-10 text-text-primary">
      <ThemeToggle className="theme-toggle-floating" />
      <section className="relative mx-auto w-full max-w-xl rounded-[10px] border border-white/[0.11] bg-[#081119]/90 p-6 shadow-[0_28px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-teal">
          Workspace access
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Request a Trickee account
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-dim">
          Continue with Google after selecting the workspace access you need.
        </p>

        <div className="mt-7 space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="full-name"
              className="text-xs font-medium text-text-dim"
            >
              Full name
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                id="full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
                className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm outline-none focus:border-accent-teal/70"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="company"
              className="text-xs font-medium text-text-dim"
            >
              Company or fleet
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Fleet name"
                className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.035] pl-10 pr-3 text-sm outline-none focus:border-accent-teal/70"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="requested-role"
              className="text-xs font-medium text-text-dim"
            >
              Access type
            </label>
            <select
              id="requested-role"
              value={requestedRole}
              onChange={(event) => {
                setRequestedRole(
                  event.target.value as Exclude<UserRole, "trickee_admin">,
                );
                setRequestedVehicleId("");
              }}
              className="h-11 w-full rounded-lg border border-white/[0.1] bg-[#111722] px-3 text-sm outline-none focus:border-accent-teal/70"
            >
              <option value="fleet_operator">Fleet operator</option>
              <option value="driver">Driver</option>
            </select>
          </div>

          {requestedRole === "driver" && (
            <div className="space-y-2">
              <label
                htmlFor="requested-vehicle"
                className="text-xs font-medium text-text-dim"
              >
                Vehicle
              </label>
              {vehicleOptionsState === "loading" ? (
                <div
                  className="grid h-11 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.035] text-sm text-text-dim"
                  role="status"
                >
                  Loading available vehicles...
                </div>
              ) : vehicleOptionsState === "error" ? (
                <div
                  className="rounded-lg border border-accent-red/30 bg-accent-red/8 p-3"
                  role="alert"
                >
                  <p className="text-sm text-accent-red">
                    {vehicleOptionsError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-9 w-full"
                    onClick={() => void loadVehicleOptions()}
                  >
                    Retry vehicle list
                  </Button>
                </div>
              ) : (
                <>
                  <select
                    id="requested-vehicle"
                    value={requestedVehicleId}
                    onChange={(event) =>
                      setRequestedVehicleId(event.target.value)
                    }
                    className="h-11 w-full rounded-lg border border-white/[0.1] bg-[#111722] px-3 text-sm outline-none focus:border-accent-teal/70"
                    disabled={vehicleOptions.length === 0}
                  >
                    <option value="">Select vehicle</option>
                    {vehicleOptions.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.vehicle_code}
                        {vehicle.fleet_name ? ` - ${vehicle.fleet_name}` : ""}
                      </option>
                    ))}
                  </select>
                  {vehicleOptions.length === 0 && (
                    <div className="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3 text-sm text-text-dim">
                      <p>No driver vehicles are currently available.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 h-9 w-full"
                        onClick={() => void loadVehicleOptions()}
                      >
                        Retry vehicle list
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {validationError ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled
            >
              Complete the required fields
            </Button>
          ) : (
            <GoogleSignInButton
              disabled={googleLoading}
              onCredential={handleGoogleSignup}
              onError={setError}
            />
          )}

          {error && (
            <div className="rounded-lg border border-accent-red/30 bg-accent-red/8 p-3 text-sm text-accent-red">
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
        </div>

        <p className="mt-6 text-center text-sm text-text-dim">
          Already approved?{" "}
          <Link
            href="/login"
            className="font-medium text-text-primary transition hover:text-accent-teal"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
