"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<SignupState>("idle");
  const router = useRouter();
  const { refreshUser } = useAuth();

  useEffect(() => {
    api.auth.signupOptions().then((result) => {
      if (result.success) setVehicleOptions(result.data.vehicles || []);
    });
  }, []);

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

    setGoogleLoading(true);
    setError("");
    try {
      const result = await api.auth.googleLogin(idToken, {
        full_name: fullName.trim() || undefined,
        company: company.trim(),
        requested_role: requestedRole,
        requested_vehicle_id:
          requestedRole === "driver" ? requestedVehicleId : undefined,
      });

      if (result.success && result.data?.access_token) {
        writeAuthSession(result.data);
        resetApiClientState();
        const mappedUser = await refreshUser();
        if (mappedUser) {
          router.replace(homeForRole(mappedUser.role));
          return;
        }
      }

      const message = result.error || "Workspace access is pending approval.";
      if (/approval|workspace access|pending/i.test(message)) {
        setState("pending_mapping");
      } else {
        setError(message);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not continue with Google.";
      if (/approval|workspace access|pending/i.test(message)) {
        setState("pending_mapping");
      } else {
        setError(message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (state === "pending_mapping") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#05070a] px-6 text-text-primary">
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
    <main className="min-h-screen bg-[#05070a] px-6 py-10 text-text-primary">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/[0.09] bg-[#0b0f16] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
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
              <select
                id="requested-vehicle"
                value={requestedVehicleId}
                onChange={(event) => setRequestedVehicleId(event.target.value)}
                className="h-11 w-full rounded-lg border border-white/[0.1] bg-[#111722] px-3 text-sm outline-none focus:border-accent-teal/70"
              >
                <option value="">Select vehicle</option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_code}
                    {vehicle.fleet_name ? ` - ${vehicle.fleet_name}` : ""}
                  </option>
                ))}
              </select>
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
            <div className="flex items-start gap-2 rounded-lg border border-accent-red/30 bg-accent-red/8 p-3 text-sm text-accent-red">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
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
