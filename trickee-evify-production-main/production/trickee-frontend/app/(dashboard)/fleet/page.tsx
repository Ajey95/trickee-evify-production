"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FleetKpiBar } from "@/components/fleet/FleetKpiBar";
import { VehicleCarousel } from "@/components/fleet/VehicleCarousel";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Vehicle } from "@/types";
import { api } from "@/lib/api";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { BatteryWarning, MapPin, Sparkles, UsersRound } from "lucide-react";
import ReactMarkdown from "react-markdown";

const ARCHETYPE_THEMES: Record<string, { label: string; color: string; bg: string; text: string }> = {
  range_saver: { label: "Range Saver", color: "var(--accent-teal)", bg: "rgba(0, 180, 216, 0.1)", text: "text-accent-teal" },
  late_charger: { label: "Late Charger", color: "var(--accent-red)", bg: "rgba(248, 81, 73, 0.1)", text: "text-accent-red" },
  aggressive: { label: "Aggressive Style", color: "var(--accent-magenta)", bg: "rgba(255, 0, 255, 0.1)", text: "text-accent-magenta" },
  moderate_driver: { label: "Balanced Cruiser", color: "var(--accent-green)", bg: "rgba(63, 185, 80, 0.1)", text: "text-accent-green" },
  data_poor: { label: "New Profile", color: "var(--text-dim)", bg: "rgba(139, 148, 158, 0.1)", text: "text-text-dim" },
};

