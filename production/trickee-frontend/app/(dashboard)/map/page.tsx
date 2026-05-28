"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BatteryCharging, Clock, LocateFixed, MapPin, RefreshCcw, TriangleAlert } from "lucide-react";
import { LiveMapPanel } from "@/components/map/LiveMapPanel";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useDriverLocationWS } from "@/hooks/useDriverLocationWS";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useAuth } from "@/components/AuthProvider";

const MAP_POLL_MS = 30_000;
const MAP_REQUEST_TIMEOUT_MS = 20_000;
type BrowserLocation = { lat: number; lng: number; accuracy_m?: number; captured_at: string };

function isTransientMapError(message?: string) {
  const text = (message || "").toLowerCase();
  return text.includes("timed out") || text.includes("failed to fetch") || text.includes("network");
}

export default function LiveMapPage() {
  const { user } = useAuth();
  const [mapData, setMapData] = useState<any | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [browserLocation, setBrowserLocation] = useState<BrowserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "enabled" | "blocked">("idle");
  const mapDataRef = React.useRef<any | null>(null);
  const pollingRef = React.useRef(false);
  const locationWatchIdRef = React.useRef<number | null>(null);

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

  const pollLiveMap = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    const result = await api.intelligence.liveMap(selectedDriverId || undefined, {
      timeoutMs: MAP_REQUEST_TIMEOUT_MS,
      cacheTtlMs: 8_000,
    });
    pollingRef.current = false;
    if (result.success) {
      setMapData(result.data);
      setLastSync(new Date());
      setError("");
    } else if (!isTransientMapError(result.error)) {
      setError(result.error || "Unable to refresh live map data");
    }
  }, [selectedDriverId]);

  // Fallback only: when WebSocket is unavailable, refresh through REST with
  // visibility/idle awareness, backoff in the hook, and no overlapping calls.
  useVisibilityPolling(pollLiveMap, {
    enabled: !wsConnected,
    intervalMs: MAP_POLL_MS,
    immediate: true,
  });

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
      if (!isTransientMapError(message)) {
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

  const applyBrowserPosition = useCallback((position: GeolocationPosition) => {
    setBrowserLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
      captured_at: new Date(position.timestamp).toISOString(),
    });
    setLocationStatus("enabled");
    setError("");
  }, []);

  const clearBrowserLocationWatch = useCallback(() => {
    if (locationWatchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
  }, []);

  const stopBrowserLocation = useCallback(() => {
    clearBrowserLocationWatch();
    setLocationStatus("idle");
  }, [clearBrowserLocationWatch]);

  const requestBrowserLocation = useCallback(() => {
    if (locationStatus === "enabled") {
      stopBrowserLocation();
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocationStatus("blocked");
      setError("This browser does not support location access.");
      return;
    }

    setLocationStatus("requesting");
    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 15_000,
    };

    navigator.geolocation.getCurrentPosition(
      applyBrowserPosition,
      (geoError) => {
        setLocationStatus("blocked");
        setError(geoError.message || "Location permission was not allowed.");
      },
      options
    );

    clearBrowserLocationWatch();
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      applyBrowserPosition,
      (geoError) => {
        setLocationStatus("blocked");
        setError(geoError.message || "Location permission was not allowed.");
      },
      options
    );
  }, [applyBrowserPosition, clearBrowserLocationWatch, locationStatus, stopBrowserLocation]);

  useEffect(() => clearBrowserLocationWatch, [clearBrowserLocationWatch]);

  useEffect(() => {
    if (user?.role === "driver" && locationStatus === "idle") {
      requestBrowserLocation();
    }
  }, [locationStatus, requestBrowserLocation, user?.role]);

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator", "driver"]}>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">Live Fleet Map</h1>
            <p className="text-text-dim">Real-time vehicle locations, charging context, and operating risk zones.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              className="h-10 w-full rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal sm:min-w-[220px] sm:w-auto"
            >
              <option value="">All drivers</option>
              {drivers.map((driver: any) => (
                <option key={driver.driver_id} value={driver.driver_id}>
                  {driver.driver_code} - {driver.driver_name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="min-h-10 gap-2" onClick={loadMap} disabled={isLoading}>
              <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant={locationStatus === "enabled" ? "primary" : "outline"}
              size="sm"
              className="min-h-10 gap-2"
              onClick={requestBrowserLocation}
              disabled={locationStatus === "requesting"}
              title="Ask this browser for location permission"
            >
              <LocateFixed className={`w-4 h-4 ${locationStatus === "requesting" ? "animate-pulse" : ""}`} />
              {locationStatus === "enabled" ? "Location On" : "Use my location"}
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
            <div className="relative min-h-[560px] overflow-hidden rounded-[22px] border border-white/10 bg-[#eef0ec]">
              <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.55),transparent)] animate-pulse" />
              <div className="absolute left-5 top-5 h-20 w-56 rounded-2xl bg-white/60" />
              <div className="absolute bottom-5 left-5 h-10 w-96 max-w-[calc(100%-7rem)] rounded-2xl bg-white/60" />
              <div className="absolute bottom-5 right-5 h-24 w-11 rounded-2xl bg-white/60" />
              <div className="absolute left-[28%] top-[42%] h-8 w-28 rounded-full bg-white/70" />
              <div className="absolute left-[58%] top-[36%] h-8 w-28 rounded-full bg-white/70" />
              <div className="absolute left-[48%] top-[62%] h-24 w-24 rounded-full border border-[#df6d63]/30 bg-[#df6d63]/10" />
            </div>
          ) : (
            <LiveMapPanel
              data={mapData}
              selectedDriverId={selectedDriverId || undefined}
              wsConnected={wsConnected}
              userLocation={browserLocation}
            />
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
              <p className="text-xs text-text-dim">
                Chargers are ranked from the current visible driver or fleet positions. The list refreshes as live GPS changes.
              </p>
              {(mapData?.charger_points || []).map((charger: any) => (
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
                  {wsConnected ? "Connected" : "Reconnecting"}
                </p>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Last refresh</p>
                <p className="text-sm text-text-primary">{lastSync ? lastSync.toLocaleTimeString() : "Waiting"}</p>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Map updated</p>
                <p className="text-sm text-text-primary">
                  {mapData?.generated_at ? new Date(mapData.generated_at).toLocaleString() : "Waiting for vehicle data"}
                </p>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Map provider</p>
                <p className="text-sm text-text-primary">OpenStreetMap</p>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-1">Browser location</p>
                <p className="text-sm text-text-primary">
                  {browserLocation
                    ? `${browserLocation.lat.toFixed(5)}, ${browserLocation.lng.toFixed(5)}`
                    : locationStatus === "blocked"
                      ? "Permission blocked"
                      : "Tap Use my location"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
