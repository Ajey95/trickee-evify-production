"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, MapPinned, RefreshCcw, Route as RouteIcon } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { MapPicker, mapPresets, PickedPoint } from "@/components/intelligence/MapPicker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { Driver, Vehicle } from "@/types";
import { useAuth } from "@/components/AuthProvider";

const defaultOrigin: PickedPoint = { label: "Ring Road Depot", lat: 21.1702, lng: 72.8311 };
const defaultDestination: PickedPoint = { label: "Varachha Pickup", lat: 21.2131, lng: 72.8708 };
const slots = ["morning", "lunch_peak", "evening", "night"];
const scheduleDestinationPlan = mapPresets.filter((point) => point.label !== defaultOrigin.label);

function isSamePoint(a: PickedPoint, b: PickedPoint) {
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001;
}

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
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [origin, setOrigin] = useState<PickedPoint>(defaultOrigin);
  const [originAuto, setOriginAuto] = useState(true);
  const [destination, setDestination] = useState<PickedPoint>(defaultDestination);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState("");

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
      if (vehiclesResult.success) {
        setVehicles(vehiclesResult.data);
        setSelectedVehicleId(vehiclesResult.data[0]?.id || "");
      }
      if (!driversResult.success || !vehiclesResult.success) {
        setError(driversResult.error || vehiclesResult.error || "Unable to load schedule context.");
      }
    }
    load();
  }, [user?.role]);

  const selectedVehicle = useMemo(
    () =>
      vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ||
      vehicles.find((vehicle) => (vehicle.latest_telemetry || vehicle.latest)?.driver_id === selectedDriverId) ||
      vehicles[0],
    [selectedDriverId, selectedVehicleId, vehicles]
  );
  const socStart = Math.round((selectedVehicle?.latest_telemetry || selectedVehicle?.latest)?.soc || 60);
  const selectedVehiclePoint = useMemo(() => {
    const latest: any = selectedVehicle?.latest_telemetry || selectedVehicle?.latest;
    const lat = Number(latest?.lat);
    const lng = Number(latest?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;
    return {
      label: `${selectedVehicle?.vehicle_code || "Vehicle"} live GPS`,
      lat,
      lng,
    };
  }, [selectedVehicle]);
  const useRotatingDestinations = isSamePoint(destination, defaultDestination);

  useEffect(() => {
    if (originAuto && selectedVehiclePoint) {
      setOrigin(selectedVehiclePoint);
    }
  }, [originAuto, selectedVehiclePoint]);

  const handleOriginChange = (point: PickedPoint) => {
    setOriginAuto(false);
    setOrigin(point);
  };

  const buildSchedule = async () => {
    if (!selectedDriverId) return;
    setIsBuilding(true);
    setError("");
    const rows: any[] = [];
    for (let day = 0; day < 7; day += 1) {
      const dayDestination = useRotatingDestinations
        ? scheduleDestinationPlan[day % scheduleDestinationPlan.length] || destination
        : destination;
      const slot = slots[day % slots.length];
      const result = await api.routes.score({
        driver_id: selectedDriverId,
        soc_start: Math.max(25, socStart - day * 3),
        day_type: day === 5 || day === 6 ? "weekend" : "weekday",
        slot,
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: dayDestination.lat, lng: dayDestination.lng },
        origin_label: origin.label,
        dest_label: dayDestination.label,
      });
      const best: any = result.success ? result.data.ranked_routes?.[0] : null;
      rows.push({
        day,
        label: dateLabel(day),
        slot,
        destination: dayDestination.label,
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
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator", "driver"]}>
      <div className="space-y-5 pb-12 sm:space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">7-Day Route Schedule</h1>
            <p className="text-text-dim">Build a route-readiness plan using the selected driver, vehicle SOC, origin, destination, weekday/weekend pattern, and time slots.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto">
            <select
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              className="h-10 w-full rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal sm:min-w-[240px] sm:w-auto"
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.driver_code} - {driver.full_name}</option>
              ))}
            </select>
            <select
              value={selectedVehicle?.id || selectedVehicleId}
              onChange={(event) => setSelectedVehicleId(event.target.value)}
              className="h-10 w-full rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal sm:min-w-[180px] sm:w-auto"
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_code}</option>
              ))}
            </select>
            <Button onClick={buildSchedule} isLoading={isBuilding} className="min-h-10 w-full gap-2 sm:w-auto">
              <RefreshCcw className="w-4 h-4" />
              Build Schedule
            </Button>
          </div>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
            {[
              ["Driver", drivers.find((driver) => driver.id === selectedDriverId)?.full_name || "No driver selected"],
              ["Vehicle", selectedVehicle?.vehicle_code || "No vehicle selected"],
              ["Start SOC", `${socStart}%`],
              ["Plan basis", "Route score + battery margin"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPinned className="w-4 h-4 text-accent-teal" />
              Origin and Destination
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MapPicker origin={origin} destination={destination} onOriginChange={handleOriginChange} onDestinationChange={setDestination} />
          </CardContent>
        </Card>

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
                {row.destination && <p className="text-xs text-text-dim">{row.destination}</p>}
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
              ["Destination", useRotatingDestinations ? "7-day pilot zone rotation" : destination.label],
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
