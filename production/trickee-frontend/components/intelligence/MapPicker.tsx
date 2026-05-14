"use client";

import React from "react";
import { LocateFixed, MapPin, Navigation } from "lucide-react";

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

function normalizeLeaflet(module: typeof import("leaflet") | { default?: typeof import("leaflet") }) {
  return ("default" in module && module.default ? module.default : module) as typeof import("leaflet");
}

export function MapPicker({ origin, destination, onOriginChange, onDestinationChange }: MapPickerProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const leafletRef = React.useRef<typeof import("leaflet") | null>(null);
  const mapObjRef = React.useRef<any>(null);
  const originMarkerRef = React.useRef<any>(null);
  const destMarkerRef = React.useRef<any>(null);
  const [target, setTarget] = React.useState<"origin" | "destination">("origin");
  const [mode, setMode] = React.useState<"map" | "fallback">("fallback");

  React.useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    import("leaflet")
      .then((leafletModule) => {
        const L = normalizeLeaflet(leafletModule);
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
            label: target === "origin" ? "Picked origin" : "Picked destination",
          };
          if (target === "origin") onOriginChange(point);
          else onDestinationChange(point);
        });
        mapObjRef.current = map;
        window.requestAnimationFrame(() => map.invalidateSize());
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
  }, [onDestinationChange, onOriginChange, target]);

  React.useEffect(() => {
    const L = leafletRef.current;
    const map = mapObjRef.current;
    if (!L || !map) return;

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
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-9 h-9 text-text-dim mx-auto mb-2" />
                <p className="text-sm text-text-primary font-semibold">Map fallback</p>
                <p className="text-xs text-text-dim">Leaflet will load in the browser when available.</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {[origin, destination].map((point, index) => (
            <div key={index === 0 ? "origin" : "destination"} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                {index === 0 ? <LocateFixed className="w-4 h-4 text-accent-teal" /> : <Navigation className="w-4 h-4 text-accent-green" />}
                <p className="text-xs font-bold uppercase tracking-wider text-text-dim">{index === 0 ? "Origin" : "Destination"}</p>
              </div>
              <p className="text-sm font-semibold text-text-primary">{point.label}</p>
              <p className="text-xs text-text-dim font-mono">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>
            </div>
          ))}

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
