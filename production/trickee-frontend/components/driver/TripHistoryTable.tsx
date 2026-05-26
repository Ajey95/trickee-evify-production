"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Check, Expand, Loader2, MapPin, X } from "lucide-react";
import { api } from "@/lib/api";

interface TripHistoryTableProps {
  trips: any[];
}

function projectPath(points: any[]) {
  const valid = points.filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)));
  if (!valid.length) return [];
  const lats = valid.map((point) => Number(point.lat));
  const lngs = valid.map((point) => Number(point.lng));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  return valid.map((point) => ({
    ...point,
    x: 30 + ((Number(point.lng) - minLng) / lngSpan) * 340,
    y: 210 - ((Number(point.lat) - minLat) / latSpan) * 160,
  }));
}

export const TripHistoryTable = ({ trips }: TripHistoryTableProps) => {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(trips[0]?.id || null);
  const [trace, setTrace] = useState<any | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState("");
  const [largeViewOpen, setLargeViewOpen] = useState(false);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0],
    [trips, selectedTripId]
  );
  const path = useMemo(() => projectPath(trace?.path || []), [trace]);
  const polyline = path.map((point) => `${point.x},${point.y}`).join(" ");
  const rawPath = trace?.path || [];
  const socValues = rawPath.map((point: any) => Number(point.soc)).filter((value: number) => Number.isFinite(value));
  const speedValues = rawPath.map((point: any) => Number(point.speed)).filter((value: number) => Number.isFinite(value));
  const socDrop =
    typeof selectedTrip?.soc_start === "number" && typeof selectedTrip?.soc_end === "number"
      ? selectedTrip.soc_start - selectedTrip.soc_end
      : socValues.length >= 2
      ? socValues[0] - socValues[socValues.length - 1]
      : null;
  const avgSpeed = speedValues.length ? speedValues.reduce((sum: number, value: number) => sum + value, 0) / speedValues.length : null;
  const distanceKm = Number(selectedTrip?.distance_km);
  const energyKwh = Number(selectedTrip?.kwh_used);
  const hasDistance = Number.isFinite(distanceKm) && distanceKm > 0;
  const hasEnergy = Number.isFinite(energyKwh) && energyKwh >= 0;
  const tariffPerKwhInr = 8;
  const fuelBenchmarkPerKmInr = 3.5;
  const estimatedEnergyCost = hasEnergy ? energyKwh * tariffPerKwhInr : null;
  const estimatedCostPerKm = hasDistance && estimatedEnergyCost !== null ? estimatedEnergyCost / distanceKm : null;
  const estimatedBenchmarkCost = hasDistance ? distanceKm * fuelBenchmarkPerKmInr : null;
  const estimatedTripSaving = estimatedBenchmarkCost !== null && estimatedEnergyCost !== null ? Math.max(estimatedBenchmarkCost - estimatedEnergyCost, 0) : null;
  const estimatedEnergyPerKm = hasDistance && hasEnergy ? energyKwh / distanceKm : null;
  const savingsCards = [
    ["Energy used", hasEnergy ? `${energyKwh.toFixed(2)} kWh` : "Pending"],
    ["Estimated energy cost", estimatedEnergyCost !== null ? `Rs ${estimatedEnergyCost.toFixed(0)}` : "Pending"],
    ["Estimated cost / km", estimatedCostPerKm !== null ? `Rs ${estimatedCostPerKm.toFixed(2)}` : "Pending"],
    ["Estimated saving", estimatedTripSaving !== null ? `Rs ${estimatedTripSaving.toFixed(0)}` : "Pending"],
  ];
  const futureOrderCards = [
    ["Orders linked", "Pending order feed"],
    ["Pickup wait window", "Pending order timestamps"],
    ["Charge during pickup", "Pending charger session link"],
  ];

  const loadTrace = useCallback(async (trip: any) => {
    setTraceLoading(true);
    setTraceError("");
    const result = await api.drivers.tripTrace(trip.driver_id, trip.id);
    if (result.success) {
      setTrace(result.data);
    } else {
      setTrace(null);
      setTraceError(result.error || "Unable to load trip route.");
    }
    setTraceLoading(false);
  }, []);

  async function selectTrip(trip: any) {
    setSelectedTripId(trip.id);
    await loadTrace(trip);
  }

  useEffect(() => {
    if (!trips.length || selectedTripId) return;
    setSelectedTripId(trips[0].id);
    loadTrace(trips[0]);
  }, [loadTrace, trips, selectedTripId]);

  if (!trips.length) {
    return (
      <div className="border border-bg-border rounded-xl p-6 text-sm text-text-dim">
        No trip history is available for this driver yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-bg-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Route Taken</TableHead>
              <TableHead>Recommended</TableHead>
              <TableHead>Nudge Followed</TableHead>
              <TableHead>Energy (kWh)</TableHead>
              <TableHead>SOC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((trip) => (
              <TableRow
                key={trip.id}
                onClick={() => selectTrip(trip)}
                className={`cursor-pointer transition hover:bg-accent-teal/5 ${selectedTrip?.id === trip.id ? "bg-accent-teal/10" : ""}`}
              >
                <TableCell className="font-mono text-xs">
                  {trip.started_at ? new Date(trip.started_at).toLocaleString() : "Unknown"}
                </TableCell>
                <TableCell className="font-medium">{trip.origin_label || "GPS inferred"}</TableCell>
                <TableCell>{trip.dest_label || "GPS inferred"}</TableCell>
                <TableCell>{trip.route_taken || "Unknown"}</TableCell>
                <TableCell className="text-text-dim">{trip.recommended_route || "None"}</TableCell>
                <TableCell>
                  {trip.followed_nudge === null || trip.followed_nudge === undefined ? (
                    <span className="text-xs text-text-dim">No outcome</span>
                  ) : trip.followed_nudge ? (
                    <Badge variant="success" className="px-1.5"><Check className="w-3 h-3 mr-1" /> Followed</Badge>
                  ) : (
                    <Badge variant="error" className="px-1.5"><X className="w-3 h-3 mr-1" /> Ignored</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono">{typeof trip.kwh_used === "number" ? trip.kwh_used.toFixed(2) : "-"}</TableCell>
                <TableCell className="font-mono">
                  {typeof trip.soc_start === "number" || typeof trip.soc_end === "number"
                    ? `${trip.soc_start ?? "-"}% -> ${trip.soc_end ?? "-"}%`
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-primary/40 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">Trip route</p>
            <p className="text-xs text-text-dim">
              {selectedTrip ? `${selectedTrip.origin_label || "Origin"} to ${selectedTrip.dest_label || "destination"}` : "Select a trip"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {path.length > 0 && (
              <button
                type="button"
                onClick={() => setLargeViewOpen(true)}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-bg-border px-3 text-xs font-semibold text-text-primary transition hover:border-accent-teal/50"
              >
                <Expand className="h-3.5 w-3.5" />
                Large view
              </button>
            )}
            {traceLoading ? <Loader2 className="h-4 w-4 animate-spin text-accent-teal" /> : <MapPin className="h-4 w-4 text-accent-teal" />}
          </div>
        </div>

        <div className="relative h-72 overflow-hidden rounded-xl border border-bg-border bg-[#0b1016]">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
          {path.length ? (
            <svg viewBox="0 0 400 240" className="absolute inset-0 h-full w-full">
              <polyline points={polyline} fill="none" stroke="rgba(0, 180, 216, 0.95)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={path[0].x} cy={path[0].y} r="6" fill="#75c995" />
              <circle cx={path[path.length - 1].x} cy={path[path.length - 1].y} r="6" fill="#df6d63" />
            </svg>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-center text-sm text-text-dim">
              {traceError || "Click a trip to load its route trace."}
            </div>
          )}
        </div>

        {trace && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <p className="font-semibold text-text-primary">{trace.source === "telemetry" ? "Telemetry trace" : "Trip endpoints"}</p>
              <p className="text-text-dim">Source</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">{trace.sample_count || path.length}</p>
              <p className="text-text-dim">GPS samples</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">{selectedTrip?.distance_km ? `${Number(selectedTrip.distance_km).toFixed(1)} km` : "-"}</p>
              <p className="text-text-dim">Distance</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">
                {selectedTrip?.started_at && selectedTrip?.ended_at
                  ? `${Math.round((new Date(selectedTrip.ended_at).getTime() - new Date(selectedTrip.started_at).getTime()) / 60000)} min`
                  : "-"}
              </p>
              <p className="text-text-dim">Duration</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">{socDrop !== null ? `${Number(socDrop).toFixed(1)}%` : "-"}</p>
              <p className="text-text-dim">SOC used</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">{avgSpeed !== null ? `${avgSpeed.toFixed(1)} km/h` : "-"}</p>
              <p className="text-text-dim">Avg speed</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">{typeof selectedTrip?.kwh_used === "number" ? `${selectedTrip.kwh_used.toFixed(2)} kWh` : "-"}</p>
              <p className="text-text-dim">Energy</p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">{selectedTrip?.route_taken || "Unknown"}</p>
              <p className="text-text-dim">Route</p>
            </div>
          </div>
        )}
      </div>

      {largeViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-secondary shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-bg-border p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-teal">Trip detail</p>
                <h3 className="mt-1 text-xl font-semibold text-text-primary">
                  {selectedTrip ? `${selectedTrip.origin_label || "Source"} to ${selectedTrip.dest_label || "Destination"}` : "Selected trip"}
                </h3>
                <p className="mt-1 text-sm text-text-dim">
                  {selectedTrip?.started_at ? new Date(selectedTrip.started_at).toLocaleString() : "Unknown start"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLargeViewOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-bg-border text-text-dim transition hover:text-text-primary"
                aria-label="Close trip detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-auto p-5 lg:grid-cols-[1fr_320px]">
              <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-bg-border bg-[#0b1016]">
                <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:36px_36px]" />
                {path.length ? (
                  <svg viewBox="0 0 400 240" className="absolute inset-0 h-full w-full">
                    <polyline points={polyline} fill="none" stroke="rgba(0, 180, 216, 0.95)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={path[0].x} cy={path[0].y} r="6" fill="#75c995" />
                    <circle cx={path[path.length - 1].x} cy={path[path.length - 1].y} r="6" fill="#df6d63" />
                  </svg>
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-sm text-text-dim">{traceError || "No route trace available."}</div>
                )}
                <div className="absolute left-4 top-4 rounded-lg border border-bg-border bg-bg-secondary/90 px-3 py-2 text-xs text-text-primary">
                  <span className="text-accent-green">●</span> Source
                  <span className="ml-3 text-accent-red">●</span> Destination
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ["Distance", selectedTrip?.distance_km ? `${Number(selectedTrip.distance_km).toFixed(1)} km` : "-"],
                  ["Duration", selectedTrip?.started_at && selectedTrip?.ended_at ? `${Math.round((new Date(selectedTrip.ended_at).getTime() - new Date(selectedTrip.started_at).getTime()) / 60000)} min` : "-"],
                  ["SOC used", socDrop !== null ? `${Number(socDrop).toFixed(1)}%` : "-"],
                  ["SOC start/end", typeof selectedTrip?.soc_start === "number" || typeof selectedTrip?.soc_end === "number" ? `${selectedTrip?.soc_start ?? "-"}% -> ${selectedTrip?.soc_end ?? "-"}%` : "-"],
                  ["Energy", typeof selectedTrip?.kwh_used === "number" ? `${selectedTrip.kwh_used.toFixed(2)} kWh` : "-"],
                  ["Energy / km", estimatedEnergyPerKm !== null ? `${estimatedEnergyPerKm.toFixed(2)} kWh/km` : "-"],
                  ["Trip cost", estimatedEnergyCost !== null ? `Rs ${estimatedEnergyCost.toFixed(0)}` : "-"],
                  ["Saving", estimatedTripSaving !== null ? `Rs ${estimatedTripSaving.toFixed(0)}` : "-"],
                  ["Avg speed", avgSpeed !== null ? `${avgSpeed.toFixed(1)} km/h` : "-"],
                  ["GPS samples", String(trace?.sample_count || path.length || 0)],
                  ["Route taken", selectedTrip?.route_taken || "Unknown"],
                  ["Recommended", selectedTrip?.recommended_route || "None"],
                  ["Nudge outcome", selectedTrip?.followed_nudge === true ? "Followed" : selectedTrip?.followed_nudge === false ? "Ignored" : "No outcome"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-bg-border bg-bg-primary/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">{label}</p>
                    <p className="mt-1 font-semibold text-text-primary">{value}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-accent-green/25 bg-accent-green/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-green">Savings model</p>
                  <p className="mt-1 text-xs leading-5 text-text-dim">
                    Estimated with Rs {tariffPerKwhInr}/kWh and Rs {fuelBenchmarkPerKmInr.toFixed(1)}/km benchmark.
                  </p>
                </div>
                {savingsCards.map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-bg-border bg-bg-primary/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">{label}</p>
                    <p className="mt-1 font-semibold text-text-primary">{value}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-bg-border bg-bg-primary/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">Future order metrics</p>
                  <div className="mt-2 space-y-2">
                    {futureOrderCards.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-text-dim">{label}</span>
                        <span className="text-right font-medium text-text-primary">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
