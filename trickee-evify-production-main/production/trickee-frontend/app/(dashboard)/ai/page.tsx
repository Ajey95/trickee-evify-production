"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Battery, Bell, Bot, Car, MessageSquare, Navigation, Send, Sparkles, Users, Zap } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { Driver, Vehicle } from "@/types";

type PanelKey = "assistant" | "notification" | "route" | "battery" | "charger" | "profile" | "fleet" | "coaching";

const panels: Array<{ key: PanelKey; label: string; icon: any }> = [
  { key: "assistant", label: "Assistant", icon: MessageSquare },
  { key: "notification", label: "Notifications", icon: Bell },
  { key: "route", label: "Route Reasoning", icon: Navigation },
  { key: "battery", label: "Battery Insight", icon: Battery },
  { key: "charger", label: "Charging", icon: Zap },
  { key: "profile", label: "Driver Profile", icon: Car },
  { key: "fleet", label: "Fleet Summary", icon: Users },
  { key: "coaching", label: "Coaching", icon: Sparkles },
];

function resultText(value: any) {
  if (!value) return "No result yet.";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default function AiFeaturesPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [active, setActive] = useState<PanelKey>("assistant");
  const [message, setMessage] = useState("Can I reach my next stop with current battery?");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [driverList, vehicleList] = await Promise.all([api.drivers.list(), api.vehicles.list()]);
      if (driverList.success) {
        setDrivers(driverList.data);
        setSelectedDriverId(driverList.data[0]?.id || "");
      }
      if (vehicleList.success) {
        setVehicles(vehicleList.data);
        setSelectedVehicleId(vehicleList.data[0]?.id || "");
      }
      if (!driverList.success || !vehicleList.success) setError(driverList.error || vehicleList.error || "Unable to load AI context.");
    }
    load();
  }, []);

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0], [vehicles, selectedVehicleId]);
  const latest: any = selectedVehicle?.latest || selectedVehicle?.latest_telemetry || {};
  const point = { lat: Number(latest.lat || 21.1702), lng: Number(latest.lng || 72.8311) };
  const soc = Number(latest.soc || 42);

  async function runPanel() {
    if (!selectedDriverId || !selectedVehicle?.id) {
      setError("Select a driver and vehicle first.");
      return;
    }
    setIsLoading(true);
    setError("");
    setResult(null);
    const common = { driver_id: selectedDriverId, vehicle_id: selectedVehicle.id };
    let response;
    if (active === "assistant") {
      response = await api.assistant.message({ ...common, channel: "app", message, location: point });
    } else if (active === "notification") {
      response = await api.notifications.personalize({
        ...common,
        alert_type: "charging_opportunity",
        severity: soc < 20 ? "high" : "medium",
        action: "Review the nearest charging option before accepting a longer route",
        raw_data: { soc, lat: point.lat, lng: point.lng },
      });
    } else if (active === "route") {
      response = await api.routes.explain({
        ...common,
        origin: point,
        destination: { lat: point.lat + 0.035, lng: point.lng + 0.032 },
        current_soc: soc,
        routes: ["A", "B", "C"],
      });
    } else if (active === "battery") {
      response = await api.battery.insight({ ...common, current_soc: soc, trip_context: {}, environment_context: {} });
    } else if (active === "charger") {
      response = await api.chargers.recommend({ ...common, ...point, soc, destination_km: 18, available_time_min: 15 });
    } else if (active === "profile") {
      response = await api.drivers.profile(selectedDriverId);
    } else if (active === "fleet") {
      response = await api.fleet.summary({ summary_type: "realtime" });
    } else {
      response = await api.drivers.coaching(selectedDriverId, { ...common, mode: "shift" });
    }
    if (response.success) setResult(response.data);
    else setError(response.error || "Request failed.");
    setIsLoading(false);
  }

  return (
    <RoleGuard allowedRoles={["driver", "trickee_admin", "fleet_operator"]}>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="page-title mb-1">Assistant Workspace</h1>
            <p className="text-text-dim">Grounded fleet answers, route reasoning, charging guidance, and driver coaching.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="h-10 min-w-[220px] rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal">
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.driver_code} - {driver.full_name}</option>)}
            </select>
            <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} className="h-10 min-w-[180px] rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal">
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_code}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {panels.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`min-h-24 rounded-lg border p-3 text-left transition-colors ${active === key ? "border-accent-teal bg-accent-teal/10" : "border-bg-border bg-bg-card hover:border-accent-teal/40"}`}
            >
              <Icon className="mb-3 h-4 w-4 text-accent-teal" />
              <span className="text-xs font-semibold text-text-primary">{label}</span>
            </button>
          ))}
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-accent-teal" />
                {panels.find((panel) => panel.key === active)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {active === "assistant" && (
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-32 w-full resize-none rounded-lg border border-bg-border bg-bg-primary/50 p-3 text-sm text-text-primary outline-none focus:border-accent-teal"
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">SOC</p>
                  <p className="text-lg font-bold text-text-primary">{soc.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Location</p>
                  <p className="text-xs font-mono text-text-primary">{point.lat.toFixed(3)}, {point.lng.toFixed(3)}</p>
                </div>
              </div>
              <Button onClick={runPanel} isLoading={isLoading} className="w-full gap-2">
                <Send className="h-4 w-4" />
                Run Check
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Result
                {result?.fallback_used && <Badge variant="warning">Fallback</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg border border-bg-border bg-bg-primary/50 p-4 text-sm leading-6 text-text-primary">
                  {resultText(result)}
                </pre>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-bg-border text-sm text-text-dim">
                  Run a check to see grounded output.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
