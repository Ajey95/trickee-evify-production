"use client";

import React from "react";
import { BatteryCharging, Car, MapPin, TriangleAlert, type LucideIcon } from "lucide-react";

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
  wsConnected?: boolean;
  userLocation?: (LatLng & { accuracy_m?: number; captured_at?: string }) | null;
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

function riskTone(risk?: string) {
  if (risk === "high") return "risk-high";
  if (risk === "medium") return "risk-medium";
  return "risk-low";
}

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function vehicleIconHtml(point: VehiclePoint) {
  const soc = Number(point.soc).toFixed(0);
  return `
    <div class="trickee-vehicle-marker ${riskTone(point.risk_level)}">
      <span class="trickee-marker-pulse"></span>
      <span class="trickee-marker-core">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5 19.5 20 12 16.9 4.5 20 12 3.5Z" />
        </svg>
      </span>
      <span class="trickee-marker-label">
        <b>${escapeHtml(point.driver_code)}</b>
        <em>${escapeHtml(soc)}%</em>
      </span>
    </div>`;
}

function chargerIconHtml(point: ChargerPoint) {
  return `
    <div class="trickee-charger-marker" title="${escapeHtml(point.name)}">
      <span class="trickee-charger-dot">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 5.5 13H11l-1 9 8-12h-5l1-8Z" />
        </svg>
      </span>
    </div>`;
}

function VehicleMarker({ point }: { point: VehiclePoint }) {
  return (
    <div className={`trickee-vehicle-marker ${riskTone(point.risk_level)}`}>
      <span className="trickee-marker-pulse" />
      <span className="trickee-marker-core">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5 19.5 20 12 16.9 4.5 20 12 3.5Z" />
        </svg>
      </span>
      <span className="trickee-marker-label">
        <b>{point.driver_code}</b>
        <em>{Number(point.soc).toFixed(0)}%</em>
      </span>
    </div>
  );
}

function ChargerMarker({ point }: { point: ChargerPoint }) {
  return (
    <div className="trickee-charger-marker" title={point.name}>
      <span className="trickee-charger-dot">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 5.5 13H11l-1 9 8-12h-5l1-8Z" />
        </svg>
      </span>
    </div>
  );
}

function userLocationHtml(point: LatLng & { accuracy_m?: number }) {
  const accuracy = Number.isFinite(point.accuracy_m || NaN) ? ` ~${Math.round(point.accuracy_m || 0)}m` : "";
  return `
    <div class="trickee-user-location-marker" title="Your browser location${accuracy}">
      <span class="trickee-user-location-pulse"></span>
      <span class="trickee-user-location-core"></span>
    </div>`;
}

function UserLocationMarker({ point }: { point: LatLng & { accuracy_m?: number } }) {
  const accuracy = Number.isFinite(point.accuracy_m || NaN) ? ` ~${Math.round(point.accuracy_m || 0)}m` : "";
  return (
    <div className="trickee-user-location-marker" title={`Your browser location${accuracy}`}>
      <span className="trickee-user-location-pulse" />
      <span className="trickee-user-location-core" />
    </div>
  );
}

type LeafletModule = typeof import("leaflet");

declare global {
  interface Window {
    L?: LeafletModule;
  }
}

function normalizeLeaflet(module: LeafletModule | { default?: LeafletModule }) {
  return ("default" in module && module.default ? module.default : module) as typeof import("leaflet");
}

