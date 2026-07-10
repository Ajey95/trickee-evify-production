"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity, Battery, Bell, Bot, Car, Headphones, MessageSquare, Mic, MicOff, Navigation, RadioTower, Send, Sparkles, Users, Waves, Zap } from "lucide-react";
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

const mockDrivers: Driver[] = [
  {
    id: "mock-driver-rohith",
    driver_code: "DRV-018",
    full_name: "Rohith Kumar",
    style_label: "Smooth",
    personal_factor: 0.94,
    avg_regen_ratio: 0.31,
    avg_throttle_variance: 0.18,
    avg_current_30m: 31.4,
    avg_speed_30m: 34.2,
    trips_this_week: 22,
    kwh_used_this_week: 47.6,
    efficiency_rank: 3,
    efficiency_vs_fleet_pct: 11,
    trickee_points: 1280,
  },
];

const mockVehicles: Vehicle[] = [
  {
    id: "mock-vehicle-trk-204",
    vehicle_code: "TRK-204",
    make: "Euler",
    model: "HiLoad EV",
    max_range_km: 140,
    latest_dynamic_range_km: 37,
    latest: {
      id: "mock-tel-1",
      vehicle_id: "mock-vehicle-trk-204",
      driver_id: "mock-driver-rohith",
      recorded_at: new Date().toISOString(),
      soc: 22,
      current: 38.8,
      battery_voltage: 51.6,
      speed: 32.4,
      temp_max: 36.8,
      soh: 94,
      charge_plug: false,
      ignition_on: true,
      regen_status: true,
      throttle_status: true,
      status_tag: "route_risk_watch",
      lat: 21.1702,
      lng: 72.8311,
    },
  },
];

