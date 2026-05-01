"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RouteCompareCards } from "@/components/routes/RouteCompareCards";
import { NudgeCard } from "@/components/driver/NudgeCard";
import { EnergyBarChart } from "@/components/charts/EnergyBarChart";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Route as RouteIcon, Search, Clock, BarChart2, AlertTriangle, RefreshCw } from "lucide-react";
import { Driver, Route, Vehicle } from "@/types";
import { api } from "@/lib/api";

export default function RouteIntelligencePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [dayType, setDayType] = useState("weekday");
  const [slot, setSlot] = useState("morning");
  const [socStart, setSocStart] = useState(0);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [nudge, setNudge] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState("");
  const [rerouteAlert, setRerouteAlert] = useState<{ active: boolean; message: string } | null>(null);

  useEffect(() => {
    async function loadContext() {
      setIsLoading(true);
      const [myDriverResult, myVehiclesResult] = await Promise.all([api.drivers.me(), api.vehicles.mine()]);
      const driversResult = myDriverResult.success ? { success: true, data: [myDriverResult.data] } : await api.drivers.list();
      const vehiclesResult = myVehiclesResult.success ? myVehiclesResult : await api.vehicles.list();
      if (driversResult.success) {
        setDrivers(driversResult.data);
        setSelectedDriverId(driversResult.data[0]?.id || "");
      }
      if (vehiclesResult.success) {
        setVehicles(vehiclesResult.data);
        const firstVehicle = vehiclesResult.data[0];
        setSelectedVehicleId(firstVehicle?.id || "");
        setSocStart(Math.round((firstVehicle?.latest_telemetry || firstVehicle?.latest)?.soc || 0));
      }
      if (!driversResult.success || !vehiclesResult.success) {
        setError(driversResult.error || vehiclesResult.error || "Unable to load route context from backend.");
      }
      setIsLoading(false);
    }
    loadContext();
  }, []);

  const selectedDriver = useMemo(() => drivers.find((driver) => driver.id === selectedDriverId), [drivers, selectedDriverId]);
  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId), [vehicles, selectedVehicleId]);

  const normalizeRoutes = (rows: any[]): Route[] => rows.map((route, index) => ({
    rank: index + 1,
    route_id: route.route || route.route_id,
    route_name: route.route_name || route.name,
    distance_km: route.distance_km,
    avg_speed_kmh: route.avg_speed_kmh,
    google_eta_min: route.duration_min || route.personalized_eta_min,
    personalized_eta_min: route.personalized_eta_min,
    ev_kwh_used: route.ev_kwh_used || route.energy_kwh,
    soc_end_pct: route.soc_end_pct || route.soc_end,
    range_remaining_km: route.range_remaining_km || Math.max(0, (route.soc_end || 0) * 0.85),
    composite_score: route.composite_score,
    is_ev_optimal: index === 0,
    stop_and_go_index: route.stop_and_go_index,
  }));

  const handleCalculate = async () => {
    if (!selectedDriver) {
      setError("Select a backend driver before scoring routes.");
      return;
    }
    setIsCalculating(true);
    const result = await api.routes.score({
      driver_id: selectedDriver.id,
      soc_start: socStart,
      day_type: dayType,
      slot,
      origin_label: "",
      dest_label: "",
    });
    if (result.success) {
      const rankedRoutes = normalizeRoutes(result.data.ranked_routes || []);
      setRoutes(rankedRoutes);
      const best = rankedRoutes[0];
      setNudge({
        ...(result.data.nudge || result.data.departure_nudge || {}),
        route_name: best?.route_name,
        soc_start: socStart,
        soc_end: best?.soc_end_pct,
        range_remaining_km: best?.range_remaining_km,
      });
      setError("");
    } else {
      setError(result.error || "Backend route scoring failed.");
    }
    setIsCalculating(false);
  };

  const handleSimulateJam = async () => {
    if (!selectedVehicle || !selectedDriver || !routes.length) return;
    setIsLoading(true);
    const result = await api.routes.reroute({
      vehicle_id: selectedVehicle.id,
      driver_id: selectedDriver.id,
      incident_route_id: routes[0].route_id,
      incident_type: "traffic_jam",
      current_soc: socStart,
      day_type: dayType,
      slot,
    });
    if (result.success) {
      const recommended = result.data.recommended_reroute;
      setRerouteAlert({
        active: true,
        message: recommended?.name ? `Backend recommends ${recommended.name}.` : "Backend returned a reroute recommendation.",
      });
    } else {
      setError(result.error || "Backend reroute failed.");
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="page-title mb-1">Route Intelligence</h1>
          <p className="text-text-dim">Physics-aware route scoring from backend driver and vehicle context.</p>
        </div>
      </div>

      {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

      <Card className="border-bg-border/40">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest ml-1">Driver</label>
            <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} className="w-full bg-bg-primary border border-bg-border rounded-lg p-2.5 text-sm focus:border-accent-teal outline-none">
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest ml-1">Vehicle</label>
            <select value={selectedVehicleId} onChange={(e) => {
              const vehicle = vehicles.find((row) => row.id === e.target.value);
              setSelectedVehicleId(e.target.value);
              setSocStart(Math.round((vehicle?.latest_telemetry || vehicle?.latest)?.soc || 0));
            }} className="w-full bg-bg-primary border border-bg-border rounded-lg p-2.5 text-sm focus:border-accent-teal outline-none">
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_code}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest ml-1">Day Type</label>
            <select value={dayType} onChange={(e) => setDayType(e.target.value)} className="w-full bg-bg-primary border border-bg-border rounded-lg p-2.5 text-sm focus:border-accent-teal outline-none">
              <option value="weekday">Weekday</option>
              <option value="weekend">Weekend</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest ml-1">Time Slot</label>
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full bg-bg-primary border border-bg-border rounded-lg p-2.5 text-sm focus:border-accent-teal outline-none">
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="brunch">Brunch</option>
              <option value="night">Night</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest ml-1">SOC Start (%)</label>
            <input type="number" min="0" max="100" value={socStart} onChange={(e) => setSocStart(Number(e.target.value))} className="w-full bg-bg-primary border border-bg-border rounded-lg p-2.5 text-sm focus:border-accent-teal outline-none" />
          </div>
          <div className="flex items-end">
            <Button className="w-full h-[42px] gap-2" onClick={handleCalculate} isLoading={isCalculating || isLoading}>
              <Search className="w-4 h-4" />
              Score
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <RouteIcon className="w-5 h-5 text-accent-teal" />
          <h2 className="section-title mb-0">Ranked Alternatives</h2>
        </div>
        {routes.length ? <RouteCompareCards routes={routes} /> : <Card><p className="text-sm text-text-dim">Run backend route scoring to show ranked alternatives.</p></Card>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-accent-teal" />
            <h2 className="section-title mb-0">EV Energy Consumption Comparison</h2>
          </div>
          <Card className="h-[300px]">
            {routes.length ? <EnergyBarChart data={routes} /> : <div className="h-full flex items-center justify-center text-sm text-text-dim">No backend route output yet.</div>}
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-accent-teal" />
            <h2 className="section-title mb-0">Departure Nudge Engine</h2>
          </div>
          <NudgeCard nudge={nudge} />
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-accent-amber" />
          <h2 className="section-title mb-0">Dynamic Rerouting</h2>
        </div>
        <Card className="border-accent-amber/20 bg-accent-amber/[0.02]">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
            <div className="flex-1">
              <h3 className="font-bold text-text-primary text-lg mb-2">Backend Reroute Check</h3>
              <p className="text-sm text-text-dim leading-relaxed">
                Uses the selected backend vehicle, driver, and top ranked route from the latest scoring result.
              </p>
            </div>
            <Button variant="outline" className="border-accent-amber/50 text-accent-amber hover:bg-accent-amber/10 whitespace-nowrap gap-2" onClick={handleSimulateJam} isLoading={isLoading} disabled={!routes.length}>
              <RefreshCw className="w-4 h-4" />
              Ask Backend For Reroute
            </Button>
          </CardContent>

          {rerouteAlert && (
            <div className="mx-6 mb-6 p-4 rounded-xl bg-accent-teal/10 border border-accent-teal/30 flex items-start gap-4">
              <AlertTriangle className="w-5 h-5 text-accent-teal" />
              <p className="text-sm font-medium text-text-primary">{rerouteAlert.message}</p>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