function ensureStylesheet(id: string, href: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (window.L) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

async function loadLeaflet() {
  try {
    return normalizeLeaflet(await import("leaflet"));
  } catch {
    ensureStylesheet("leaflet-cdn-css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    await loadScript("leaflet-cdn-js", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
    if (!window.L) throw new Error("Leaflet CDN loaded without window.L");
    return window.L;
  }
}

function osmEmbedUrl(bounds: ReturnType<typeof boundsFor>) {
  const bbox = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat]
    .map((value) => value.toFixed(5))
    .join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;
}

function scheduleInvalidate(map: { invalidateSize: () => void }) {
  const timers = [0, 250, 700].map((delay) =>
    window.setTimeout(() => {
      window.requestAnimationFrame(() => map.invalidateSize());
    }, delay)
  );
  return () => timers.forEach((timer) => window.clearTimeout(timer));
}

export function LiveMapPanel({ data, selectedDriverId, wsConnected, userLocation, className = "" }: LiveMapPanelProps) {
  const leafletRef = React.useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = React.useState<"leaflet" | "fallback">("fallback");
  const [zoom, setZoom] = React.useState(12);
  const [visible, setVisible] = React.useState<Record<LayerKey, boolean>>({
    vehicles: true,
    chargers: true,
    lowSoc: true,
    stops: true,
  });

  const lModRef = React.useRef<typeof import("leaflet") | null>(null);
  const mapObjRef = React.useRef<any>(null);
  const vehicleMarkersRef = React.useRef<Map<string, any>>(new Map());
  const staticLayersRef = React.useRef<any[]>([]);
  const hasInitFit = React.useRef(false);
  const lastFitKeyRef = React.useRef<string | null>(null);

  const vehicles = React.useMemo(() => {
    const rows = data?.vehicle_points || [];
    return selectedDriverId ? rows.filter((row) => row.driver_id === selectedDriverId) : rows;
  }, [data, selectedDriverId]);

  const points = React.useMemo(() => {
    const base = allCoordinates({ ...data, vehicle_points: vehicles });
    return userLocation ? [...base, userLocation] : base;
  }, [data, vehicles, userLocation]);
  const bounds = React.useMemo(() => boundsFor(points), [points]);

  React.useEffect(() => {
    if (!leafletRef.current) return;
    let cancelled = false;
    const markerMap = vehicleMarkersRef.current;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !leafletRef.current || mapObjRef.current) return;
        setMode("leaflet");

        const map = L.map(leafletRef.current, {
          center: [21.17, 72.83],
          zoom: 12,
          zoomControl: false,
          attributionControl: true,
          preferCanvas: true,
          scrollWheelZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          className: "trickee-premium-tiles",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        map.on("zoomend", () => setZoom(map.getZoom()));
        lModRef.current = L;
        mapObjRef.current = map;
        scheduleInvalidate(map);
      })
      .catch(() => setMode("fallback"));

    return () => {
      cancelled = true;
      staticLayersRef.current = [];
      markerMap.clear();
      hasInitFit.current = false;
      lastFitKeyRef.current = null;
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
      lModRef.current = null;
      setMode("fallback");
    };
  }, []);

  React.useEffect(() => {
    const L = lModRef.current;
    const map = mapObjRef.current;
    if (!L || !map || !data) return;
    const cancelInvalidate = scheduleInvalidate(map);

    const fitKey = `${selectedDriverId || "all"}:${userLocation ? `${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}` : "no-browser-location"}`;
    if ((!hasInitFit.current || lastFitKeyRef.current !== fitKey) && points.length) {
      if (points.length > 1) {
        map.fitBounds(
          L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [48, 48] }
        );
      } else {
        map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 13));
      }
      hasInitFit.current = true;
      lastFitKeyRef.current = fitKey;
    }

    const activeDriverIds = new Set<string>();
    if (visible.vehicles) {
      for (const point of vehicles) {
        activeDriverIds.add(point.driver_id);
        const ll: [number, number] = [point.lat, point.lng];
        const icon = L.divIcon({ className: "trickee-map-label", html: vehicleIconHtml(point), iconSize: [1, 1] });
        const existing = vehicleMarkersRef.current.get(point.driver_id);
        if (existing) {
          existing.setLatLng(ll);
          existing.setIcon(icon);
        } else {
          const marker = L.marker(ll, {
            title: `${point.driver_code} - ${Number(point.soc).toFixed(1)}% SOC`,
            icon,
          })
            .bindTooltip(`${point.driver_code} - ${Number(point.soc).toFixed(1)}% SOC`, {
              className: "trickee-map-tooltip",
              direction: "top",
              offset: [0, -18],
            })
            .addTo(map);
          vehicleMarkersRef.current.set(point.driver_id, marker);
        }
      }
    }

    vehicleMarkersRef.current.forEach((marker, id) => {
      if (!activeDriverIds.has(id)) {
        marker.remove();
        vehicleMarkersRef.current.delete(id);
      }
    });

    for (const layer of staticLayersRef.current) layer.remove();
    staticLayersRef.current = [];

    if (visible.chargers) {
      for (const point of data.charger_points || []) {
        const layer = L.marker([point.lat, point.lng], {
          title: point.name,
          icon: L.divIcon({ className: "trickee-map-label", html: chargerIconHtml(point), iconSize: [1, 1] }),
        })
          .bindTooltip(point.name, {
            className: "trickee-map-tooltip",
            direction: "top",
            offset: [0, -12],
          })
          .addTo(map);
        staticLayersRef.current.push(layer);
      }
    }

    if (userLocation) {
      const layer = L.marker([userLocation.lat, userLocation.lng], {
        title: "Your browser location",
        icon: L.divIcon({ className: "trickee-map-label", html: userLocationHtml(userLocation), iconSize: [1, 1] }),
      })
        .bindTooltip("Your location", {
          className: "trickee-map-tooltip",
          direction: "top",
          offset: [0, -12],
        })
        .addTo(map);
      staticLayersRef.current.push(layer);
    }

    if (visible.lowSoc) {
      for (const zone of data.low_soc_zones || []) {
        const layer = L.circle([zone.center.lat, zone.center.lng], {
          radius: Math.min(420, 90 + zone.sample_count * 8),
          color: "#df6d63",
          fillColor: "#df6d63",
          fillOpacity: 0.13,
          opacity: 0.72,
          weight: 1.2,
        })
          .bindTooltip(`Low SOC zone - ${zone.sample_count} samples`, { className: "trickee-map-tooltip" })
          .addTo(map);
        staticLayersRef.current.push(layer);
      }
    }

    if (visible.stops) {
      for (const zone of data.frequent_stop_zones || []) {
        const layer = L.circle([zone.center.lat, zone.center.lng], {
          radius: Math.min(360, 70 + zone.sample_count * 6),
          color: "#c69b55",
          fillColor: "#c69b55",
          fillOpacity: 0.12,
          opacity: 0.68,
          weight: 1.2,
        })
          .bindTooltip(`Stop zone - ${zone.sample_count} samples`, { className: "trickee-map-tooltip" })
          .addTo(map);
        staticLayersRef.current.push(layer);
      }
    }

    return cancelInvalidate;
  }, [data, vehicles, visible, points, selectedDriverId, userLocation]);

  const toggle = (key: LayerKey) => {
    setVisible((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-full border border-white/10 bg-white/[0.045] p-1 backdrop-blur-md">
          {layerControls.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-[11px] font-semibold tracking-[-0.01em] transition-all duration-200 ${
                visible[key]
                  ? "bg-white text-[#101318] shadow-sm"
                  : "text-text-dim hover:bg-white/[0.06] hover:text-text-primary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-[11px] font-medium text-text-dim backdrop-blur-md">
          <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? "bg-[#75c995]" : "bg-[#c69b55]"}`} />
          <span>{wsConnected ? "Live stream" : "Background refresh"}</span>
          <span className="h-3 w-px bg-white/10" />
          <span>{mode === "leaflet" ? "OpenStreetMap" : "Projected"}</span>
        </div>
      </div>

      <div className="relative min-h-[560px] overflow-hidden rounded-[22px] border border-white/10 bg-[#eef0ec] shadow-[0_28px_80px_rgba(0,0,0,0.24)]">
        <div ref={leafletRef} className={`absolute inset-0 ${mode === "leaflet" ? "" : "opacity-0"}`} />
        {mode !== "leaflet" && (
          <div className="absolute inset-0">
            <iframe
              title="OpenStreetMap view"
              src={osmEmbedUrl(bounds)}
              className="absolute inset-0 h-full w-full border-0 opacity-75 grayscale"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="absolute inset-0 bg-[#eef0ec]/20" />

            {visible.lowSoc &&
              (data?.low_soc_zones || []).map((zone, index) => {
                const pos = project(zone.center, bounds);
                return (
                  <div
                    key={`low-${index}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#df6d63]/60 bg-[#df6d63]/15"
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
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c69b55]/60 bg-[#c69b55]/15"
                    style={{ ...pos, width: `${Math.min(150, 42 + zone.sample_count * 3)}px`, height: `${Math.min(150, 42 + zone.sample_count * 3)}px` }}
                    title={`Stop zone: ${zone.sample_count} samples`}
                  />
                );
              })}

            {visible.chargers &&
              (data?.charger_points || []).map((point, index) => {
                const pos = project(point, bounds);
                return (
                  <div key={`charger-${index}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos}>
                    <ChargerMarker point={point} />
                  </div>
                );
              })}

            {userLocation && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2" style={project(userLocation, bounds)}>
                <UserLocationMarker point={userLocation} />
              </div>
            )}

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
                    <VehicleMarker point={point} />
                  </div>
                );
              })}
          </div>
        )}

        {!points.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-white/50 bg-white/70 px-6 py-5 text-center text-[#1b1f26] shadow-sm backdrop-blur-xl">
              <MapPin className="mx-auto mb-3 h-8 w-8 text-[#6f7782]" />
              <p className="text-sm font-semibold">No live GPS points yet</p>
              <p className="mt-1 text-xs text-[#6f7782]">The map will populate once telemetry includes lat/lng.</p>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-2xl border border-white/55 bg-white/72 px-4 py-3 text-[#1b1f26] shadow-sm backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7782]">Fleet surface</p>
          <p className="mt-1 text-sm font-semibold">Surat live operations</p>
          <p className="mt-0.5 text-xs text-[#6f7782]">{vehicles.length} vehicles visible · zoom {zoom}</p>
        </div>

        <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-2xl border border-white/55 bg-white/72 shadow-sm backdrop-blur-xl">
          <button
            type="button"
            className="h-10 w-10 text-lg font-medium text-[#1b1f26] transition-colors hover:bg-white/70"
            onClick={() => mapObjRef.current?.zoomIn()}
            aria-label="Zoom in"
          >
            +
          </button>
          <span className="mx-2 h-px bg-[#d7d9dc]" />
          <button
            type="button"
            className="h-10 w-10 text-lg font-medium text-[#1b1f26] transition-colors hover:bg-white/70"
            onClick={() => mapObjRef.current?.zoomOut()}
            aria-label="Zoom out"
          >
            -
          </button>
        </div>

        <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-5.5rem)] flex-wrap items-center gap-2 rounded-2xl border border-white/55 bg-white/72 px-3 py-2 text-[11px] font-medium text-[#4d5561] shadow-sm backdrop-blur-xl">
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#4f9fb3]" />Vehicle</span>
          {userLocation && <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#00b4d8]" />You</span>}
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#7aa889]" />Charger</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#df6d63]" />Low SOC</span>
          <span className="hidden items-center gap-1.5 sm:inline-flex"><i className="h-2 w-2 rounded-full bg-[#c69b55]" />Stop zone</span>
          <span className="hidden text-[#7b828c] md:inline">
            Updated {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : "when live data arrives"}
          </span>
        </div>
      </div>
    </div>
  );
}
