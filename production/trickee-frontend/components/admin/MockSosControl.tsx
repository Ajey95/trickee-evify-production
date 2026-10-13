"use client";

import React from "react";
import { Power, ShieldAlert, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Vehicle } from "@/types";
import { Button } from "@/components/ui/Button";


export default function MockSosControl() {
  const [open, setOpen] = React.useState(false);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = React.useState("");
  const [reason, setReason] = React.useState("Dashboard demonstration");
  const [loadingVehicles, setLoadingVehicles] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState("");

  const showDialog = async () => {
    setOpen(true);
    setError("");
    setResult("");
    if (vehicles.length) return;

    setLoadingVehicles(true);
    const response = await api.vehicles.list();
    setLoadingVehicles(false);
    if (!response.success) {
      setError(response.error || "Unable to load vehicles.");
      return;
    }
    setVehicles(response.data);
    setVehicleId(response.data[0]?.id || "");
  };

  const runSimulation = async () => {
    if (!vehicleId) {
      setError("Select a vehicle first.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult("");
    const response = await api.admin.mockSos({
      vehicle_id: vehicleId,
      reason: reason.trim() || undefined,
    });
    setSubmitting(false);
    if (!response.success) {
      setError(response.error || "The simulation could not be recorded.");
      return;
    }
    setResult(response.data.message);
  };

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        className="h-10 gap-2 border border-red-300/35 shadow-[0_0_22px_rgba(248,81,73,0.22)]"
        onClick={showDialog}
        aria-haspopup="dialog"
      >
        <Power className="h-4 w-4" />
        <span className="hidden sm:inline">SOS mock</span>
        <span className="sm:hidden">SOS</span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mock-sos-title"
            className="w-full max-w-lg rounded-2xl border border-red-400/35 bg-[#0a1016] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Simulation only</p>
                  <h2 id="mock-sos-title" className="text-lg font-semibold text-text-primary">Mock remote vehicle off</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-text-dim transition hover:bg-white/5 hover:text-text-primary"
                aria-label="Close mock SOS dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/[0.06] p-4 text-sm leading-6 text-red-100">
              This records what a remote shutdown workflow could look like. It does not contact, disable, or send a command to any vehicle.
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-text-dim" htmlFor="mock-sos-vehicle">
              Vehicle
            </label>
            <select
              id="mock-sos-vehicle"
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              disabled={loadingVehicles || submitting}
              className="mt-2 h-11 w-full rounded-lg border border-bg-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-red-400/60"
            >
              <option value="">{loadingVehicles ? "Loading vehicles..." : "Select vehicle"}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.vehicle_code} - {vehicle.make} {vehicle.model}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-text-dim" htmlFor="mock-sos-reason">
              Simulation note
            </label>
            <input
              id="mock-sos-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
              maxLength={255}
              className="mt-2 h-11 w-full rounded-lg border border-bg-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-red-400/60"
            />

            {error ? <p className="mt-4 text-sm text-red-400" role="alert">{error}</p> : null}
            {result ? <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] p-3 text-sm text-emerald-300" role="status">{result}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button variant="danger" onClick={runSimulation} isLoading={submitting} disabled={!vehicleId || loadingVehicles}>
                <Power className="mr-2 h-4 w-4" />
                Run mock shutdown
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
