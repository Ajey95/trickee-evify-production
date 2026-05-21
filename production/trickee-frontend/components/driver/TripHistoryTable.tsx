"use client";

import React, { useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Check, Loader2, MapPin, X } from "lucide-react";
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

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0],
    [trips, selectedTripId]
  );
  const path = useMemo(() => projectPath(trace?.path || []), [trace]);
  const polyline = path.map((point) => `${point.x},${point.y}`).join(" ");

  async function selectTrip(trip: any) {
    setSelectedTripId(trip.id);
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
  }

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
          {traceLoading ? <Loader2 className="h-4 w-4 animate-spin text-accent-teal" /> : <MapPin className="h-4 w-4 text-accent-teal" />}
        </div>

        <div className="relative h-64 overflow-hidden rounded-xl border border-bg-border bg-[#0b1016]">
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
          </div>
        )}
      </div>
    </div>
  );
};
