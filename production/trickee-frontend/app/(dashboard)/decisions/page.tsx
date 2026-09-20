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
import { buildDriverContext, parseOrderInput } from "@/lib/operational-inputs.mjs";
import { createDecisionRunCache, runCachedDecisionSteps } from "@/lib/decision-run-cache.mjs";

const orderFields = [
  ["orderId", "Order ID", "text", undefined, undefined],
  ["waitMinutes", "Preparation time (minutes)", "number", 0, 180],
  ["distanceKm", "Delivery distance (km)", "number", 0.01, 200],
  ["requiredRangeKm", "Required range (km)", "number", 0.01, 500],
  ["pickupLat", "Pickup latitude", "number", -90, 90],
  ["pickupLng", "Pickup longitude", "number", -180, 180],
  ["dropLat", "Drop-off latitude", "number", -90, 90],
  ["dropLng", "Drop-off longitude", "number", -180, 180],
] as const;

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
  const [runSummary, setRunSummary] = useState("");
  const [failedStepIds, setFailedStepIds] = useState<string[]>([]);
  const runningRef = React.useRef(false);
  const decisionCacheRef = React.useRef(createDecisionRunCache());
  const [orderInput, setOrderInput] = useState({ orderId: "", waitMinutes: "", distanceKm: "", requiredRangeKm: "", pickupLat: "", pickupLng: "", dropLat: "", dropLng: "" });

  useEffect(() => {
    setWaitResult(null); setOrderResult(null); setChargingResult(null);
    setRunSummary("");
    setFailedStepIds([]);
  }, [selectedDriverId, orderInput]);

  const loadHistory = React.useCallback(async () => {
    const [waits, orders, charging, nudges] = await Promise.all([
      api.intelligence.waits(20),
      api.intelligence.orderAssignments(20),
      api.intelligence.chargingDecisions(20),
      api.intelligence.nudges(20),
    ]);
    setHistory({
      waits: waits.success ? waits.data : [],
      orders: orders.success ? orders.data : [],
      charging: charging.success ? charging.data : [],
      nudges: nudges.success ? nudges.data : [],
    });
    return waits.success && orders.success && charging.success && nudges.success;
  }, []);

  useEffect(() => {
    async function load() {
      const [driversResult, vehiclesResult, mapResult, fleetResult] = await Promise.all([
        api.drivers.list(),
        api.vehicles.list(),
        api.intelligence.liveMap(),
        api.intelligence.fleetLive(),
        loadHistory(),
      ]);
      if (driversResult.success) {
        setDrivers(driversResult.data);
        setSelectedDriverId(driversResult.data[0]?.id || "");
      }
      if (vehiclesResult.success) setVehicles(vehiclesResult.data);
      if (mapResult.success) setLiveMap(mapResult.data);
      if (fleetResult.success) setFleetLive(fleetResult.data);
      if (!driversResult.success || !vehiclesResult.success) {
        setError(driversResult.error || vehiclesResult.error || "Unable to load decision context.");
      }
    }
    load();
  }, [loadHistory]);

  const selectedDriver = useMemo(() => drivers.find((driver) => driver.id === selectedDriverId), [drivers, selectedDriverId]);
  const selectedLiveDriver = useMemo(
    () => (fleetLive?.drivers || []).find((row: any) => row.driver_id === selectedDriverId),
    [fleetLive, selectedDriverId]
  );
  const selectedVehicle = useMemo(() => {
    return vehicles.find((vehicle) => ((vehicle.latest_telemetry || vehicle.latest)?.driver_id ?? vehicle.latest_driver?.id) === selectedDriverId);
  }, [selectedDriverId, vehicles]);
  const selectedPoint = useMemo(() => {
    return (liveMap?.vehicle_points || []).find((point: any) => point.driver_id === selectedDriverId);
  }, [liveMap, selectedDriverId]);

  const runDecisionStack = async () => {
    if (runningRef.current) return;
    setError("");
    setRunSummary("");
    if (!selectedDriver) {
      setError("Select a driver before running the decision stack.");
      return;
    }
    const driverPayload = buildDriverContext(selectedDriver, selectedVehicle, selectedLiveDriver, selectedPoint);
    const latest = selectedVehicle?.latest_telemetry ?? selectedVehicle?.latest;
    if (!driverPayload || !latest || !Number.isFinite(latest.speed)) {
      setError("The selected driver needs an assigned vehicle with battery, GPS, speed, and range telemetry. Restore telemetry or select another driver.");
      return;
    }
    let orderPayload;
    try { orderPayload = parseOrderInput(orderInput); }
    catch (error) { setError(error instanceof Error ? error.message : "Enter valid order details."); return; }
    const availableDrivers = drivers.map((driver) => {
      const vehicle = vehicles.find((row) => ((row.latest_telemetry ?? row.latest)?.driver_id ?? row.latest_driver?.id) === driver.id);
      const liveDriver = fleetLive?.drivers?.find((row: any) => row.driver_id === driver.id);
      const point = liveMap?.vehicle_points?.find((row: any) => row.driver_id === driver.id);
      return buildDriverContext(driver, vehicle, liveDriver, point);
    }).filter(Boolean);
    runningRef.current = true;
    setIsRunning(true);

    try {
    const waitPayload = {
        driver_location: driverPayload.current_location,
        restaurant_location: orderPayload.pickup_location,
        prep_min: orderPayload.restaurant_wait_min,
        current_speed_kmph: latest.speed,
        ignition_on: latest.ignition_on,
        charge_plug: latest.charge_plug,
        current_stop_duration_min: selectedLiveDriver?.wait?.current_stop_duration_min,
      };
    const assignmentPayload = {
        available_drivers: availableDrivers,
        order: orderPayload,
      };
    const chargingPayload = { driver: driverPayload, order: orderPayload };
    const steps = [
      { id: "wait", label: "Wait Decision", payload: waitPayload, run: () => api.intelligence.waitTime(waitPayload) },
      { id: "order", label: "Order Assignment", payload: assignmentPayload, run: () => api.intelligence.assignOrder(assignmentPayload) },
      { id: "charging", label: "Charging Decision", payload: chargingPayload, run: () => api.intelligence.chargingDecision(chargingPayload) },
    ];
    const outcomes = await runCachedDecisionSteps(decisionCacheRef.current, steps);
    if (outcomes.wait.result?.success) setWaitResult(outcomes.wait.result.data);
    if (outcomes.order.result?.success) setOrderResult(outcomes.order.result.data);
    if (outcomes.charging.result?.success) setChargingResult(outcomes.charging.result.data);

    const failedSteps = steps.filter((step) => !outcomes[step.id].result?.success);
    const newSuccesses = steps.filter((step) => outcomes[step.id].result?.success && !outcomes[step.id].cached);
    const historyRefreshed = newSuccesses.length ? await loadHistory() : true;
    const successfulCount = steps.length - failedSteps.length;
    setFailedStepIds(failedSteps.map((step) => step.id));

    if (failedSteps.length) {
      const names = failedSteps.map((step) => step.label).join(", ");
      setRunSummary(`Partial result: ${successfulCount} of ${steps.length} decisions completed. Retry will run only ${names}.`);
      setError(failedSteps.map((step) => `${step.label}: ${outcomes[step.id].result?.error || "request failed"}`).join(" "));
    } else {
      const cachedCount = steps.filter((step) => outcomes[step.id].cached).length;
      setRunSummary(cachedCount
        ? `All ${steps.length} decisions are available. ${cachedCount} previously successful ${cachedCount === 1 ? "result was" : "results were"} reused.`
        : `All ${steps.length} decisions completed successfully.`);
    }
    if (!historyRefreshed) {
      setError((current) => `${current ? `${current} ` : ""}Decision history could not be refreshed.`);
    }
    } catch {
      setError("Unable to complete the decision requests. Please try again.");
      setRunSummary("No new decisions completed. Retry the decision requests.");
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
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
              aria-label="Decision driver"
              disabled={isRunning}
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              className="h-10 min-w-[240px] rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal"
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.driver_code} - {driver.full_name}</option>
              ))}
            </select>
            <Button type="submit" form="decision-order" isLoading={isRunning} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {failedStepIds.length ? "Retry failed decisions" : "Run Decisions"}
            </Button>
          </div>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}
        {runSummary && <Card className="border-accent-teal/30 bg-accent-teal/5"><p className="text-sm text-text-primary">{runSummary}</p></Card>}

        <Card>
          <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-text-dim">Enter the order to evaluate. Assignment candidates use only their own available vehicle telemetry. Drivers with missing telemetry are excluded.</p>
            <form id="decision-order" onSubmit={(event) => { event.preventDefault(); void runDecisionStack(); }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {orderFields.map(([key, label, type, min, max]) => <label key={key} className="space-y-2 text-xs text-text-dim">
                <span>{label}</span>
                <input type={type} min={min} max={max} step={type === "number" ? "any" : undefined} maxLength={key === "orderId" ? 100 : undefined} required value={orderInput[key]} disabled={isRunning} onChange={(event) => setOrderInput((current) => ({...current, [key]: event.target.value}))} className="h-10 w-full rounded-lg border border-bg-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-accent-teal" />
              </label>)}
            </form>
          </CardContent>
        </Card>

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
              <p className="text-sm text-text-dim">{waitResult?.message || "Run decisions to review pickup wait and charging opportunity."}</p>
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
              <p className="text-sm text-text-dim">{chargingResult?.message || "Run decisions to compare charging now vs continuing."}</p>
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
