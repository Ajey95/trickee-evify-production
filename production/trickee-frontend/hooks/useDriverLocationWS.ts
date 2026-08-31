import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export type LiveMapData = {
  generated_at?: string;
  vehicle_points?: any[];
  low_soc_zones?: any[];
  frequent_stop_zones?: any[];
  charger_points?: any[];
};

function mergeVehiclePoint(current: LiveMapData | null, point: any): LiveMapData {
  const rows = current?.vehicle_points || [];
  const index = rows.findIndex(
    (row) =>
      (point.driver_id && row.driver_id === point.driver_id) ||
      (point.vehicle_id && row.vehicle_id === point.vehicle_id)
  );
  const existing = index >= 0 ? rows[index] : {};
  const nextPoint = { ...existing, ...point, risk_level: point.risk_level ?? existing.risk_level };
  const vehicle_points =
    index >= 0
      ? rows.map((row, rowIndex) => (rowIndex === index ? nextPoint : row))
      : [...rows, nextPoint];

  return {
    ...current,
    low_soc_zones: current?.low_soc_zones || [],
    frequent_stop_zones: current?.frequent_stop_zones || [],
    charger_points: current?.charger_points || [],
    generated_at: point.recorded_at || new Date().toISOString(),
    vehicle_points,
  };
}

/**
 * Converts the REST base URL to its WebSocket equivalent.
 *
 * NEXT_PUBLIC_BACKEND_URL is something like
 *   "https://api.example.com/api/v1"  → "wss://api.example.com"
 *   "http://localhost:8000/api/v1"    → "ws://localhost:8000"
 *
 * The WebSocket endpoint is mounted at the root of the server
 * (/ws/live-map), not under the /api/v1 prefix.
 */
function wsBaseUrl(): string {
  const defaultRestUrl =
    process.env.NODE_ENV === "production"
      ? "https://trickee-backend-397358873357.asia-south1.run.app/api/v1"
      : "http://localhost:8000/api/v1";
  const rest = (
    process.env.NODE_ENV === "production"
      ? defaultRestUrl
      : process.env.NEXT_PUBLIC_BACKEND_URL || defaultRestUrl
  ).replace(/\/$/, "");
  return rest
    .replace(/\/api\/v1$/, "")
    .replace(/^https:/, "wss:")
    .replace(/^http:/, "ws:");
}

/**
 * React hook that maintains a persistent WebSocket connection to the
 * backend `/ws/live-map` endpoint and returns live-map snapshots.
 *
 * Features:
 * - Authenticates via a short-lived WS ticket. The normal dashboard JWT is
 *   never placed in the WebSocket URL where access logs can capture it.
 * - Auto-reconnects on disconnect with exponential back-off (1 s → 32 s).
 * - Filters by `driverId` when provided.
 *
 * @returns `{ data, connected }` where `data` is the latest snapshot and
 *   `connected` reflects the current WebSocket state.
 */
export function useDriverLocationWS(driverId?: string): {
  data: LiveMapData | null;
  connected: boolean;
} {
  const [data, setData] = useState<LiveMapData | null>(null);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    retryDelayRef.current = 1000;

    function scheduleReconnect(connect: () => void) {
      if (!active) return;
      retryTimerRef.current = setTimeout(() => {
        if (!active) return;
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
        connect();
      }, retryDelayRef.current);
    }

    async function connect() {
      if (!active) return;

      const ticketResult = await api.auth.wsTicket();
      const ticket = ticketResult.success ? ticketResult.data?.ticket : undefined;

      if (!ticket) {
        // Session not ready yet – retry shortly.
        scheduleReconnect(connect);
        return;
      }

      const params = new URLSearchParams({ ticket });
      if (driverId) params.set("driver_id", driverId);

      const url = `${wsBaseUrl()}/ws/live-map?${params.toString()}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryDelayRef.current = 1000; // reset back-off on successful connect
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "live_map" && msg.data) {
            setData(msg.data as LiveMapData);
          } else if (msg.type === "vehicle_point" && msg.data) {
            setData((current) => mergeVehiclePoint(current, msg.data));
          }
        } catch {
          // malformed frame – ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        scheduleReconnect(connect);
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so reconnect is handled there.
        ws.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [driverId]); // reconnect when the driverId filter changes

  return { data, connected };
}
