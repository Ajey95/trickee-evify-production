"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { ScoreGauge } from "@/components/scorecards/ScoreGauge";
import { DriverRadarChart } from "@/components/charts/DriverRadarChart";
import { User, X } from "lucide-react";
import { api } from "@/lib/api";
import { Driver } from "@/types";

function scoreDriver(driver: Driver) {
  const regen = Math.max(0, Math.min(100, Number(driver.avg_regen_ratio || 0) * 100));
  const throttle = Math.max(0, Math.min(100, 100 - Number(driver.avg_throttle_variance || 0) * 100));
  const current = Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_current_30m || 0)) * 4));
  const speed = Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_speed_30m || 0) - 25)));
  return Math.round((regen + throttle + current + speed) / 4);
}

function radarData(driver: Driver) {
  return [
    { subject: "Current Control", A: Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_current_30m || 0)) * 4)), fullMark: 100 },
    { subject: "Regen Usage", A: Math.max(0, Math.min(100, Number(driver.avg_regen_ratio || 0) * 100)), fullMark: 100 },
    { subject: "Throttle Smoothness", A: Math.max(0, Math.min(100, 100 - Number(driver.avg_throttle_variance || 0) * 100)), fullMark: 100 },
    { subject: "Speed Stability", A: Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_speed_30m || 0) - 25))), fullMark: 100 },
  ];
}

export default function ScorecardsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDrivers() {
      const result = await api.drivers.list();
      if (result.success) {
        setDrivers(result.data);
        setSelectedDriver(result.data[0] || null);
        setError("");
      } else {
        setError(result.error || "Unable to load backend drivers.");
      }
    }
    loadDrivers();
  }, []);

  const rankedDrivers = useMemo(
    () => [...drivers].sort((a, b) => scoreDriver(b) - scoreDriver(a)),
    [drivers]
  );

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Driver Scorecards</h1>
          <p className="text-text-dim">Fleet-wide rankings from backend driver behavior metrics.</p>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Avg Current</TableHead>
                    <TableHead>Avg Speed</TableHead>
                    <TableHead>Regen</TableHead>
                    <TableHead>Throttle Var</TableHead>
                    <TableHead>Efficiency Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedDrivers.map((driver, i) => (
                    <TableRow key={driver.id} className="cursor-pointer group" onClick={() => setSelectedDriver(driver)}>
                      <TableCell className="text-text-dim font-mono">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-bg-border flex items-center justify-center text-[10px] font-bold">
                            {driver.full_name.split(" ").map((name) => name[0]).join("")}
                          </div>
                          <div>
                            <p className="font-bold text-text-primary group-hover:text-accent-teal transition-colors">{driver.full_name}</p>
                            <p className="text-[10px] text-text-dim">{driver.driver_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={driver.style_label === "Efficient" ? "success" : driver.style_label === "Aggressive" ? "error" : "info"}>
                          {driver.style_label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{Number(driver.avg_current_30m || 0).toFixed(2)} A</TableCell>
                      <TableCell className="font-mono">{Number(driver.avg_speed_30m || 0).toFixed(2)} km/h</TableCell>
                      <TableCell className="font-mono">{(Number(driver.avg_regen_ratio || 0) * 100).toFixed(0)}%</TableCell>
                      <TableCell className="font-mono">{Number(driver.avg_throttle_variance || 0).toFixed(3)}</TableCell>
                      <TableCell><ScoreGauge score={scoreDriver(driver)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!rankedDrivers.length && <div className="p-6 text-sm text-text-dim">No backend drivers available.</div>}
            </Card>
          </div>

          {selectedDriver && (
            <div className="lg:w-[400px] animate-in slide-in-from-right-8 duration-500">
              <Card className="sticky top-24 border-accent-teal/30 bg-accent-teal/[0.02]">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-bg-primary border border-bg-border flex items-center justify-center">
                      <User className="w-6 h-6 text-accent-teal" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-text-primary">{selectedDriver.full_name}</h3>
                      <p className="text-xs text-text-dim">{selectedDriver.driver_code} | {selectedDriver.style_label} Style</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDriver(null)} className="p-1.5 hover:bg-bg-border/50 rounded-full transition-colors">
                    <X className="w-5 h-5 text-text-dim" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="h-[250px] w-full">
                    <DriverRadarChart data={radarData(selectedDriver)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-bg-primary/50 border border-bg-border/30">
                      <p className="kpi-label">Personal Factor</p>
                      <p className="font-mono font-bold">{Number(selectedDriver.personal_factor || 0).toFixed(3)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-bg-primary/50 border border-bg-border/30">
                      <p className="kpi-label">Score</p>
                      <p className="font-mono font-bold">{scoreDriver(selectedDriver)}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
