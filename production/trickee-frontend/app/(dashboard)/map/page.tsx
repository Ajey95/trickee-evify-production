"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BatteryCharging, Clock, MapPin, RefreshCcw, TriangleAlert } from "lucide-react";
import { LiveMapPanel } from "@/components/map/LiveMapPanel";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useDriverLocationWS } from "@/hooks/useDriverLocationWS";

const MAP_POLL_MS = 15_000;
const MAP_REQUEST_TIMEOUT_MS = 20_000;

function isTransientMapError(message?: string) {
  const text = (message || "").toLowerCase();
  return text.includes("timed out") || text.includes("failed to fetch") || text.includes("network");
}

export default function LiveMapPage() {
  const [mapData, setMapData] = useState<any | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const mapDataRef = React.useRef<any | null>(null);

  useEffect(() => {
    mapDataRef.current = mapData;
  }, [mapData]);

  const drivers = useMemo(() => fleetLive?.drivers || [], [fleetLive]);
  const visibleVehicles = useMemo(() => {
    const rows = mapData?.vehicle_points || [];
    return selectedDriverId ? rows.filter((row: any) => row.driver_id === selectedDriverId) : rows;
  }, [mapData, selectedDriverId]);

  // ── WebSocket live updates ────────────────────────────────────────────────
  const { data: wsMapData, connected: wsConnected } = useDriverLocationWS(selectedDriverId || undefined);

  // Propagate incoming WS snapshots to local state.
  useEffect(() => {
    if (!wsMapData) return;
    setMapData(wsMapData);
    setLastSync(new Date());
    setError("");
    setIsLoading(false);
  }, [wsMapData]);

  // Fallback: when WebSocket is not connected, poll the REST endpoint
  // so the map stays reasonably fresh even if WS is unavailable.
  useEffect(() => {
    if (wsConnected) return;
    let active = true;
    let polling = false;

    async function pollLiveMap() {
      if (!active || polling) return;
      polling = true;
      const result = await api.intelligence.liveMap(selectedDriverId || undefined, {
        timeoutMs: MAP_REQUEST_TIMEOUT_MS,
        cacheTtlMs: 8_000,
      });
      polling = false;
      if (!active) return;
      if (result.success) {
        setMapData(result.data);
        setLastSync(new Date());
        setError("");
      } else if (!mapDataRef.current || !isTransientMapError(result.error)) {
        setError(result.error || "Unable to refresh live map data");
      }
    }

    pollLiveMap();
    const interval = setInterval(pollLiveMap, MAP_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [wsConnected, selectedDriverId]);

  // ── Manual / initial load (also refreshes fleet summary) ─────────────────
  const loadMap = useCallback(async () => {
    setIsLoading(true);
    const [mapResult, fleetResult] = await Promise.all([
      api.intelligence.liveMap(selectedDriverId || undefined, {
        timeoutMs: MAP_REQUEST_TIMEOUT_MS,
        cacheTtlMs: 8_000,
      }),
      api.intelligence.fleetLive(),
    ]);

    if (mapResult.success) {
      setMapData(mapResult.data);
      setError("");
      setLastSync(new Date());
    } else {
      const message = mapResult.error || "Unable to load live map data";
      if (!mapDataRef.current || !isTransientMapError(message)) {
        setError(message);
      }
    }

    if (fleetResult.success) {
      setFleetLive(fleetResult.data);
    }
    setIsLoading(false);
  }, [selectedDriverId]);

  // Run once on mount (and when selectedDriverId changes) to populate the page
  // immediately, before the WebSocket delivers its first push.
  useEffect(() => {
    loadMap();
  }, [loadMap]);

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator", "driver"]}>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">Live Fleet Map</h1>
            <p className="text-text-dim">
              Live telemetry locations, low-SOC risk zones, frequent stop zones, and charger context.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              className="h-10 min-w-[220px] rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal"
            >
              <option value="">All drivers</option>
              {drivers.map((driver: any) => (
                <option key={driver.driver_id} value={driver.driver_id}>
                  {driver.driver_code} - {driver.driver_name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="gap-2" onClick={loadMap} disabled={isLoading}>
              <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            ["Vehicles", visibleVehicles.length, Activity],
            ["Battery Risk", fleetLive?.summary?.battery_risk_drivers || 0, TriangleAlert],
            ["Waiting", fleetLive?.summary?.stuck_or_waiting_drivers || 0, Clock],
            ["Chargers", mapData?.charger_points?.length || 0, BatteryCharging],
            ["Low SOC Zones", mapData?.low_soc_zones?.length || 0, MapPin],
          ].map(([label, value, Icon]) => (
            <Card key={String(label)} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-bold text-text-primary">{String(value)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">{String(label)}</p>
                </div>
                <Icon className="w-5 h-5 text-accent-teal" />
              </div>
            </Card>
          ))}
        </div>

        {error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        <Card className="p-4">
          {isLoading && !mapData ? (
            <div className="min-h-[560px] flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <LiveMapPanel data={mapData} selectedDriverId={selectedDriverId || undefined} wsConnected={wsConnected} />
          )}
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Vehicles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleVehicles.slice(0, 8).map((point: any) => (
                <div key={`${point.driver_id}-${point.vehicle_id}`} className="flex items-center justify-between gap-4 rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{point.driver_code}</p>
                    <p className="text-xs text-text-dim font-mono">
                      {Number(point.lat).toFixed(4)}, {Number(point.lng).toFixed(4)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-accent-teal">{Number(point.soc || 0).toFixed(1)}%</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">{point.risk_level || "low"}</p>
                  </div>
                </div>
              ))}
              {!visibleVehicles.length && <p className="text-sm text-text-dim">No live vehicle GPS points available.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charging Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(mapData?.charger_points || []).slice(0, 8).map((charger: any) => (
                <div key={`${charger.name}-${charger.lat}-${charger.lng}`} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <p className="text-sm font-semibold text-text-primary">{charger.name}</p>
                  <p className="text-xs text-text-dim">
                    {Number(charger.distance_m || 0).toLocaleString()}m - {charger.source || "live"}
                  </p>
                </div>
              ))}
              {!mapData?.charger_points?.length && <p className="text-sm text-text-dim">No charger context yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Connection</p>
                <p className={`text-sm font-semibold ${wsConnected ? "text-accent-green" : "text-accent-amber"}`}>
                  {wsConnected ? "● WebSocket live" : "○ REST polling (5 s)"}
                </p>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Last frontend refresh</p>
                <p className="text-sm text-text-primary">{lastSync ? lastSync.toLocaleTimeString() : "Waiting"}</p>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Backend map generated</p>
                <p className="text-sm text-text-primary">
                  {mapData?.generated_at ? new Date(mapData.generated_at).toLocaleString() : "Waiting for live data"}
                </p>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Map provider</p>
                <p className="text-sm text-text-primary">OpenStreetMap via Leaflet</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
