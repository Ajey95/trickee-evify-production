"use client";

import React from "react";
import { LocateFixed, Navigation } from "lucide-react";

export type PickedPoint = {
  lat: number;
  lng: number;
  label: string;
};

type MapPickerProps = {
  origin: PickedPoint;
  destination: PickedPoint;
  onOriginChange: (point: PickedPoint) => void;
  onDestinationChange: (point: PickedPoint) => void;
};

const presets = [
  { label: "Ring Road Depot", lat: 21.1702, lng: 72.8311 },
  { label: "Varachha Pickup", lat: 21.2131, lng: 72.8708 },
  { label: "Katargam", lat: 21.2244, lng: 72.8313 },
  { label: "Adajan", lat: 21.1959, lng: 72.7925 },
  { label: "Hotel Kohinoor", lat: 21.1862, lng: 72.8316 },
];

function isPicked(a: PickedPoint, b: PickedPoint) {
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001;
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

function osmEmbedUrl(origin: PickedPoint, destination: PickedPoint) {
  const minLat = Math.min(origin.lat, destination.lat) - 0.025;
  const maxLat = Math.max(origin.lat, destination.lat) + 0.025;
  const minLng = Math.min(origin.lng, destination.lng) - 0.025;
  const maxLng = Math.max(origin.lng, destination.lng) + 0.025;
  const bbox = [minLng, minLat, maxLng, maxLat].map((value) => value.toFixed(5)).join("%2C");
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

export function MapPicker({ origin, destination, onOriginChange, onDestinationChange }: MapPickerProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const leafletRef = React.useRef<typeof import("leaflet") | null>(null);
  const mapObjRef = React.useRef<any>(null);
  const originMarkerRef = React.useRef<any>(null);
  const destMarkerRef = React.useRef<any>(null);
  const [target, setTarget] = React.useState<"origin" | "destination">("origin");
  const [mode, setMode] = React.useState<"map" | "fallback">("fallback");

  const [originLat, setOriginLat] = React.useState(origin.lat.toString());
  const [originLng, setOriginLng] = React.useState(origin.lng.toString());
  const [destLat, setDestLat] = React.useState(destination.lat.toString());
  const [destLng, setDestLng] = React.useState(destination.lng.toString());

  React.useEffect(() => {
    setOriginLat(origin.lat.toString());
    setOriginLng(origin.lng.toString());
  }, [origin.lat, origin.lng]);

  React.useEffect(() => {
    setDestLat(destination.lat.toString());
    setDestLng(destination.lng.toString());
  }, [destination.lat, destination.lng]);

  const handleOriginLatChange = (val: string) => {
    setOriginLat(val);
    const parsed = parseFloat(val);
    const lat = isNaN(parsed) ? 0 : parsed;
    onOriginChange({ lat, lng: origin.lng, label: "Manual origin" });
  };

  const handleOriginLngChange = (val: string) => {
    setOriginLng(val);
    const parsed = parseFloat(val);
    const lng = isNaN(parsed) ? 0 : parsed;
    onOriginChange({ lat: origin.lat, lng, label: "Manual origin" });
  };

  const handleDestLatChange = (val: string) => {
    setDestLat(val);
    const parsed = parseFloat(val);
    const lat = isNaN(parsed) ? 0 : parsed;
    onDestinationChange({ lat, lng: destination.lng, label: "Manual destination" });
  };

  const handleDestLngChange = (val: string) => {
    setDestLng(val);
    const parsed = parseFloat(val);
    const lng = isNaN(parsed) ? 0 : parsed;
    onDestinationChange({ lat: destination.lat, lng, label: "Manual destination" });
  };

  const targetRef = React.useRef(target);
  React.useEffect(() => {
    targetRef.current = target;
  }, [target]);

  React.useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapObjRef.current) return;
        leafletRef.current = L;
        setMode("map");
        const map = L.map(mapRef.current).setView([21.18, 72.83], 12);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        }).addTo(map);
        map.on("click", (event: any) => {
          const point = {
            lat: Number(event.latlng.lat.toFixed(6)),
            lng: Number(event.latlng.lng.toFixed(6)),
            label: targetRef.current === "origin" ? "Picked origin" : "Picked destination",
          };
          if (targetRef.current === "origin") onOriginChange(point);
          else onDestinationChange(point);
        });
        mapObjRef.current = map;
        scheduleInvalidate(map);
      })
      .catch(() => setMode("fallback"));

    return () => {
      cancelled = true;
      if (mapObjRef.current) mapObjRef.current.remove();
      mapObjRef.current = null;
      leafletRef.current = null;
      originMarkerRef.current = null;
      destMarkerRef.current = null;
    };
  }, [onDestinationChange, onOriginChange]);

  React.useEffect(() => {
    const L = leafletRef.current;
    const map = mapObjRef.current;
    if (!L || !map) return;
    const cancelInvalidate = scheduleInvalidate(map);

    const originLatLng: [number, number] = [origin.lat, origin.lng];
    const destLatLng: [number, number] = [destination.lat, destination.lng];

    if (!originMarkerRef.current) {
      originMarkerRef.current = L.marker(originLatLng, { title: "Origin" }).addTo(map).bindTooltip("Origin");
    } else {
      originMarkerRef.current.setLatLng(originLatLng);
    }
    if (!destMarkerRef.current) {
      destMarkerRef.current = L.marker(destLatLng, { title: "Destination" }).addTo(map).bindTooltip("Destination");
    } else {
      destMarkerRef.current.setLatLng(destLatLng);
    }

    map.fitBounds(L.latLngBounds([originLatLng, destLatLng]), { padding: [42, 42], maxZoom: 14 });

    return cancelInvalidate;
  }, [origin, destination]);

  const choosePreset = (preset: PickedPoint) => {
    if (target === "origin") onOriginChange(preset);
    else onDestinationChange(preset);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-bg-border bg-bg-primary p-1">
          {(["origin", "destination"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTarget(key)}
              className={`h-8 px-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                target === key ? "bg-accent-teal text-bg-primary" : "text-text-dim"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="text-xs text-text-dim">
          {mode === "map" ? "Click map to set the active point" : "Use presets or lat/lng fields"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="relative min-h-[340px] overflow-hidden rounded-lg border border-bg-border bg-[#101722]">
          <div ref={mapRef} className={`absolute inset-0 ${mode === "map" ? "" : "opacity-0"}`} />
          {mode !== "map" && (
            <div className="absolute inset-0">
              <iframe
                title="OpenStreetMap picker"
                src={osmEmbedUrl(origin, destination)}
                className="absolute inset-0 h-full w-full border-0 opacity-80 grayscale invert"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-lg border border-bg-border bg-bg-card/90 p-3 text-xs text-text-dim">
                Select origin/destination from presets. Interactive map controls load when Leaflet is available.
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Origin Card */}
          <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <LocateFixed className="w-4 h-4 text-accent-teal" />
              <p className="text-xs font-bold uppercase tracking-wider text-text-dim">Origin</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{origin.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-dim uppercase tracking-wider block mb-1">Lat</label>
                <input
                  type="text"
                  value={originLat}
                  onChange={(e) => handleOriginLatChange(e.target.value)}
                  className="w-full bg-bg-card border border-bg-border text-text-primary text-xs px-2 py-1 rounded font-mono focus:outline-none focus:border-accent-teal"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-dim uppercase tracking-wider block mb-1">Lng</label>
                <input
                  type="text"
                  value={originLng}
                  onChange={(e) => handleOriginLngChange(e.target.value)}
                  className="w-full bg-bg-card border border-bg-border text-text-primary text-xs px-2 py-1 rounded font-mono focus:outline-none focus:border-accent-teal"
                />
              </div>
            </div>
          </div>

          {/* Destination Card */}
          <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-accent-green" />
              <p className="text-xs font-bold uppercase tracking-wider text-text-dim">Destination</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{destination.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-dim uppercase tracking-wider block mb-1">Lat</label>
                <input
                  type="text"
                  value={destLat}
                  onChange={(e) => handleDestLatChange(e.target.value)}
                  className="w-full bg-bg-card border border-bg-border text-text-primary text-xs px-2 py-1 rounded font-mono focus:outline-none focus:border-accent-green"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-dim uppercase tracking-wider block mb-1">Lng</label>
                <input
                  type="text"
                  value={destLng}
                  onChange={(e) => handleDestLngChange(e.target.value)}
                  className="w-full bg-bg-card border border-bg-border text-text-primary text-xs px-2 py-1 rounded font-mono focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => choosePreset(preset)}
                className={`text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
                  isPicked(origin, preset) || isPicked(destination, preset)
                    ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                    : "border-bg-border bg-bg-card text-text-dim hover:text-text-primary"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
