"use client";

import React from "react";
import { BatteryCharging, Car, MapPin, Navigation, TriangleAlert, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type LatLng = { lat: number; lng: number };

type VehiclePoint = LatLng & {
  driver_id: string;
  driver_code: string;
  vehicle_id: string;
  soc: number;
  speed: number;
  risk_level?: string;
  recorded_at?: string;
};

type ZonePoint = {
  center: LatLng;
  sample_count: number;
  latest_seen_at?: string;
};

type ChargerPoint = LatLng & {
  name: string;
  distance_m?: number;
  source?: string;
};

type LiveMapData = {
  generated_at?: string;
  vehicle_points?: VehiclePoint[];
  low_soc_zones?: ZonePoint[];
  frequent_stop_zones?: ZonePoint[];
  charger_points?: ChargerPoint[];
};

type LiveMapPanelProps = {
  data: LiveMapData | null;
  selectedDriverId?: string;
  className?: string;
};

type LayerKey = "vehicles" | "chargers" | "lowSoc" | "stops";
const layerControls: { key: LayerKey; label: string; icon: LucideIcon }[] = [
  { key: "vehicles", label: "Vehicles", icon: Car },
  { key: "chargers", label: "Chargers", icon: BatteryCharging },
  { key: "lowSoc", label: "Low SOC", icon: TriangleAlert },
  { key: "stops", label: "Stops", icon: MapPin },
];

function allCoordinates(data: LiveMapData | null): LatLng[] {
  if (!data) return [];
  return [
    ...(data.vehicle_points || []),
    ...(data.charger_points || []),
    ...(data.low_soc_zones || []).map((zone) => zone.center),
    ...(data.frequent_stop_zones || []).map((zone) => zone.center),
  ].filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function boundsFor(points: LatLng[]) {
  if (!points.length) {
    return { minLat: 21.13, maxLat: 21.23, minLng: 72.78, maxLng: 72.9 };
  }
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const latPad = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.2, 0.01);
  const lngPad = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.2, 0.01);
  return {
    minLat: Math.min(...lats) - latPad,
    maxLat: Math.max(...lats) + latPad,
    minLng: Math.min(...lngs) - lngPad,
    maxLng: Math.max(...lngs) + lngPad,
  };
}

function project(point: LatLng, bounds: ReturnType<typeof boundsFor>) {
  const x = ((point.lng - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng, 0.000001)) * 100;
  const y = 100 - ((point.lat - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat, 0.000001)) * 100;
  return {
    left: `${Math.min(96, Math.max(4, x))}%`,
    top: `${Math.min(94, Math.max(6, y))}%`,
  };
}

function riskColor(risk?: string) {
  if (risk === "high") return "#f85149";
  if (risk === "medium") return "#d29922";
  return "#00b4d8";
}

