"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, MapPinned, RefreshCcw, Route as RouteIcon, Zap } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { MapPicker, PickedPoint } from "@/components/intelligence/MapPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { Driver, Vehicle } from "@/types";
import { useAuth } from "@/components/AuthProvider";

const defaultOrigin: PickedPoint = { label: "Ring Road Depot", lat: 21.1702, lng: 72.8311 };
const defaultDestination: PickedPoint = { label: "Varachha Pickup", lat: 21.2131, lng: 72.8708 };
const slots = ["morning", "lunch_peak", "evening", "night"];

function dateLabel(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function RouteSchedulePage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [origin, setOrigin] = useState<PickedPoint>(defaultOrigin);
  const [destination, setDestination] = useState<PickedPoint>(defaultDestination);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState("");

  const [chargePlan, setChargePlan] = useState<any | null>(null);
  const [isScoringRoute, setIsScoringRoute] = useState(false);

  useEffect(() => {
    async function load() {
      const [driversResult, vehiclesResult] =
        user?.role === "driver"
          ? await Promise.all([api.drivers.me().then((result) => ({ ...result, data: result.success ? [result.data] : [] })), api.vehicles.mine()])
          : await Promise.all([api.drivers.list(), api.vehicles.list()]);
      if (driversResult.success) {
        setDrivers(driversResult.data);
        setSelectedDriverId(driversResult.data[0]?.id || "");
      }
      if (vehiclesResult.success) setVehicles(vehiclesResult.data);
      if (!driversResult.success || !vehiclesResult.success) {
        setError(driversResult.error || vehiclesResult.error || "Unable to load schedule context.");
      }
    }
    load();
  }, [user?.role]);

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => (vehicle.latest_telemetry || vehicle.latest)?.driver_id === selectedDriverId) || vehicles[0], [selectedDriverId, vehicles]);
  const socStart = Math.round((selectedVehicle?.latest_telemetry || selectedVehicle?.latest)?.soc || 60);

  useEffect(() => {
    if (!selectedDriverId) return;
    let active = true;
    async function checkChargePlan() {
      setIsScoringRoute(true);
      const res = await api.routes.score({
        driver_id: selectedDriverId,
        soc_start: socStart,
        day_type: "weekday",
        slot: "lunch_peak",
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        origin_label: origin.label,
        dest_label: destination.label,
      });
      if (!active) return;
      setIsScoringRoute(false);
      if (res.success) {
        const data = res.data as any;
        const plan = data.destination_charge_plan || data.nudge?.destination_charge_plan || data.recommended_route?.destination_charge_plan || data.best_informational_route?.destination_charge_plan;
        setChargePlan(plan || null);
      } else {
        setChargePlan(null);
      }
    }
    checkChargePlan();
    return () => {
      active = false;
    };
  }, [selectedDriverId, origin.lat, origin.lng, destination.lat, destination.lng, socStart]);

  const buildSchedule = async () => {
    if (!selectedDriverId) return;
    setIsBuilding(true);
    setError("");
    const rows: any[] = [];
    for (let day = 0; day < 7; day += 1) {
      const slot = slots[day % slots.length];
      const result = await api.routes.score({
        driver_id: selectedDriverId,
        soc_start: Math.max(25, socStart - day * 3),
        day_type: day === 5 || day === 6 ? "weekend" : "weekday",
        slot,
        origin_label: origin.label,
        dest_label: destination.label,
      });
      const best: any = result.success ? result.data.ranked_routes?.[0] : null;
      rows.push({
        day,
        label: dateLabel(day),
        slot,
        status: result.success ? "planned" : "needs_review",
        route: best?.route_name || best?.name || "Route unavailable",
        eta: best?.personalized_eta_min || best?.duration_min || 0,
        soc_end: best?.soc_end_pct || best?.soc_end || 0,
        energy: best?.ev_kwh_used || best?.energy_kwh || 0,
      });
    }
    setSchedule(rows);
    setIsBuilding(false);
  };

  return (
    <RoleGuard allowedRoles={["trickee_admin", "driver"]}>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">7-Day Route Schedule</h1>
            <p className="text-text-dim">Plan a week of route choices from selected origin and destination points.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              className="h-10 min-w-[240px] rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal"
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.driver_code} - {driver.full_name}</option>
              ))}
            </select>
            <Button onClick={buildSchedule} isLoading={isBuilding} className="gap-2">
              <RefreshCcw className="w-4 h-4" />
              Build Schedule
            </Button>
          </div>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPinned className="w-4 h-4 text-accent-teal" />
              Origin and Destination
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MapPicker origin={origin} destination={destination} onOriginChange={setOrigin} onDestinationChange={setDestination} />
          </CardContent>
        </Card>

        {(chargePlan || isScoringRoute) && (
          <Card className={`border-l-4 relative overflow-hidden transition-all duration-300 ${!chargePlan ? "border-l-accent-teal bg-bg-card" : chargePlan.needed ? "border-l-accent-amber bg-accent-amber/5" : "border-l-accent-teal bg-accent-teal/5"} ${isScoringRoute ? "animate-pulse opacity-75" : ""}`}>
            {isScoringRoute && (
              <div className="absolute inset-0 bg-bg-card/30 backdrop-blur-[1.5px] flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent-teal font-mono uppercase tracking-wider">
                  <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                  Recalculating Destination Charge Plan...
                </div>
              </div>
            )}
            {chargePlan ? (
              <>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                    <Zap className={`w-4 h-4 ${chargePlan.needed ? "text-accent-amber" : "text-accent-teal"}`} />
                    Real-Time Destination Charge Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-primary leading-relaxed mb-4">{chargePlan.message || (chargePlan.needed ? "Charging required to complete the route safely." : "Sufficient battery to complete this route without charging.")}</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                      <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest font-mono">Required SOC</p>
                      <p className="text-lg font-bold font-mono text-text-primary">
                        {typeof chargePlan.destination_soc_required_pct === 'number' ? chargePlan.destination_soc_required_pct.toFixed(1) : typeof chargePlan.destination_soc_required === 'number' ? chargePlan.destination_soc_required.toFixed(1) : "0.0"}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                      <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest font-mono">Current SOC</p>
                      <p className="text-lg font-bold font-mono text-text-primary">
                        {typeof chargePlan.current_soc_pct === 'number' ? chargePlan.current_soc_pct.toFixed(1) : socStart.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                      <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest font-mono">Top-Up Needed</p>
                      <p className={`text-lg font-bold font-mono ${chargePlan.needed ? "text-accent-amber" : "text-accent-teal"}`}>
                        {typeof chargePlan.top_up_soc_pct === 'number' ? chargePlan.top_up_soc_pct.toFixed(1) : "0.0"}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                      <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest font-mono">Charge Duration</p>
                      <p className={`text-lg font-bold font-mono ${chargePlan.needed ? "text-accent-amber" : "text-text-primary"}`}>
                        {chargePlan.charge_minutes || 0} min
                      </p>
                    </div>
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3 col-span-2 md:col-span-1">
                      <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest font-mono">Recommended Charger</p>
                      <p className="text-sm font-bold text-text-primary truncate">
                        {chargePlan.charger_name || "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="p-6 text-center text-sm text-text-dim font-mono">
                No destination charge plan loaded yet. Click on the map or presets to pick coordinates.
              </div>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-7 gap-4">
          {Array.from({ length: 7 }, (_, index) => schedule[index] || {
            day: index,
            label: dateLabel(index),
            slot: slots[index % slots.length],
            status: "draft",
            route: "Run schedule",
            eta: 0,
            soc_end: 0,
            energy: 0,
          }).map((row) => (
            <Card key={row.day} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <p className="text-sm font-bold text-text-primary">{row.label}</p>
                  <p className="text-xs text-text-dim capitalize">{row.slot.replaceAll("_", " ")}</p>
                </div>
                <Badge variant={row.status === "planned" ? "success" : row.status === "draft" ? "outline" : "warning"}>
                  {row.status}
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RouteIcon className="w-4 h-4 text-accent-teal" />
                  <p className="text-xs text-text-primary font-semibold">{row.route}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-2">
                    <p className="text-text-dim">ETA</p>
                    <p className="font-bold text-text-primary">{Number(row.eta || 0).toFixed(0)}m</p>
                  </div>
                  <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-2">
                    <p className="text-text-dim">SOC end</p>
                    <p className="font-bold text-text-primary">{Number(row.soc_end || 0).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-accent-teal" />
              Dispatch Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ["Origin", origin.label],
              ["Destination", destination.label],
              ["Vehicle SOC", `${socStart}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-bg-border bg-bg-primary/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-green" />
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
                </div>
                <p className="text-sm font-semibold text-text-primary">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
