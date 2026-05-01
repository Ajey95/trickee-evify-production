"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DriverProfileCard } from "@/components/driver/DriverProfileCard";
import { NudgeCard } from "@/components/driver/NudgeCard";
import { TripHistoryTable } from "@/components/driver/TripHistoryTable";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Battery, Shield, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Driver, Vehicle } from "@/types";

export default function DriverProfilePage() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [behavior, setBehavior] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDriver() {
      setIsLoading(true);
      const mine = await api.drivers.me();
      let selectedDriver: Driver | null = mine.success ? mine.data : null;

      if (!selectedDriver) {
        const list = await api.drivers.list();
        selectedDriver = list.success && list.data.length ? list.data[0] : null;
      }

      if (!selectedDriver) {
        setError("No backend driver profile is available for this account.");
        setIsLoading(false);
        return;
      }

      setDriver(selectedDriver);
      const [tripResult, myVehicleResult, behaviorResult] = await Promise.all([
        api.drivers.trips(selectedDriver.id),
        api.vehicles.mine(),
        api.intelligence.driverBehavior(selectedDriver.id),
      ]);
      const vehicleResult = myVehicleResult.success ? myVehicleResult : await api.vehicles.list();

      if (tripResult.success) setTrips(tripResult.data);
      if (vehicleResult.success) setVehicles(vehicleResult.data);
      if (behaviorResult.success) setBehavior(behaviorResult.data);
      setError("");
      setIsLoading(false);
    }
    loadDriver();
  }, []);

  const currentVehicle = useMemo(() => {
    if (!driver) return null;
    return vehicles.find((vehicle) => (vehicle.latest_telemetry || vehicle.latest)?.driver_id === driver.id) || null;
  }, [driver, vehicles]);

  return (
    <RoleGuard allowedRoles={["driver", "trickee_admin"]}>
      <div className="space-y-8 pb-12">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="page-title mb-1">Driver Performance Profile</h1>
            <p className="text-text-dim">Backend-derived driving behavior, trips, and current vehicle state.</p>
          </div>
        </div>

        {isLoading && <Card><p className="text-sm text-text-dim">Loading backend driver profile...</p></Card>}
        {!isLoading && error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        {driver && (
          <>
            <DriverProfileCard driver={{ ...driver, ...(behavior || {}) }} currentVehicle={currentVehicle} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="w-5 h-5 text-accent-teal" />
                    <h2 className="section-title mb-0">Active Nudge</h2>
                  </div>
                  <NudgeCard nudge={null} />
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-5 h-5 text-accent-teal" />
                    <h2 className="section-title mb-0">Recent Trip History</h2>
                  </div>
                  <TripHistoryTable trips={trips} />
                </section>
              </div>

              <div className="space-y-8">
                <Card className="border-accent-teal/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Battery className="w-4 h-4 text-accent-teal" />
                      Current Vehicle Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentVehicle?.latest ? (
                      <div className="space-y-6">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="kpi-label">{currentVehicle.vehicle_code}</p>
                            <p className="text-2xl font-bold font-mono text-accent-teal">
                              {Number(currentVehicle.latest.soc ?? 0).toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="kpi-label">Est. Range</p>
                            <p className="text-2xl font-bold font-mono text-text-primary">
                              {Number(currentVehicle.latest_dynamic_range_km ?? 0).toFixed(1)} km
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] text-text-dim uppercase font-bold tracking-widest">
                            <span>Battery Level</span>
                            <span>{currentVehicle.latest.ignition_on ? "Driving" : "Idle"}</span>
                          </div>
                          <div className="h-2 bg-bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-accent-teal" style={{ width: `${Math.max(0, Math.min(100, currentVehicle.latest.soc || 0))}%` }} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text-dim">No current backend vehicle assignment found for this driver.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Behavior Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                      <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">Avg Current</p>
                      <p className="text-sm text-text-primary">{Number(driver.avg_current_30m ?? 0).toFixed(2)} A</p>
                    </div>
                    <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                      <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">Avg Speed</p>
                      <p className="text-sm text-text-primary">{Number(driver.avg_speed_30m ?? 0).toFixed(2)} km/h</p>
                    </div>
                    <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                      <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">Throttle Variance</p>
                      <p className="text-sm text-text-primary">{Number(driver.avg_throttle_variance ?? 0).toFixed(3)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
