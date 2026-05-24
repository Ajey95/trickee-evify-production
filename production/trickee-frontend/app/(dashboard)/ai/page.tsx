"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Battery, Bell, Bot, Car, MessageSquare, Navigation, Send, Sparkles, Users, Zap } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { Driver, Vehicle } from "@/types";
import { useAuth } from "@/components/AuthProvider";

type PanelKey = "assistant" | "notification" | "route" | "battery" | "charger" | "profile" | "fleet" | "coaching";
type ContextItem = { label: string; value: string; hint?: string };

const panels: Array<{ key: PanelKey; label: string; icon: any; description: string; cta: string }> = [
  { key: "assistant", label: "Ask Assistant", icon: MessageSquare, description: "Ask a driver-facing EV question using live vehicle context.", cta: "Ask assistant" },
  { key: "notification", label: "Send Nudge", icon: Bell, description: "Preview a grounded charging notification before sending.", cta: "Generate nudge" },
  { key: "route", label: "Explain Route", icon: Navigation, description: "Explain route choice from SOC, traffic, and charger context.", cta: "Explain route" },
  { key: "battery", label: "Battery Insight", icon: Battery, description: "Translate SOC into useful range and risk language.", cta: "Create insight" },
  { key: "charger", label: "Find Charger", icon: Zap, description: "Rank nearby charging options for this driver and stop window.", cta: "Recommend charger" },
  { key: "profile", label: "Driver Profile", icon: Car, description: "Review the deterministic driver memory profile.", cta: "Load profile" },
  { key: "fleet", label: "Fleet Summary", icon: Users, description: "Generate an operator summary from current fleet facts.", cta: "Summarize fleet" },
  { key: "coaching", label: "Coaching", icon: Sparkles, description: "Create end-of-shift coaching based on observed metrics.", cta: "Create coaching" },
];

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPoint(point: { lat: number; lng: number }) {
  return `${point.lat.toFixed(3)}, ${point.lng.toFixed(3)}`;
}

