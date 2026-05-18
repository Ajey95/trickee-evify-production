"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BatteryWarning, CheckCircle2, DatabaseZap, MapPinOff, Thermometer } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { Vehicle } from "@/types";

export default function DataQualityPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [liveMap, setLiveMap] = useState<any | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [weekly, setWeekly] = useState<any | null>(null);

  useEffect(() => {
    async function load() {
      const [vehiclesResult, mapResult, fleetResult, weeklyResult] = await Promise.all([
        api.vehicles.list(),
        api.intelligence.liveMap(),
        api.intelligence.fleetLive(),
        api.intelligence.weeklyReport(),
      ]);
      if (vehiclesResult.success) setVehicles(vehiclesResult.data);
      if (mapResult.success) setLiveMap(mapResult.data);
      if (fleetResult.success) setFleetLive(fleetResult.data);
      if (weeklyResult.success) setWeekly(weeklyResult.data);
    }
    load();
  }, []);

  const rows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const latest = vehicle.latest_telemetry || vehicle.latest;
      const hasGps = latest?.lat != null && latest?.lng != null && latest.lat !== 0 && latest.lng !== 0;
      const hasBattery = latest?.soc != null && latest?.battery_voltage != null;
      const hasThermal = latest?.temp_max != null && Number(latest.temp_max) > 0;
      const ageMin = latest?.recorded_at ? (Date.now() - new Date(latest.recorded_at).getTime()) / 60000 : Infinity;
      const issues = [
        !latest ? "no latest telemetry" : "",
        !hasGps ? "missing GPS" : "",
        !hasBattery ? "missing battery" : "",
        !hasThermal ? "missing temp" : "",
        ageMin > 120 ? "stale" : "",
      ].filter(Boolean);
      return { vehicle, latest, hasGps, hasBattery, hasThermal, ageMin, issues };
    });
  }, [vehicles]);

  const total = rows.length || 1;
  const gpsCoverage = rows.filter((row) => row.hasGps).length / total;
  const batteryCoverage = rows.filter((row) => row.hasBattery).length / total;
  const staleCount = rows.filter((row) => row.ageMin > 120).length;
  const issueCount = rows.filter((row) => row.issues.length).length;
  const kpis = [
    { label: "GPS Coverage", value: `${Math.round(gpsCoverage * 100)}%`, icon: MapPinOff, variant: gpsCoverage > 0.8 ? "success" : "warning" },
    { label: "Battery Coverage", value: `${Math.round(batteryCoverage * 100)}%`, icon: BatteryWarning, variant: batteryCoverage > 0.9 ? "success" : "warning" },
    { label: "Stale Vehicles", value: staleCount, icon: AlertTriangle, variant: staleCount ? "warning" : "success" },
    { label: "Rows Flagged", value: issueCount, icon: DatabaseZap, variant: issueCount ? "warning" : "success" },
    { label: "Map Points", value: liveMap?.vehicle_points?.length || 0, icon: CheckCircle2, variant: "info" },
  ];

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Data Quality</h1>
          <p className="text-text-dim">GPS, battery, thermal, and freshness checks across the fleet.</p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {kpis.map(({ label, value, icon: Icon, variant }) => (
            <Card key={label} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-dim mb-2">{label}</p>
                  <p className="text-xl font-bold text-text-primary">{String(value)}</p>
                </div>
                <Icon className="w-5 h-5 text-accent-teal" />
              </div>
              <Badge className="mt-3" variant={variant as any}>{String(variant)}</Badge>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Vehicle Feed Checks</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-text-dim border-b border-bg-border">
                    <th className="py-3">Vehicle</th>
                    <th>SOC</th>
                    <th>GPS</th>
                    <th>Temp</th>
                    <th>Age</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.vehicle.id} className="border-b border-bg-border/60">
                      <td className="py-3 font-semibold text-text-primary">{row.vehicle.vehicle_code}</td>
                      <td>{row.latest?.soc != null ? `${Number(row.latest.soc).toFixed(1)}%` : "-"}</td>
                      <td>{row.hasGps ? "yes" : "no"}</td>
                      <td>{row.latest?.temp_max != null ? `${Number(row.latest.temp_max).toFixed(1)}C` : "-"}</td>
                      <td>{Number.isFinite(row.ageMin) ? `${Math.round(row.ageMin)}m` : "-"}</td>
                      <td>
                        <Badge variant={row.issues.length ? "warning" : "success"}>
                          {row.issues.length ? row.issues.join(", ") : "clean"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-accent-teal" />
                Operations Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Battery risk drivers", fleetLive?.summary?.battery_risk_drivers || 0],
                ["Inefficient drivers", fleetLive?.summary?.inefficient_drivers || 0],
                ["Charging opportunities", fleetLive?.summary?.charging_opportunities || 0],
                ["Weekly telemetry samples", weekly?.summary?.telemetry_samples || weekly?.telemetry_samples || 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <p className="text-xs text-text-dim">{String(label)}</p>
                  <p className="text-xl font-bold text-text-primary">{String(value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
