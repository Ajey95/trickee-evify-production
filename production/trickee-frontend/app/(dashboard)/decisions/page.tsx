"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BatteryCharging, Clock, History, PackageCheck, Sparkles } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PitchTelemetryCharts } from "@/components/intelligence/PitchTelemetryCharts";
import { api } from "@/lib/api";
import { Driver, Vehicle } from "@/types";

function fmt(value: any, digits = 1) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : "-";
}

function shortDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default function DecisionsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [liveMap, setLiveMap] = useState<any | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [waitResult, setWaitResult] = useState<any | null>(null);
  const [orderResult, setOrderResult] = useState<any | null>(null);
  const [chargingResult, setChargingResult] = useState<any | null>(null);
  const [history, setHistory] = useState<{ waits: any[]; orders: any[]; charging: any[]; nudges: any[] }>({
    waits: [],
    orders: [],
    charging: [],
    nudges: [],
  });
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [driversResult, vehiclesResult, mapResult, fleetResult, waits, orders, charging, nudges] = await Promise.all([
        api.drivers.list(),
        api.vehicles.list(),
        api.intelligence.liveMap(),
        api.intelligence.fleetLive(),
        api.intelligence.waits(20),
        api.intelligence.orderAssignments(20),
        api.intelligence.chargingDecisions(20),
        api.intelligence.nudges(20),
      ]);
      if (driversResult.success) {
        setDrivers(driversResult.data);
        setSelectedDriverId(driversResult.data[0]?.id || "");
      }
      if (vehiclesResult.success) setVehicles(vehiclesResult.data);
      if (mapResult.success) setLiveMap(mapResult.data);
      if (fleetResult.success) setFleetLive(fleetResult.data);
      setHistory({
        waits: waits.success ? waits.data : [],
        orders: orders.success ? orders.data : [],
        charging: charging.success ? charging.data : [],
        nudges: nudges.success ? nudges.data : [],
      });
      if (!driversResult.success || !vehiclesResult.success) {
        setError(driversResult.error || vehiclesResult.error || "Unable to load decision context.");
      }
    }
    load();
  }, []);

  const selectedDriver = useMemo(() => drivers.find((driver) => driver.id === selectedDriverId), [drivers, selectedDriverId]);
  const selectedLiveDriver = useMemo(
    () => (fleetLive?.drivers || []).find((row: any) => row.driver_id === selectedDriverId),
    [fleetLive, selectedDriverId]
  );
  const selectedVehicle = useMemo(() => {
    return vehicles.find((vehicle) => (vehicle.latest_telemetry || vehicle.latest)?.driver_id === selectedDriverId) || vehicles[0];
  }, [selectedDriverId, vehicles]);
  const selectedPoint = useMemo(() => {
    return (liveMap?.vehicle_points || []).find((point: any) => point.driver_id === selectedDriverId) || liveMap?.vehicle_points?.[0];
  }, [liveMap, selectedDriverId]);

  const runDecisionStack = async () => {
    if (!selectedDriver) {
      setError("Select a driver before running the decision stack.");
      return;
    }
    setIsRunning(true);
    setError("");
    const point = selectedPoint || { lat: 21.1702, lng: 72.8311, soc: 45, speed: 12 };
    const driverPayload = {
      driver_id: selectedDriver.id,
      driver_code: selectedDriver.driver_code,
      vehicle_id: selectedVehicle?.id,
      soc: Number(point.soc || (selectedVehicle?.latest_telemetry || selectedVehicle?.latest)?.soc || 45),
      current_location: { lat: Number(point.lat || 21.1702), lng: Number(point.lng || 72.8311) },
      available_range_km: Number(selectedLiveDriver?.range?.estimated_range_km || selectedVehicle?.latest_dynamic_range_km || 38),
      archetype: selectedLiveDriver?.archetype,
    };
    const orderPayload = {
      order_id: `OPS-${Date.now().toString().slice(-6)}`,
      restaurant_wait_min: 14,
      delivery_distance_km: 7.8,
      required_range_km: 11.5,
      pickup_location: { lat: 21.1862, lng: 72.8316 },
      drop_location: { lat: 21.2131, lng: 72.8708 },
    };

    const [wait, order, charge] = await Promise.all([
      api.intelligence.waitTime({
        driver_location: driverPayload.current_location,
        restaurant_location: orderPayload.pickup_location,
        prep_min: orderPayload.restaurant_wait_min,
        current_speed_kmph: Number(point.speed || 0),
        ignition_on: true,
        charge_plug: false,
        current_stop_duration_min: selectedLiveDriver?.wait?.current_stop_duration_min || 0,
      }),
      api.intelligence.assignOrder({
        available_drivers: [
          driverPayload,
          ...drivers
            .filter((driver) => driver.id !== selectedDriver.id)
            .slice(0, 3)
            .map((driver, index) => ({
              driver_id: driver.id,
              driver_code: driver.driver_code,
              soc: 32 + index * 12,
              available_range_km: 26 + index * 10,
              current_location: { lat: 21.17 + index * 0.01, lng: 72.83 + index * 0.01 },
            })),
        ],
        order: orderPayload,
      }),
      api.intelligence.chargingDecision({ driver: driverPayload, order: orderPayload }),
    ]);

    if (wait.success) setWaitResult(wait.data);
    if (order.success) setOrderResult(order.data);
    if (charge.success) setChargingResult(charge.data);
    if (!wait.success || !order.success || !charge.success) {
      setError(wait.error || order.error || charge.error || "One decision API failed.");
    }
    setIsRunning(false);
  };

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">Wait, Order, Charging Decisions</h1>
            <p className="text-text-dim">Single operator console for dispatch timing, assignment, and opportunistic charging calls.</p>
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
            <Button onClick={runDecisionStack} isLoading={isRunning} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Run Decisions
            </Button>
          </div>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent-teal" />
                Wait Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="info">{waitResult?.wait_type || "ready"}</Badge>
              <p className="text-3xl font-bold text-text-primary">{fmt(waitResult?.estimated_wait_min || waitResult?.wait_min || 0)} min</p>
              <p className="text-sm text-text-dim">{waitResult?.message || "Run the stack to classify pickup wait and charging opportunity."}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-accent-teal" />
                Order Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="success">{orderResult?.strategy || "assignment"}</Badge>
              <p className="text-3xl font-bold text-text-primary">{orderResult?.assigned_driver_id || selectedDriver?.driver_code || "-"}</p>
              <p className="text-sm text-text-dim">Score {fmt(orderResult?.assignment_score || orderResult?.score || 0, 2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BatteryCharging className="w-4 h-4 text-accent-teal" />
                Charging Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant={chargingResult?.chosen_option === "charge_now" ? "warning" : "info"}>
                {chargingResult?.chosen_option || "pending"}
              </Badge>
              <p className="text-xl font-bold text-text-primary">{chargingResult?.selected_charger?.name || "No charger selected"}</p>
              <p className="text-sm text-text-dim">{chargingResult?.message || "Run the stack to choose wait-time charging vs continue."}</p>
            </CardContent>
          </Card>
        </div>

        <PitchTelemetryCharts compact />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-accent-teal" />
              Nudge and Outcome History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              {[
                ["Waits", history.waits, "wait_type"],
                ["Orders", history.orders, "assigned_driver_id"],
                ["Charging", history.charging, "chosen_option"],
                ["Nudges", history.nudges, "nudge_type"],
              ].map(([title, rows, key]) => (
                <div key={String(title)} className="rounded-lg border border-bg-border bg-bg-primary/40 p-4">
                  <p className="text-sm font-bold text-text-primary mb-3">{String(title)}</p>
                  <div className="space-y-3">
                    {(rows as any[]).slice(0, 5).map((row) => (
                      <div key={row.id} className="border-b border-bg-border/60 pb-2 last:border-b-0">
                        <p className="text-xs font-semibold text-text-primary capitalize">{String(row[String(key)] || row.outcome || "record").replaceAll("_", " ")}</p>
                        <p className="text-[11px] text-text-dim">{shortDate(row.created_at || row.started_at)}</p>
                      </div>
                    ))}
                    {!(rows as any[]).length && <p className="text-xs text-text-dim">No records yet.</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