export function LiveMapPanel({ data, selectedDriverId, className = "" }: LiveMapPanelProps) {
  const leafletRef = React.useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = React.useState<"leaflet" | "fallback">("fallback");
  const [visible, setVisible] = React.useState<Record<LayerKey, boolean>>({
    vehicles: true,
    chargers: true,
    lowSoc: true,
    stops: true,
  });

  const vehicles = React.useMemo(() => {
    const rows = data?.vehicle_points || [];
    return selectedDriverId ? rows.filter((row) => row.driver_id === selectedDriverId) : rows;
  }, [data, selectedDriverId]);

  const points = React.useMemo(() => allCoordinates({ ...data, vehicle_points: vehicles }), [data, vehicles]);
  const bounds = React.useMemo(() => boundsFor(points), [points]);

  React.useEffect(() => {
    if (!leafletRef.current || !data) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("leaflet")
      .then((leaflet) => {
        if (cancelled || !leafletRef.current) return;
        setMode("leaflet");
        const center = points[0] || { lat: 21.17, lng: 72.83 };
        const map = leaflet.map(leafletRef.current, {
          center: [center.lat, center.lng],
          zoom: points.length > 1 ? 12 : 13,
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
        });

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          })
          .addTo(map);

        if (points.length > 1) {
          map.fitBounds(
            leaflet.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])),
            { padding: [42, 42] }
          );
        }

        if (visible.vehicles) {
          vehicles.forEach((point) => {
            const color = riskColor(point.risk_level);
            leaflet
              .marker([point.lat, point.lng], {
                title: `${point.driver_code} - ${Number(point.soc).toFixed(1)}% SOC`,
                icon: leaflet.divIcon({
                  className: "trickee-map-label",
                  html: `<div style="display:flex;align-items:center;gap:6px;background:${color};color:#0d1117;border:2px solid #0d1117;border-radius:999px;padding:7px 9px;font-weight:800;font-size:11px;box-shadow:0 10px 26px rgba(0,0,0,.35);"><span>${point.driver_code}</span><span>${Number(point.soc).toFixed(0)}%</span></div>`,
                }),
              })
              .addTo(map);
          });
        }

        if (visible.chargers) {
          (data.charger_points || []).forEach((point) => {
            leaflet
              .circleMarker([point.lat, point.lng], {
                radius: 9,
                color: "#0d1117",
                weight: 2,
                fillColor: "#3fb950",
                fillOpacity: 0.95,
              })
              .bindTooltip(point.name)
              .addTo(map);
          });
        }

        if (visible.lowSoc) {
          (data.low_soc_zones || []).forEach((zone) => {
            leaflet
              .circle([zone.center.lat, zone.center.lng], {
                radius: Math.min(420, 90 + zone.sample_count * 8),
                color: "#f85149",
                fillColor: "#f85149",
                fillOpacity: 0.2,
                weight: 1,
              })
              .bindTooltip(`Low SOC zone - ${zone.sample_count} samples`)
              .addTo(map);
          });
        }

        if (visible.stops) {
          (data.frequent_stop_zones || []).forEach((zone) => {
            leaflet
              .circle([zone.center.lat, zone.center.lng], {
                radius: Math.min(360, 70 + zone.sample_count * 6),
                color: "#d29922",
                fillColor: "#d29922",
                fillOpacity: 0.16,
                weight: 1,
              })
              .bindTooltip(`Stop zone - ${zone.sample_count} samples`)
              .addTo(map);
          });
        }

        cleanup = () => map.remove();
      })
      .catch(() => setMode("fallback"));

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [data, points, vehicles, visible]);

  const toggle = (key: LayerKey) => {
    setVisible((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {layerControls.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`h-9 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                visible[key]
                  ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                  : "border-bg-border bg-bg-card text-text-dim"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <Badge variant={mode === "leaflet" ? "success" : "info"}>
          {mode === "leaflet" ? "OpenStreetMap" : "Projected live map"}
        </Badge>
      </div>

      <div className="relative min-h-[560px] overflow-hidden rounded-lg border border-bg-border bg-[#101722]">
        <div ref={leafletRef} className={`absolute inset-0 ${mode === "leaflet" ? "" : "opacity-0"}`} />
        {mode !== "leaflet" && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:64px_64px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,180,216,0.14),transparent_30%),radial-gradient(circle_at_70%_65%,rgba(63,185,80,0.12),transparent_32%)]" />

            {visible.lowSoc &&
              (data?.low_soc_zones || []).map((zone, index) => {
                const pos = project(zone.center, bounds);
                return (
                  <div
                    key={`low-${index}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-red/70 bg-accent-red/15"
                    style={{ ...pos, width: `${Math.min(180, 54 + zone.sample_count * 4)}px`, height: `${Math.min(180, 54 + zone.sample_count * 4)}px` }}
                    title={`Low SOC zone: ${zone.sample_count} samples`}
                  />
                );
              })}

            {visible.stops &&
              (data?.frequent_stop_zones || []).map((zone, index) => {
                const pos = project(zone.center, bounds);
                return (
                  <div
                    key={`stop-${index}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-amber/70 bg-accent-amber/15"
                    style={{ ...pos, width: `${Math.min(150, 42 + zone.sample_count * 3)}px`, height: `${Math.min(150, 42 + zone.sample_count * 3)}px` }}
                    title={`Stop zone: ${zone.sample_count} samples`}
                  />
                );
              })}

            {visible.chargers &&
              (data?.charger_points || []).map((point, index) => {
                const pos = project(point, bounds);
                return (
                  <div key={`charger-${index}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos} title={point.name}>
                    <div className="w-8 h-8 rounded-full bg-accent-green text-bg-primary border-2 border-bg-primary flex items-center justify-center shadow-lg">
                      <BatteryCharging className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}

            {visible.vehicles &&
              vehicles.map((point) => {
                const pos = project(point, bounds);
                return (
                  <div
                    key={`${point.driver_id}-${point.vehicle_id}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={pos}
                    title={`${point.driver_code} - ${Number(point.soc).toFixed(1)}% SOC`}
                  >
                    <div className="relative">
                      <div
                        className="w-11 h-11 rounded-full border-2 border-bg-primary flex items-center justify-center shadow-xl"
                        style={{ backgroundColor: riskColor(point.risk_level) }}
                      >
                        <Navigation className="w-5 h-5 text-bg-primary" />
                      </div>
                      <div className="absolute left-1/2 top-11 -translate-x-1/2 whitespace-nowrap rounded-md border border-bg-border bg-bg-card/95 px-2 py-1 text-[10px] font-bold text-text-primary shadow-lg">
                        {point.driver_code} - {Number(point.soc).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {!points.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-10 h-10 text-text-dim mx-auto mb-3" />
              <p className="text-sm text-text-primary font-semibold">No live GPS points yet</p>
              <p className="text-xs text-text-dim mt-1">The map will populate once telemetry includes lat/lng.</p>
            </div>
          </div>
        )}

        <div className="absolute left-4 bottom-4 rounded-lg border border-bg-border bg-bg-card/90 px-3 py-2 text-[11px] text-text-dim">
          Updated {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : "when live data arrives"}
        </div>
      </div>
    </div>
  );
}