function renderValue(value: any): React.ReactNode {
  if (value == null) return <span className="text-text-dim">Not available</span>;
  if (typeof value === "boolean") return <Badge variant={value ? "success" : "outline"}>{value ? "Yes" : "No"}</Badge>;
  if (typeof value === "number" || typeof value === "string") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-text-dim">None</span>;
    return (
      <div className="space-y-2">
        {value.slice(0, 5).map((item, index) => (
          <div key={index} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
            {renderValue(item)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {Object.entries(value).slice(0, 8).map(([key, item]) => (
        <div key={key} className="flex items-start justify-between gap-4 border-b border-bg-border/60 pb-2 last:border-0 last:pb-0">
          <span className="text-xs uppercase tracking-wider text-text-dim">{formatLabel(key)}</span>
          <div className="max-w-[70%] text-right text-sm text-text-primary">{renderValue(item)}</div>
        </div>
      ))}
    </div>
  );
}

function ResultView({ result }: { result: any }) {
  if (!result) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-bg-border text-sm text-text-dim">
        Run an action to see grounded output.
      </div>
    );
  }
  const primary =
    result.answer ||
    result.message ||
    result.explanation ||
    result.reason ||
    result.summary ||
    result.range_translation ||
    result.risk_flag;
  const secondary = { ...result };
  ["answer", "message", "explanation", "reason", "summary", "range_translation", "risk_flag"].forEach((key) => delete secondary[key]);
  return (
    <div className="space-y-4">
      {primary && (
        <div className="rounded-xl border border-accent-teal/30 bg-accent-teal/10 p-4">
          <p className="text-sm leading-6 text-text-primary">{String(primary)}</p>
        </div>
      )}
      <div className="rounded-xl border border-bg-border bg-bg-primary/40 p-4">
        {renderValue(secondary)}
      </div>
    </div>
  );
}

export default function AiFeaturesPage() {
  const { user } = useAuth();
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
      const [driverList, vehicleList] =
        user?.role === "driver"
          ? await Promise.all([
              api.drivers.me().then((result) => ({ ...result, data: result.success ? [result.data] : [] })),
              api.vehicles.mine(),
            ])
          : await Promise.all([api.drivers.list(), api.vehicles.list()]);
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
    if (user) load();
  }, [user]);

  const visiblePanels = useMemo(
    () => panels.filter((panel) => user?.role !== "driver" || panel.key !== "fleet"),
    [user?.role]
  );

  useEffect(() => {
    if (user?.role === "driver" && active === "fleet") setActive("assistant");
  }, [active, user?.role]);

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0], [vehicles, selectedVehicleId]);
  const selectedDriver = useMemo(() => drivers.find((driver) => driver.id === selectedDriverId) || drivers[0], [drivers, selectedDriverId]);
  const latest: any = selectedVehicle?.latest || selectedVehicle?.latest_telemetry || {};
  const point = useMemo(
    () => ({ lat: Number(latest.lat || 21.1702), lng: Number(latest.lng || 72.8311) }),
    [latest.lat, latest.lng]
  );
  const soc = Number(latest.soc || 42);
  const routeDestination = useMemo(() => ({ lat: point.lat + 0.035, lng: point.lng + 0.032 }), [point.lat, point.lng]);
  const activePanel = visiblePanels.find((panel) => panel.key === active) || visiblePanels[0] || panels[0];
  const contextItems: ContextItem[] = (() => {
    const driverLabel = selectedDriver ? `${selectedDriver.driver_code} - ${selectedDriver.full_name}` : "No driver selected";
    const vehicleLabel = selectedVehicle?.vehicle_code || "No vehicle selected";
    const speed = latest.speed != null ? `${Number(latest.speed).toFixed(1)} km/h` : "Not available";
    const temp = latest.temp_max != null ? `${Number(latest.temp_max).toFixed(1)}C` : "Not available";
    const current = latest.current != null ? `${Number(latest.current).toFixed(1)} A` : "Not available";
    const recordedAt = latest.recorded_at ? new Date(latest.recorded_at).toLocaleString() : "Not available";
    const base: ContextItem[] = [
      { label: "Driver", value: driverLabel, hint: "Permission and profile scope" },
      { label: "Vehicle", value: vehicleLabel, hint: "Telemetry source" },
    ];

    if (active === "assistant") {
      return [
        ...base,
        { label: "Question", value: message.slice(0, 80) || "No message", hint: "Driver-facing prompt" },
        { label: "Location", value: formatPoint(point), hint: "Used only if charger/location tools are needed" },
      ];
    }
    if (active === "notification") {
      return [
        ...base,
        { label: "Alert type", value: "Charging opportunity", hint: "Backend decides alert category" },
        { label: "Severity", value: soc < 20 ? "High" : "Medium", hint: "LLM cannot change severity" },
        { label: "SOC", value: `${soc.toFixed(1)}%`, hint: "From latest vehicle telemetry" },
        { label: "Tools", value: "Profile, battery, vehicle, charger", hint: "Allowed backend facts only" },
      ];
    }
    if (active === "route") {
      return [
        ...base,
        { label: "Origin", value: formatPoint(point), hint: "Latest GPS point" },
        { label: "Destination", value: formatPoint(routeDestination), hint: "Demo route target" },
        { label: "SOC", value: `${soc.toFixed(1)}%`, hint: "Battery margin input" },
        { label: "Tools", value: "Route score, traffic/weather, battery, chargers", hint: "Explanation cannot change route rank" },
      ];
    }
    if (active === "battery") {
      return [
        ...base,
        { label: "SOC", value: `${soc.toFixed(1)}%`, hint: "Range translation input" },
        { label: "Speed", value: speed, hint: "Latest telemetry" },
        { label: "Temperature", value: temp, hint: "Thermal context" },
        { label: "Current draw", value: current, hint: "Drain-vs-baseline signal" },
      ];
    }
    if (active === "charger") {
      return [
        ...base,
        { label: "Location", value: formatPoint(point), hint: "Nearest charger search center" },
        { label: "SOC", value: `${soc.toFixed(1)}%`, hint: "Urgency and gain estimate" },
        { label: "Destination", value: "18 km", hint: "Demo trip distance" },
        { label: "Wait window", value: "15 min", hint: "Charge opportunity window" },
      ];
    }
    if (active === "profile") {
      return [
        ...base,
        { label: "Telemetry age", value: recordedAt, hint: "Latest profile signal freshness" },
        { label: "SOC", value: `${soc.toFixed(1)}%`, hint: "Recent behavior context" },
      ];
    }
    if (active === "fleet") {
      return [
        { label: "Summary type", value: "Realtime", hint: "Operator-facing snapshot" },
        { label: "Vehicles loaded", value: String(vehicles.length), hint: "Current UI scope" },
        { label: "Drivers loaded", value: String(drivers.length), hint: "Current UI scope" },
        { label: "Tools", value: "Fleet status only", hint: "No invented vehicles or risks" },
      ];
    }
    return [
      ...base,
      { label: "Mode", value: "Shift", hint: "Coaching window" },
      { label: "Baseline", value: "Driver first, fleet fallback", hint: "Comparison rule" },
      { label: "Telemetry age", value: recordedAt, hint: "Latest observed data" },
    ];
  })();

  async function runPanel() {
    if (!selectedDriverId || !selectedVehicle?.id) {
      setError(
        user?.role === "driver"
          ? "Your driver account has no mapped vehicle telemetry yet. Ask an admin to map this account to the right driver/vehicle before using AI checks."
          : "Select a driver and vehicle first."
      );
      return;
    }
    if (active === "fleet" && user?.role === "driver") {
      setError("Fleet summary is available only to fleet managers and admins.");
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
        destination: routeDestination,
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
            <h1 className="page-title mb-1">EV Intelligence Workspace</h1>
            <p className="text-text-dim">Driver assistant, notification previews, route reasoning, charging guidance, and coaching.</p>
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
          {visiblePanels.map(({ key, label, icon: Icon }) => (
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
                {activePanel.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-text-dim">{activePanel.description}</p>
              {active === "assistant" && (
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-32 w-full resize-none rounded-lg border border-bg-border bg-bg-primary/50 p-3 text-sm text-text-primary outline-none focus:border-accent-teal"
                />
              )}
              {active !== "assistant" && (
                <div className="rounded-xl border border-bg-border bg-bg-primary/40 p-4">
                  <p className="text-xs uppercase tracking-wider text-text-dim">Backend Context</p>
                  <p className="mt-2 text-sm leading-6 text-text-primary">
                    The backend resolves additional facts through allowed tools before generating language. These cards show the visible scenario inputs for this feature.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {contextItems.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-text-primary">{item.value}</p>
                    {item.hint && <p className="mt-2 text-[11px] leading-4 text-text-dim">{item.hint}</p>}
                  </div>
                ))}
              </div>
              <Button onClick={runPanel} isLoading={isLoading} className="w-full gap-2">
                <Send className="h-4 w-4" />
                {activePanel.cta}
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
              <ResultView result={result} />
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
