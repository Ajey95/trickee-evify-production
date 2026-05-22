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

const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "Accepted";

const mapWaitEventToResult = (wait: any) => ({
  decision_record_id: wait.id,
  wait_type: wait.wait_type,
  wait_min: wait.duration_min || (wait.duration_seconds ? Math.round(wait.duration_seconds / 60) : 0),
  message: wait.context?.result?.message || `Wait classified as ${wait.wait_type}`,
});

const mapOrderEventToResult = (order: any) => ({
  decision_record_id: order.id,
  assigned_driver_id: order.assigned_driver_id,
  strategy: order.strategy,
  score: order.assignment_score,
});

const mapChargingEventToResult = (charging: any) => ({
  decision_record_id: charging.id,
  chosen_option: charging.chosen_option,
  selected_charger: charging.selected_charger,
  message: charging.message,
});

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

  const [waitOutcome, setWaitOutcome] = useState("Accepted");
  const [waitFeedback, setWaitFeedback] = useState("");
  const [waitLogged, setWaitLogged] = useState(false);
  const [isSavingWait, setIsSavingWait] = useState(false);

  const [orderOutcome, setOrderOutcome] = useState("Accepted");
  const [orderFeedback, setOrderFeedback] = useState("");
  const [orderLogged, setOrderLogged] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const [chargingOutcome, setChargingOutcome] = useState("Accepted");
  const [chargingFeedback, setChargingFeedback] = useState("");
  const [chargingLogged, setChargingLogged] = useState(false);
  const [isSavingCharging, setIsSavingCharging] = useState(false);

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
      
      const loadedHistory = {
        waits: waits.success ? waits.data : [],
        orders: orders.success ? orders.data : [],
        charging: charging.success ? charging.data : [],
        nudges: nudges.success ? nudges.data : [],
      };
      setHistory(loadedHistory);

      // Initialize results and outcome states with the latest from history on load
      if (loadedHistory.waits.length > 0) {
        const item = loadedHistory.waits[0];
        setWaitResult(mapWaitEventToResult(item));
        setWaitOutcome(capitalize(item.context?.outcome || "Accepted"));
        setWaitFeedback(item.context?.operator_feedback || "");
        setWaitLogged(!!item.context?.outcome);
      }
      if (loadedHistory.orders.length > 0) {
        const item = loadedHistory.orders[0];
        setOrderResult(mapOrderEventToResult(item));
        setOrderOutcome(capitalize(item.outcome || "Accepted"));
        setOrderFeedback(item.result_payload?.operator_feedback || "");
        setOrderLogged(!!item.outcome);
      }
      if (loadedHistory.charging.length > 0) {
        const item = loadedHistory.charging[0];
        setChargingResult(mapChargingEventToResult(item));
        setChargingOutcome(capitalize(item.outcome || "Accepted"));
        setChargingFeedback(item.result_payload?.operator_feedback || "");
        setChargingLogged(!!item.outcome);
      }

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
    setWaitLogged(false);
    setWaitOutcome("Accepted");
    setWaitFeedback("");
    setOrderLogged(false);
    setOrderOutcome("Accepted");
    setOrderFeedback("");
    setChargingLogged(false);
    setChargingOutcome("Accepted");
    setChargingFeedback("");

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
        driver_id: selectedDriver.id,
        vehicle_id: selectedVehicle?.id,
        persist: true,
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
      setError(wait.error || order.error || charge.error || "Decision run failed.");
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
              className="h-10 min-w-[240px] rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal font-mono"
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
              <p className="text-sm text-text-dim">{waitResult?.message || "No decision loaded yet."}</p>

              {waitResult?.decision_record_id && (
                <div className="pt-4 border-t border-bg-border/60 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-primary font-mono">Operator Outcome Control</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={waitOutcome}
                        onChange={(e) => setWaitOutcome(e.target.value)}
                        className="h-8 rounded bg-bg-primary border border-bg-border text-xs px-2 text-text-primary outline-none focus:border-accent-teal flex-1"
                      >
                        <option value="Accepted">Accepted</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Ignored">Ignored</option>
                      </select>
                      <Button
                        size="sm"
                        className="h-8 text-xs px-3"
                        isLoading={isSavingWait}
                        onClick={async () => {
                          setIsSavingWait(true);
                          const res = await api.intelligence.updateWaitOutcome(waitResult.decision_record_id, waitOutcome.toLowerCase(), waitFeedback);
                          setIsSavingWait(false);
                          if (res.success) {
                            setWaitLogged(true);
                            const waits = await api.intelligence.waits(20);
                            if (waits.success) setHistory(h => ({ ...h, waits: waits.data }));
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                    <input
                      type="text"
                      placeholder="Feedback / notes on this wait recommendation..."
                      value={waitFeedback}
                      onChange={(e) => setWaitFeedback(e.target.value)}
                      className="w-full h-8 rounded bg-bg-primary border border-bg-border text-xs px-2 text-text-primary outline-none focus:border-accent-teal font-mono"
                    />
                    {waitLogged && (
                      <p className="text-[10px] text-accent-teal font-semibold">✓ Logged: {waitOutcome}</p>
                    )}
                  </div>
                </div>
              )}
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

              {orderResult?.decision_record_id && (
                <div className="pt-4 border-t border-bg-border/60 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-primary font-mono">Operator Outcome Control</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={orderOutcome}
                        onChange={(e) => setOrderOutcome(e.target.value)}
                        className="h-8 rounded bg-bg-primary border border-bg-border text-xs px-2 text-text-primary outline-none focus:border-accent-teal flex-1"
                      >
                        <option value="Accepted">Accepted</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Ignored">Ignored</option>
                      </select>
                      <Button
                        size="sm"
                        className="h-8 text-xs px-3"
                        isLoading={isSavingOrder}
                        onClick={async () => {
                          setIsSavingOrder(true);
                          const res = await api.intelligence.updateOrderOutcome(orderResult.decision_record_id, orderOutcome.toLowerCase(), orderFeedback);
                          setIsSavingOrder(false);
                          if (res.success) {
                            setOrderLogged(true);
                            const orders = await api.intelligence.orderAssignments(20);
                            if (orders.success) setHistory(h => ({ ...h, orders: orders.data }));
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                    <input
                      type="text"
                      placeholder="Feedback / notes on this order recommendation..."
                      value={orderFeedback}
                      onChange={(e) => setOrderFeedback(e.target.value)}
                      className="w-full h-8 rounded bg-bg-primary border border-bg-border text-xs px-2 text-text-primary outline-none focus:border-accent-teal font-mono"
                    />
                    {orderLogged && (
                      <p className="text-[10px] text-accent-teal font-semibold">✓ Logged: {orderOutcome}</p>
                    )}
                  </div>
                </div>
              )}
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
              <p className="text-sm text-text-dim">{chargingResult?.message || "No charger decision loaded."}</p>

              {chargingResult?.decision_record_id && (
                <div className="pt-4 border-t border-bg-border/60 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-primary font-mono">Operator Outcome Control</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={chargingOutcome}
                        onChange={(e) => setChargingOutcome(e.target.value)}
                        className="h-8 rounded bg-bg-primary border border-bg-border text-xs px-2 text-text-primary outline-none focus:border-accent-teal flex-1"
                      >
                        <option value="Accepted">Accepted</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Ignored">Ignored</option>
                      </select>
                      <Button
                        size="sm"
                        className="h-8 text-xs px-3"
                        isLoading={isSavingCharging}
                        onClick={async () => {
                          setIsSavingCharging(true);
                          const res = await api.intelligence.updateChargingOutcome(chargingResult.decision_record_id, chargingOutcome.toLowerCase(), chargingFeedback);
                          setIsSavingCharging(false);
                          if (res.success) {
                            setChargingLogged(true);
                            const charging = await api.intelligence.chargingDecisions(20);
                            if (charging.success) setHistory(h => ({ ...h, charging: charging.data }));
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                    <input
                      type="text"
                      placeholder="Feedback / notes on this charging recommendation..."
                      value={chargingFeedback}
                      onChange={(e) => setChargingFeedback(e.target.value)}
                      className="w-full h-8 rounded bg-bg-primary border border-bg-border text-xs px-2 text-text-primary outline-none focus:border-accent-teal font-mono"
                    />
                    {chargingLogged && (
                      <p className="text-[10px] text-accent-teal font-semibold">✓ Logged: {chargingOutcome}</p>
                    )}
                  </div>
                </div>
              )}
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
                  <p className="text-sm font-bold text-text-primary mb-3 font-mono">{String(title)}</p>
                  <div className="space-y-3">
                    {(rows as any[]).slice(0, 5).map((row) => {
                      const loggedOutcome = title === "Waits" ? row.context?.outcome : row.outcome;
                      return (
                        <div 
                          key={row.id} 
                          onClick={() => {
                            if (title === "Waits") {
                              setWaitResult(mapWaitEventToResult(row));
                              setWaitOutcome(capitalize(row.context?.outcome || "Accepted"));
                              setWaitFeedback(row.context?.operator_feedback || "");
                              setWaitLogged(!!row.context?.outcome);
                            } else if (title === "Orders") {
                              setOrderResult(mapOrderEventToResult(row));
                              setOrderOutcome(capitalize(row.outcome || "Accepted"));
                              setOrderFeedback(row.result_payload?.operator_feedback || "");
                              setOrderLogged(!!row.outcome);
                            } else if (title === "Charging") {
                              setChargingResult(mapChargingEventToResult(row));
                              setChargingOutcome(capitalize(row.outcome || "Accepted"));
                              setChargingFeedback(row.result_payload?.operator_feedback || "");
                              setChargingLogged(!!row.outcome);
                            }
                          }}
                          className="border-b border-bg-border/60 pb-2 last:border-b-0 cursor-pointer hover:bg-bg-primary/80 p-1.5 rounded transition duration-150"
                        >
                          <div className="flex justify-between items-center">
                            <p className="text-xs font-semibold text-text-primary capitalize">{String(row[String(key)] || row.outcome || "record").replaceAll("_", " ")}</p>
                            {loggedOutcome ? (
                              <Badge variant="success" className="text-[9px] px-1 py-0 capitalize font-mono">{loggedOutcome}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono text-text-dim">Pending</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-text-dim mt-0.5 font-mono">{shortDate(row.created_at || row.started_at)}</p>
                        </div>
                      );
                    })}
                    {!(rows as any[]).length && <p className="text-xs text-text-dim font-mono">No records yet.</p>}
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
