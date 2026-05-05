import { useEffect, useRef, useState } from "react";
import { getSession } from "next-auth/react";

export type LiveMapData = {
  generated_at?: string;
  vehicle_points?: any[];
  low_soc_zones?: any[];
  frequent_stop_zones?: any[];
  charger_points?: any[];
};

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
  const rest = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
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
 * - Authenticates via JWT passed as `?token=<jwt>` (browsers cannot set
 *   custom headers during a WebSocket handshake).
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
  const activeRef = useRef(true);
  // Track the driverId in a ref so the reconnect closure always reads the
  // latest value without needing to be recreated on every driverId change.
  const driverIdRef = useRef(driverId);
  driverIdRef.current = driverId;

  useEffect(() => {
    activeRef.current = true;
    retryDelayRef.current = 1000;

    async function connect() {
      if (!activeRef.current) return;

      const session = await getSession();
      const token = (session as any)?.accessToken as string | undefined;

      if (!token) {
        // Session not ready yet – retry shortly.
        retryTimerRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
          connect();
        }, retryDelayRef.current);
        return;
      }

      const params = new URLSearchParams({ token });
      if (driverIdRef.current) params.set("driver_id", driverIdRef.current);

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
          }
        } catch {
          // malformed frame – ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (activeRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
            connect();
          }, retryDelayRef.current);
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose, so reconnect is handled there.
        ws.close();
      };
    }

    connect();

    return () => {
      activeRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [driverId]); // reconnect when the driverId filter changes

  return { data, connected };
}