function mockResultFor(active: PanelKey, message: string, soc: number, vehicleCode?: string) {
  const vehicle = vehicleCode || "TRK-204";
  if (active === "assistant") {
    return {
      answer: `${vehicle} can finish the next 18 km stop, but the reserve will be tight. Keep speed below 38 km/h and take the Adajan top-up if a second delivery is added.`,
      confidence: "mock-high",
      transcript: message,
      next_best_action: "Offer a 14 minute charge window before accepting a longer route.",
      fallback_used: true,
    };
  }
  if (active === "notification") {
    return {
      message: `Heads up: ${vehicle} is at ${soc.toFixed(0)}% SOC. Take the Adajan charger window now to avoid a late-route low battery alert.`,
      severity: soc < 20 ? "high" : "medium",
      channel: "driver_app_preview",
      fallback_used: true,
    };
  }
  if (active === "route") {
    return {
      explanation: "Route B is recommended because it avoids the high stop-and-go section and preserves roughly 8% more SOC, even though it adds 6 minutes.",
      selected_route: "B",
      soc_end_pct: Math.max(9, soc - 12),
      fallback_used: true,
    };
  }
  if (active === "battery") {
    return {
      range_translation: `${soc.toFixed(0)}% SOC maps to about 37 km practical range under the current speed, heat, and current-draw pattern.`,
      risk_flag: soc < 25 ? "Watch reserve closely" : "Stable",
      fallback_used: true,
    };
  }
  if (active === "charger") {
    return {
      recommendation: "Adajan Fast Charge",
      reason: "Closest reliable top-up with a short queue and enough gain for the next route block.",
      distance_km: 2.7,
      charge_minutes: 14,
      fallback_used: true,
    };
  }
  if (active === "profile") {
    return {
      summary: "Rohith is smoother than fleet baseline today with lower throttle variance and good regen recovery.",
      driver_style: "Smooth",
      coaching_tone: "Positive reinforcement",
      fallback_used: true,
    };
  }
  if (active === "fleet") {
    return {
      summary: "Fleet is healthy overall. One vehicle needs charging attention, two routes have avoidable energy penalties, and no severe driver risk is active.",
      vehicles_at_risk: 1,
      charging_windows: 3,
      fallback_used: true,
    };
  }
  return {
    summary: "End-of-shift coaching should praise smooth acceleration, then remind the driver to accept charger windows before SOC drops below 20%.",
    coaching_points: ["Strong regen use", "Avoid late charging", "Keep route speed below 38 km/h in heat"],
    fallback_used: true,
  };
}

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
  const [notice, setNotice] = useState("Mock Coice/voice mode is ready if live backend data is unavailable.");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  useEffect(() => {
    async function load() {
      let driverList: { success: boolean; data: Driver[]; error?: string };
      let vehicleList: { success: boolean; data: Vehicle[]; error?: string };

      try {
        if (user?.role === "driver") {
          const [driverResponse, vehicleResponse] = await Promise.all([
            api.drivers.me().then((result) => ({ ...result, data: result.success ? [result.data] : [] })),
            api.vehicles.mine(),
          ]);
          driverList = driverResponse;
          vehicleList = vehicleResponse;
        } else {
          const [driverResponse, vehicleResponse] = await Promise.all([api.drivers.list(), api.vehicles.list()]);
          driverList = driverResponse;
          vehicleList = vehicleResponse;
        }
      } catch {
        driverList = { success: false, data: [], error: "Unable to reach backend." };
        vehicleList = { success: false, data: [], error: "Unable to reach backend." };
      }

      if (driverList.success) {
        const nextDrivers = driverList.data.length ? driverList.data : mockDrivers;
        setDrivers(nextDrivers);
        setSelectedDriverId(nextDrivers[0]?.id || "");
      }
      if (vehicleList.success) {
        const nextVehicles = vehicleList.data.length ? vehicleList.data : mockVehicles;
        setVehicles(nextVehicles);
        setSelectedVehicleId(nextVehicles[0]?.id || "");
      }
      if (!driverList.success || !vehicleList.success) {
        setDrivers(mockDrivers);
        setVehicles(mockVehicles);
        setSelectedDriverId(mockDrivers[0].id);
        setSelectedVehicleId(mockVehicles[0].id);
        setNotice("Live backend context was not available, so the AI workspace is showing polished mock fleet data.");
      }
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

  function startVoiceInput() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setNotice("This browser does not expose speech recognition, but the chat and mock intelligence flow still work.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setNotice("Listening for your Coice/voice command...");
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setNotice("Voice capture stopped. You can type the same command in the assistant box.");
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setMessage(transcript);
      setActive("assistant");
      setNotice("Voice command captured and moved into the assistant prompt.");
    };
    recognition.start();
  }

  async function runPanel() {
    if (!selectedDriverId || !selectedVehicle?.id) {
      setDrivers(mockDrivers);
      setVehicles(mockVehicles);
      setSelectedDriverId(mockDrivers[0].id);
      setSelectedVehicleId(mockVehicles[0].id);
      setResult(mockResultFor(active, message, soc, mockVehicles[0].vehicle_code));
      setNotice("No live driver or vehicle was selected, so Trickee is showing the mock Coice intelligence result.");
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
    if (response.success) {
      setResult(response.data);
      setNotice("Live backend response received.");
    } else {
      setResult(mockResultFor(active, message, soc, selectedVehicle?.vehicle_code));
      setNotice(response.error ? `Live request failed (${response.error}). Showing mock Coice intelligence output.` : "Showing mock Coice intelligence output.");
    }
    setIsLoading(false);
  }

  return (
    <RoleGuard allowedRoles={["driver", "trickee_admin", "fleet_operator"]}>
      <div className="space-y-6 pb-12">
        <div className="overflow-hidden rounded-xl border border-accent-teal/20 bg-[linear-gradient(135deg,rgba(0,180,216,0.16),rgba(15,19,26,0.94)_42%,rgba(63,185,80,0.10))] p-5 shadow-2xl shadow-black/20 md:p-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr] xl:items-end">
            <div className="space-y-5">
              <div>
                <h1 className="page-title mb-2">Coice Voice Intelligence</h1>
                <p className="max-w-3xl text-sm leading-6 text-text-dim md:text-base">
                  A voice-ready EV command center for driver questions, route reasoning, charger decisions, and operator summaries. Mock data is active so the UI can be shown immediately.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-accent-teal">
                    <RadioTower className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Signal</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-text-primary">Live + Mock</p>
                  <p className="mt-1 text-xs text-text-dim">Backend safe fallback</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-accent-green">
                    <Activity className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Fleet Pulse</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-text-primary">{soc.toFixed(0)}% SOC</p>
                  <p className="mt-1 text-xs text-text-dim">{selectedVehicle?.vehicle_code || "Mock vehicle"} under watch</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-accent-amber">
                    <Headphones className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Voice Layer</span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-text-primary">{isListening ? "Listening" : "Ready"}</p>
                  <p className="mt-1 text-xs text-text-dim">{voiceSupported ? "Browser speech input" : "Typed fallback"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#07090d]/72 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-teal">Voice command</p>
                  <p className="mt-1 text-sm text-text-dim">Tap the mic and ask about battery, routes, drivers, or chargers.</p>
                </div>
                <button
                  type="button"
                  onClick={startVoiceInput}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition ${
                    isListening
                      ? "border-accent-red bg-accent-red text-white"
                      : "border-accent-teal/35 bg-accent-teal/10 text-accent-teal hover:border-accent-teal"
                  }`}
                  aria-label="Start Coice voice input"
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              </div>
              <div className="rounded-lg border border-bg-border bg-bg-primary/60 p-3">
                <div className="flex items-center gap-2 text-xs text-text-dim">
                  <Waves className="h-4 w-4 text-accent-teal" />
                  Current prompt
                </div>
                <p className="mt-2 text-sm leading-6 text-text-primary">{message}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="section-title mb-1">AI Workspace</h2>
            <p className="text-text-dim">Driver assistant, notification previews, route reasoning, charging guidance, and coaching.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:w-auto">
            <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)} className="h-10 w-full rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal sm:min-w-[220px] sm:w-auto">
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.driver_code} - {driver.full_name}</option>)}
            </select>
            <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} className="h-10 w-full rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal sm:min-w-[180px] sm:w-auto">
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_code}</option>)}
            </select>
          </div>
        </div>

        {notice && <Card className="border-accent-teal/20 bg-accent-teal/5"><p className="text-sm text-accent-teal">{notice}</p></Card>}

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 xl:grid-cols-8">
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
                <div className="space-y-3">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-32 w-full resize-none rounded-lg border border-bg-border bg-bg-primary/50 p-3 text-sm text-text-primary outline-none focus:border-accent-teal"
                  />
                  <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 px-3 py-2 text-xs leading-5 text-text-dim">
                      Try: Which vehicle needs charging before the next route?
                    </div>
                    <Button type="button" variant={isListening ? "danger" : "secondary"} onClick={startVoiceInput} disabled={isListening} className="gap-2">
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isListening ? "Listening" : "Voice"}
                    </Button>
                  </div>
                </div>
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
