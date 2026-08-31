"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  MapPin,
  Radio,
  RefreshCw,
  Route,
  Satellite,
  UploadCloud,
} from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { api } from "@/lib/api";
import type {
  GpsPilotServiceStatus,
  GpsPilotSnapshot,
} from "@/types/gps-pilot";

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

function formatAge(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "Unknown";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not available";
}

function statusVariant(status: GpsPilotServiceStatus) {
  if (status === "healthy") return "success" as const;
  if (status === "degraded") return "error" as const;
  return "warning" as const;
}

export default function GpsPilotPage() {
  const [snapshot, setSnapshot] = useState<GpsPilotSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const result = await api.admin.gpsPilot();
    setRefreshing(false);
    setLoading(false);
    if (!result.success) {
      const message = result.error || "The GPS Pilot service is temporarily unavailable.";
      setError(message);
      throw new Error(message);
    }
    setSnapshot(result.data);
    setError(null);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useVisibilityPolling(load, { intervalMs: 30_000 });

  const summary = snapshot?.summary;
  const kpis = [
    { label: "Active trips", value: summary?.active_trips ?? 0, icon: Route },
    { label: "GPS coverage", value: summary?.gps_availability_pct === null || summary?.gps_availability_pct === undefined ? "—" : `${summary.gps_availability_pct}%`, icon: Satellite },
    { label: "GPS gaps · 24h", value: summary?.gps_gaps ?? 0, icon: MapPin },
    { label: "Rejected · 24h", value: summary?.recent_rejections ?? 0, icon: AlertTriangle },
    { label: "Upload backlog", value: summary?.pending_outbox ?? 0, icon: UploadCloud },
    { label: "Stuck finalizers", value: summary?.stuck_finalizations ?? 0, icon: Database },
  ];

  return (
    <RoleGuard allowedRoles={["trickee_admin"]}>
      <div className="space-y-7 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h1 className="page-title">GPS Pilot Monitoring</h1>
              {snapshot && (
                <Badge variant={statusVariant(snapshot.service_status)}>
                  {snapshot.service_status}
                </Badge>
              )}
            </div>
            <p className="max-w-2xl text-sm text-text-dim">
              Live collection health, trip reconciliation, and upload readiness for the GPS Driver pilot.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-text-dim">
              <Clock3 className="h-3.5 w-3.5" />
              {snapshot ? `Snapshot ${formatDate(snapshot.generated_at)} · refreshes every 30 seconds while visible` : "Waiting for the first snapshot"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => load().catch(() => undefined)}
            isLoading={refreshing}
            aria-label="Refresh GPS Pilot snapshot"
          >
            {!refreshing && <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-accent-red/35 bg-accent-red/[0.04] p-4" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" />
              <div>
                <p className="text-sm font-semibold text-text-primary">Monitoring connection needs attention</p>
                <p className="mt-1 text-sm text-text-dim">{error}</p>
                {snapshot && <p className="mt-1 text-xs text-text-dim">The last successful snapshot remains visible below.</p>}
              </div>
            </div>
          </Card>
        )}

        {loading && !snapshot ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="Loading GPS Pilot monitoring">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-xl border border-bg-border bg-bg-card/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {kpis.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
                  </div>
                  <Icon className="h-5 w-5 text-accent-teal" />
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="h-4 w-4 text-accent-teal" /> Live vehicles
              </CardTitle>
              <p className="mt-1 text-xs text-text-dim">Latest accepted packet for each reporting vehicle.</p>
            </div>
            <Badge variant="outline">{snapshot?.live_vehicles.length ?? 0} reporting</Badge>
          </CardHeader>
          <CardContent>
            {snapshot?.live_vehicles.length ? (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {snapshot.live_vehicles.map((vehicle) => {
                  const hasPosition = Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude);
                  return (
                    <div key={`${vehicle.vehicle_id}-${vehicle.trip_id}`} className="rounded-xl border border-bg-border bg-bg-primary/45 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-text-primary">{vehicle.vehicle_code}</p>
                          <p className="mt-1 font-mono text-[11px] text-text-dim">Trip {vehicle.trip_id || "not active"}</p>
                        </div>
                        <Badge variant={vehicle.gps_available ? "success" : "warning"}>
                          {vehicle.gps_available ? "GPS fix" : "GPS gap"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div><p className="text-text-dim">Last packet</p><p className="mt-1 font-medium text-text-primary">{formatAge(vehicle.last_packet_age_seconds)}</p></div>
                        <div><p className="text-text-dim">Sequence</p><p className="mt-1 font-medium text-text-primary">{vehicle.sequence_no}</p></div>
                        <div><p className="text-text-dim">Collector</p><p className="mt-1 font-medium capitalize text-text-primary">{humanize(vehicle.collector_state)}</p></div>
                        <div><p className="text-text-dim">Phone backlog</p><p className="mt-1 font-medium text-text-primary">{vehicle.local_outbox_pending ?? "Unknown"}</p></div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-bg-border pt-3">
                        <p className="font-mono text-[11px] text-text-dim">
                          {hasPosition ? `${vehicle.latitude?.toFixed(5)}, ${vehicle.longitude?.toFixed(5)}` : "Position unavailable"}
                        </p>
                        {hasPosition && (
                          <a
                            href={`https://www.google.com/maps?q=${vehicle.latitude},${vehicle.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-accent-teal hover:underline"
                          >
                            Open map <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-bg-border px-5 py-10 text-center">
                <Satellite className="mx-auto h-6 w-6 text-text-dim" />
                <p className="mt-3 text-sm font-medium text-text-primary">No vehicle is reporting yet</p>
                <p className="mt-1 text-xs text-text-dim">Start a trip in GPS Driver to populate live packet health.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent trip reconciliation</CardTitle>
            <p className="text-xs text-text-dim">Latest 20 trips with GPS completeness, sequence progress, and label readiness.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-bg-border text-[10px] uppercase tracking-wider text-text-dim">
                <tr>
                  <th className="px-3 py-3 font-medium">Vehicle / trip</th>
                  <th className="px-3 py-3 font-medium">Started</th>
                  <th className="px-3 py-3 font-medium">Trip state</th>
                  <th className="px-3 py-3 font-medium">GPS coverage</th>
                  <th className="px-3 py-3 font-medium">Sequence</th>
                  <th className="px-3 py-3 font-medium">Missing</th>
                  <th className="px-3 py-3 font-medium">Training label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border/70">
                {snapshot?.recent_trips.map((trip) => (
                  <tr key={trip.trip_id}>
                    <td className="px-3 py-4"><p className="font-medium text-text-primary">{trip.vehicle_code || trip.vehicle_id}</p><p className="mt-1 font-mono text-[10px] text-text-dim">{trip.trip_id}</p></td>
                    <td className="px-3 py-4 text-xs text-text-dim">{formatDate(trip.started_at)}</td>
                    <td className="px-3 py-4"><Badge variant={trip.status === "completed" ? "success" : "info"}>{humanize(trip.status)}</Badge><p className="mt-2 text-[11px] text-text-dim">Finalizer: {humanize(trip.finalizer_state || trip.finalization_state)}</p></td>
                    <td className="px-3 py-4"><p className="font-semibold text-text-primary">{trip.gps_availability_pct === null ? "—" : `${trip.gps_availability_pct}%`}</p><p className="mt-1 text-[11px] text-text-dim">{trip.gps_windows}/{trip.stored_windows} windows</p></td>
                    <td className="px-3 py-4 text-xs text-text-dim">Uploaded {trip.uploaded_through}<br />Processed {trip.processed_through ?? "—"}<br />Final {trip.final_sequence_no ?? "—"}</td>
                    <td className="px-3 py-4"><Badge variant={(trip.missing_sequences ?? 0) > 0 ? "warning" : "success"}>{trip.missing_sequences ?? "Pending"}</Badge></td>
                    <td className="px-3 py-4">{trip.training_eligible === null ? <span className="text-xs text-text-dim">Pending</span> : <div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${trip.training_eligible ? "text-accent-green" : "text-text-dim"}`} /><span className="text-xs text-text-primary">{trip.training_eligible ? "Eligible" : "Excluded"}{trip.label_confidence !== null ? ` · ${Math.round(trip.label_confidence * 100)}%` : ""}</span></div>}</td>
                  </tr>
                ))}
                {!snapshot?.recent_trips.length && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-text-dim">No trips have reached the pilot backend yet.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle className="text-base">Recent packet rejections</CardTitle><p className="mt-1 text-xs text-text-dim">Latest validation failures in the last 24 hours.</p></div>
            <Badge variant={snapshot?.recent_rejections.length ? "warning" : "success"}>{snapshot?.recent_rejections.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot?.recent_rejections.map((rejection, index) => (
              <div key={`${rejection.received_at}-${rejection.sequence_no}-${index}`} className="flex flex-col gap-2 rounded-lg border border-bg-border bg-bg-primary/45 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium text-text-primary">{humanize(rejection.code)}</p><p className="mt-1 text-xs text-text-dim">{rejection.message}</p></div>
                <div className="text-left text-[11px] text-text-dim sm:text-right"><p>{formatDate(rejection.received_at)}</p><p className="mt-1 font-mono">Seq {rejection.sequence_no ?? "—"} · {rejection.trip_id || "No trip"}</p></div>
              </div>
            ))}
            {!snapshot?.recent_rejections.length && <p className="rounded-lg border border-dashed border-bg-border px-4 py-8 text-center text-sm text-text-dim">No packet rejections in the last 24 hours.</p>}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
