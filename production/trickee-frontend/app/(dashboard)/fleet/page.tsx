"use client";

import React, { useEffect, useState } from "react";
import { FleetKpiBar } from "@/components/fleet/FleetKpiBar";
import { VehicleCard } from "@/components/fleet/VehicleCard";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Vehicle } from "@/types";
import { api } from "@/lib/api";
import { BatteryWarning, MapPin, Sparkles } from "lucide-react";

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [liveMap, setLiveMap] = useState<any | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    async function loadVehicles() {
      setIsLoading(true);
      const [result, fleetLiveResult, liveMapResult, reportResult] = await Promise.all([
        api.vehicles.list(),
        api.intelligence.fleetLive(),
        api.intelligence.liveMap(),
        api.intelligence.weeklyReport(),
      ]);
      if (!active) return;
      if (result.success) {
        setVehicles(result.data.map((vehicle) => ({ ...vehicle, latest_telemetry: vehicle.latest_telemetry || vehicle.latest })));
        setLastSync(new Date());
        setError("");
      } else {
        setError(result.error || "Unable to load vehicles");
      }
      if (fleetLiveResult.success) setFleetLive(fleetLiveResult.data);
      if (liveMapResult.success) setLiveMap(liveMapResult.data);
      if (reportResult.success) setWeeklyReport(reportResult.data);
      setIsLoading(false);
    }
    loadVehicles();
    const interval = setInterval(loadVehicles, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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
                      <p className="text-xs text-text-dim">{row.next_best_action}</p>
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
            <p className="text-sm text-text-primary leading-relaxed">
              {weeklyReport?.report?.narrative || "Weekly report will appear after live telemetry metrics load."}
            </p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