function getArchetypeTheme(rawLabel: string) {
  const normalized = (rawLabel || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (normalized.includes("range_saver")) return ARCHETYPE_THEMES.range_saver;
  if (normalized.includes("late_charger")) return ARCHETYPE_THEMES.late_charger;
  if (normalized.includes("aggressive")) return ARCHETYPE_THEMES.aggressive;
  if (normalized.includes("moderate") || normalized.includes("balanced")) return ARCHETYPE_THEMES.moderate_driver;
  if (normalized.includes("poor") || normalized.includes("new")) return ARCHETYPE_THEMES.data_poor;
  
  return {
    label: rawLabel.replaceAll("_", " "),
    color: "var(--accent-teal)",
    bg: "rgba(0, 180, 216, 0.05)",
    text: "text-accent-teal"
  };
}

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [liveMap, setLiveMap] = useState<any | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<any | null>(null);
  const [behaviorHistory, setBehaviorHistory] = useState<any[]>([]);

  const loadFleetState = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    const [result, fleetLiveResult, liveMapResult, behaviorHistoryResult] = await Promise.all([
      api.vehicles.list(),
      api.intelligence.fleetLive(),
      api.intelligence.liveMap(),
      api.intelligence.driverBehaviorHistory(100),
    ]);
    if (result.success) {
      setVehicles(result.data.map((vehicle) => ({ ...vehicle, latest_telemetry: vehicle.latest_telemetry || vehicle.latest })));
      setLastSync(new Date());
      setError("");
    } else {
      setError(result.error || "Unable to load vehicles");
    }
    if (fleetLiveResult.success) setFleetLive(fleetLiveResult.data);
    if (liveMapResult.success) setLiveMap(liveMapResult.data);
    if (behaviorHistoryResult.success) setBehaviorHistory(behaviorHistoryResult.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      await loadFleetState(true);
      const reportResult = await api.intelligence.weeklyReport();
      if (active && reportResult.success) setWeeklyReport(reportResult.data);
    }
    loadInitial();
    return () => {
      active = false;
    };
  }, [loadFleetState]);

  useVisibilityPolling(() => loadFleetState(false), { intervalMs: 30_000 });

  const driversList = fleetLive?.drivers || [];
  const totalDriversCount = driversList.length;

  const distribution = Object.entries(
    driversList.reduce((acc: Record<string, number>, row: any) => {
      const label = row.archetype?.display_name || row.archetype?.label || "Unknown";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => {
    const numericCount = Number(count);
    const pct = totalDriversCount ? (numericCount / totalDriversCount) * 100 : 0;
    const theme = getArchetypeTheme(label);
    return { label, count: numericCount, pct, theme };
  }).sort((a, b) => b.count - a.count);

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="page-title mb-1">Fleet Overview</h1>
            <p className="text-text-dim">Real-time status of all vehicles in Evify Surat Fleet.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-dim uppercase tracking-widest mb-1">Last Sync</p>
            <p className="text-sm font-mono text-accent-teal">{lastSync ? lastSync.toLocaleTimeString() : "Loading"}</p>
          </div>
        </div>

        <FleetKpiBar vehicles={vehicles} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UsersRound className="w-4 h-4 text-accent-teal" />
                Driver Archetype Mix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 w-full">
                {distribution.map(({ label, count, pct, theme }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-text-primary flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.color }} />
                        {theme.label}
                      </span>
                      <span className="text-text-dim font-mono">
                        {count} {count === 1 ? "driver" : "drivers"} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-bg-border rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%`, backgroundColor: theme.color }}
                      />
                    </div>
                  </div>
                ))}
                {!driversList.length && (
                  <p className="text-sm text-text-dim py-2">Archetypes appear after live profiles load.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalization Coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Drivers profiled", fleetLive?.summary?.total_drivers || 0],
                ["Live telemetry", fleetLive?.summary?.active_drivers || 0],
                ["History snapshots", behaviorHistory.length],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <p className="text-xs text-text-dim">{label}</p>
                  <p className="text-sm font-bold text-text-primary">{String(value)}</p>
                </div>
              ))}
              <p className="text-xs text-text-dim leading-relaxed">
                Archetypes are driver-level signals used for dispatch, charging, and coaching. Fleet operators see the mix, not a manager profile.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BatteryWarning className="w-4 h-4 text-accent-teal" />
                Live Fleet Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {[
                  ["Active", fleetLive?.summary?.active_drivers || 0],
                  ["Battery Risk", fleetLive?.summary?.battery_risk_drivers || 0],
                  ["Inefficient", fleetLive?.summary?.inefficient_drivers || 0],
                  ["Waiting", fleetLive?.summary?.stuck_or_waiting_drivers || 0],
                  ["Charge Opps", fleetLive?.summary?.charging_opportunities || 0],
                ].map(([label, value]) => (
                  <div key={label} className="p-3 rounded-lg border border-bg-border bg-bg-primary/40">
                    <p className="text-lg font-bold text-text-primary">{value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {(fleetLive?.risk_lists?.battery_risk || []).slice(0, 4).map((row: any) => (
                  <div key={row.driver_id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-bg-border bg-bg-primary/30">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{row.driver_code} - {row.driver_name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="info">{row.archetype?.display_name || "Unknown"}</Badge>
                        <p className="text-xs text-text-dim">{row.next_best_action}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-accent-teal">{Number(row.latest_soc || 0).toFixed(1)}%</p>
                      <p className="text-[10px] uppercase tracking-wider text-text-dim">{row.risk_level || "low"}</p>
                    </div>
                  </div>
                ))}
                {!fleetLive?.risk_lists?.battery_risk?.length && (
                  <p className="text-sm text-text-dim">No high-risk drivers in the current live window.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent-teal" />
                Live Map Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg border border-bg-border bg-bg-primary/40">
                  <p className="text-lg font-bold text-text-primary">{liveMap?.vehicle_points?.length || 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Vehicles</p>
                </div>
                <div className="p-3 rounded-lg border border-bg-border bg-bg-primary/40">
                  <p className="text-lg font-bold text-text-primary">{liveMap?.low_soc_zones?.length || 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Low SOC</p>
                </div>
                <div className="p-3 rounded-lg border border-bg-border bg-bg-primary/40">
                  <p className="text-lg font-bold text-text-primary">{liveMap?.charger_points?.length || 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Chargers</p>
                </div>
              </div>
              {(liveMap?.vehicle_points || []).slice(0, 3).map((point: any) => (
                <div key={`${point.driver_id}-${point.vehicle_id}`} className="text-xs text-text-dim font-mono">
                  {point.driver_code}: {Number(point.lat).toFixed(4)}, {Number(point.lng).toFixed(4)} - {Number(point.soc).toFixed(1)}% SOC
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-teal" />
              Weekly Evify Live Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyReport?.report?.narrative ? (
              <div className="text-sm text-text-primary leading-relaxed space-y-2 [&>ul]:list-disc [&>ul]:pl-5 [&>p]:mb-2">
                <ReactMarkdown>
                  {weeklyReport.report.narrative}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-text-primary leading-relaxed">
                Weekly report will appear after live telemetry metrics load.
              </p>
            )}
          </CardContent>
        </Card>

        {isLoading && (
          <div className="py-24 flex justify-center">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        {!isLoading && !error && (
          <VehicleCarousel vehicles={vehicles} />
        )}
      </div>
    </RoleGuard>
  );
}
