"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DriverProfileCard } from "@/components/driver/DriverProfileCard";
import { NudgeCard } from "@/components/driver/NudgeCard";
import { TripHistoryTable } from "@/components/driver/TripHistoryTable";
import { ArchetypePanel } from "@/components/intelligence/ArchetypePanel";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Activity, Battery, Clock, MapPin, Navigation, Shield, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Driver, Vehicle } from "@/types";

export default function DriverProfilePage() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [behavior, setBehavior] = useState<any | null>(null);
  const [liveProfile, setLiveProfile] = useState<any | null>(null);
  const [liveDecision, setLiveDecision] = useState<any | null>(null);
  const [liveMap, setLiveMap] = useState<any | null>(null);
  const [behaviorHistory, setBehaviorHistory] = useState<any[]>([]);
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
        setError("No driver profile is available for this account.");
        setIsLoading(false);
        return;
      }

      setDriver(selectedDriver);
      const [tripResult, myVehicleResult, behaviorResult, liveProfileResult, liveDecisionResult, liveMapResult, behaviorHistoryResult] = await Promise.all([
        api.drivers.trips(selectedDriver.id),
        api.vehicles.mine(),
        api.intelligence.driverBehavior(selectedDriver.id),
        api.intelligence.driverLiveProfile(selectedDriver.id),
        api.intelligence.driverLiveDecision(selectedDriver.id),
        api.intelligence.liveMap(selectedDriver.id),
        api.intelligence.driverBehaviorHistory(50),
      ]);
      const vehicleResult = myVehicleResult.success ? myVehicleResult : await api.vehicles.list();

      if (tripResult.success) setTrips(tripResult.data);
      if (vehicleResult.success) setVehicles(vehicleResult.data);
      if (behaviorResult.success) setBehavior(behaviorResult.data);
      if (liveProfileResult.success) setLiveProfile(liveProfileResult.data);
      if (liveDecisionResult.success) setLiveDecision(liveDecisionResult.data);
      if (liveMapResult.success) setLiveMap(liveMapResult.data);
      if (behaviorHistoryResult.success) {
        setBehaviorHistory(behaviorHistoryResult.data.filter((row: any) => row.driver_id === selectedDriver.id));
      }
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
    <RoleGuard allowedRoles={["driver"]}>
      <div className="space-y-8 pb-12">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="page-title mb-1">Driver Performance Profile</h1>
            <p className="text-text-dim">Driving behavior, trips, and current vehicle state.</p>
          </div>
        </div>

        {isLoading && <Card><p className="text-sm text-text-dim">Loading driver profile...</p></Card>}
        {!isLoading && error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        {driver && (
          <>
            <DriverProfileCard driver={{ ...driver, ...(behavior || {}) }} currentVehicle={currentVehicle} />
            <ArchetypePanel archetype={liveProfile?.archetype || behavior?.archetype} history={behaviorHistory} />

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
                      <p className="text-sm text-text-dim">No current vehicle assignment found for this driver.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-accent-teal" />
                      Live Personalization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {liveProfile?.profile_status === "live" ? (
                      <>
                        <div className="p-4 rounded-xl border border-accent-teal/30 bg-accent-teal/5">
                          <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">Recommended Action</p>
                          <p className="text-sm text-text-primary leading-relaxed">
                            {liveDecision?.driver_nudge?.message || liveProfile.next_best_action}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">Risk</p>
                            <p className="text-sm text-text-primary capitalize">
                              {liveProfile.battery?.risk_level || "low"} ({Number(liveProfile.battery?.battery_risk_score || 0).toFixed(0)})
                            </p>
                          </div>
                          <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">GPS</p>
                            <p className="text-sm text-text-primary">{Number(liveProfile.location?.gps_coverage_pct || 0).toFixed(1)}%</p>
                          </div>
                          <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">Range</p>
                            <p className="text-sm text-text-primary">
                              {Number(liveDecision?.personalized_range?.estimated_range_km || 0).toFixed(1)} km
                            </p>
                          </div>
                          <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">SOC-Rise Charges</p>
                            <p className="text-sm text-text-primary">{liveProfile.charging?.soc_rise_events || 0}</p>
                          </div>
                          <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider mb-2">Stop/Wait</p>
                            <p className="text-sm text-text-primary">{Number(liveProfile.behavior?.stop_wait_pct || 0).toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40 space-y-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-accent-teal" />
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider">Live Wait State</p>
                          </div>
                          <p className="text-sm text-text-primary capitalize">
                            {(liveDecision?.wait_classification?.wait_type || "moving").replaceAll("_", " ")}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40 space-y-2">
                          <div className="flex items-center gap-2">
                            <Navigation className="w-4 h-4 text-accent-teal" />
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider">Nearest Charger</p>
                          </div>
                          {liveProfile.charging?.nearest_charger ? (
                            <p className="text-sm text-text-primary">
                              {liveProfile.charging.nearest_charger.name} - {liveProfile.charging.nearest_charger.distance_m}m
                            </p>
                          ) : (
                            <p className="text-sm text-text-dim">No charger context available for latest GPS point.</p>
                          )}
                        </div>
                        <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40 space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-accent-teal" />
                            <p className="text-xs font-bold text-text-dim uppercase tracking-wider">Operating Zone</p>
                          </div>
                          {liveProfile.location?.operating_zone?.center ? (
                            <p className="text-sm text-text-primary font-mono">
                              {Number(liveProfile.location.operating_zone.center.lat).toFixed(4)}, {Number(liveProfile.location.operating_zone.center.lng).toFixed(4)}
                            </p>
                          ) : (
                            <p className="text-sm text-text-dim">No live GPS profile yet.</p>
                          )}
                        </div>
                        <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40 space-y-3">
                          <p className="text-xs font-bold text-text-dim uppercase tracking-wider">Map Context</p>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <p className="text-lg font-bold text-text-primary">{liveMap?.vehicle_points?.length || 0}</p>
                              <p className="text-[10px] uppercase tracking-wider text-text-dim">Vehicle</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-text-primary">{liveMap?.low_soc_zones?.length || 0}</p>
                              <p className="text-[10px] uppercase tracking-wider text-text-dim">Low SOC</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-text-primary">{liveMap?.charger_points?.length || 0}</p>
                              <p className="text-[10px] uppercase tracking-wider text-text-dim">Chargers</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-text-dim">Live telemetry profile is not available yet.</p>
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
