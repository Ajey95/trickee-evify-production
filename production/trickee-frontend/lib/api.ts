import { 
  User, 
  Vehicle, 
  Prediction, 
  Driver, 
  Route, 
  Nudge, 
  Alert, 
  ModelMetrics 
} from "@/types";
import { getSession } from "next-auth/react";

const BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

type ApiResult<T> = { success: boolean; data: T; message?: string; error?: string };
type FetcherOptions = RequestInit & {
  cacheTtlMs?: number;
  timeoutMs?: number;
};

const REQUEST_TIMEOUT_MS = 12_000;
const SESSION_CACHE_MS = 30_000;
const DEFAULT_GET_CACHE_MS = 60_000;
const LIVE_GET_CACHE_MS = 5_000;
const STALE_GET_CACHE_MS = 5 * 60_000;

let cachedToken: string | undefined;
let tokenExpiresAt = 0;
let tokenRequest: Promise<string | undefined> | null = null;

const responseCache = new Map<string, { expiresAt: number; staleUntil: number; value: ApiResult<any> }>();
const inflightRequests = new Map<string, Promise<ApiResult<any>>>();

async function getAccessToken() {
  const now = Date.now();
  if (now < tokenExpiresAt) return cachedToken;
  if (!tokenRequest) {
    tokenRequest = getSession()
      .then((session) => (session as any)?.accessToken as string | undefined)
      .then((token) => {
        cachedToken = token;
        tokenExpiresAt = Date.now() + SESSION_CACHE_MS;
        return token;
      })
      .finally(() => {
        tokenRequest = null;
      });
  }
  return tokenRequest;
}

function getCacheTtl(endpoint: string, method: string, explicitTtl?: number) {
  if (typeof explicitTtl === "number") return explicitTtl;
  if (method !== "GET") return 0;
  if (endpoint.includes("/telemetry")) return 0;
  if (endpoint.startsWith("/intelligence/live-map")) return LIVE_GET_CACHE_MS;
  return DEFAULT_GET_CACHE_MS;
}

function cacheKey(url: string, method: string, token?: string) {
  return `${method}:${url}:${token || "anon"}`;
}

function clearReadCache() {
  responseCache.clear();
  inflightRequests.clear();
}

function refreshCacheInBackground<T>(key: string, ttl: number, request: Promise<ApiResult<T>>) {
  inflightRequests.set(key, request);
  request
    .then((result) => {
      if (result.success) {
        responseCache.set(key, {
          expiresAt: Date.now() + ttl,
          staleUntil: Date.now() + STALE_GET_CACHE_MS,
          value: result,
        });
      }
    })
    .catch(() => {
      // Stale-while-revalidate should never surface transient backend/network
      // failures as runtime errors after the UI has already rendered cached data.
    })
    .finally(() => {
      inflightRequests.delete(key);
    });
}

async function fetcher<T>(
  endpoint: string, 
  options: FetcherOptions = {}
): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${endpoint}`;
  const { cacheTtlMs, timeoutMs, ...requestOptions } = options;
  const method = (requestOptions.method || "GET").toUpperCase();
  const token = await getAccessToken();
  const ttl = getCacheTtl(endpoint, method, cacheTtlMs);
  const key = cacheKey(url, method, token);

  if (ttl > 0) {
    const cached = responseCache.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.value as ApiResult<T>;
    const inflight = inflightRequests.get(key);
    if (inflight) return inflight as Promise<ApiResult<T>>;
    if (cached && Date.now() < cached.staleUntil) {
      const backgroundRequest = runNetworkRequest<T>(url, requestOptions, method, token, timeoutMs);
      refreshCacheInBackground(key, ttl, backgroundRequest);
      return cached.value as ApiResult<T>;
    }
  }
  
  const request = runNetworkRequest<T>(url, requestOptions, method, token, timeoutMs);

  if (ttl > 0) {
    inflightRequests.set(key, request);
  }

  try {
    const result = await request;
    if (ttl > 0 && result.success) {
      responseCache.set(key, {
        expiresAt: Date.now() + ttl,
        staleUntil: Date.now() + STALE_GET_CACHE_MS,
        value: result,
      });
    }
    return result;
  } catch (error) {
    return {
      success: false,
      data: null as any,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    inflightRequests.delete(key);
  }
}

async function runNetworkRequest<T>(
  url: string,
  requestOptions: RequestInit,
  method: string,
  token?: string,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const upstreamSignal = requestOptions.signal;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...requestOptions.headers,
      },
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        success: false,
        data: null as T,
        error: result?.detail || result?.error || `Request failed with ${response.status}`,
      };
    }
    if (method !== "GET") clearReadCache();
    return result as ApiResult<T>;
  } catch (error) {
    return {
      success: false,
      data: null as T,
      error: error instanceof Error && error.name === "AbortError" ? "Request timed out" : error instanceof Error ? error.message : "Failed to fetch",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  // 6.1 Auth
  auth: {
    me: () => fetcher<User>("/auth/me"),
    registerFcmToken: (token: string, device_label?: string) => fetcher<any>("/auth/fcm-token", {
      method: "POST",
      body: JSON.stringify({ token, platform: "web", device_label }),
    }),
  },

  // 6.2 Vehicles
  vehicles: {
    list: () => fetcher<Vehicle[]>("/vehicles"),
    mine: () => fetcher<Vehicle[]>("/vehicles/me"),
    get: (id: string) => fetcher<Vehicle>(`/vehicles/${id}`),
    telemetry: (id: string, limit = 20) => fetcher<any[]>(`/vehicles/${id}/telemetry?limit=${limit}`),
  },

  // 6.3 Predictions
  predictions: {
    infer: (vehicle_id: string) => fetcher<Prediction>(`/predictions/infer/${vehicle_id}`, {
      method: "POST",
    }),
    history: (vehicle_id: string) => fetcher<Prediction[]>(`/predictions/${vehicle_id}/history`),
  },

  // 6.4 Drivers
  drivers: {
    list: () => fetcher<Driver[]>("/drivers"),
    me: () => fetcher<Driver>("/drivers/me"),
    get: (id: string) => fetcher<Driver>(`/drivers/${id}`),
    trips: (id: string, limit = 20) => fetcher<any[]>(`/drivers/${id}/trips?limit=${limit}`),
  },

  // 6.5 Routes
  routes: {
    score: (data: {
      driver_id: string;
      soc_start: number;
      day_type: string;
      slot: string;
      origin?: { lat: number; lng: number };
      destination?: { lat: number; lng: number };
      origin_label: string;
      dest_label: string;
    }) => fetcher<{ ranked_routes: Route[]; departure_nudge?: Nudge; nudge?: any; recommended_route?: any; best_informational_route?: any; fallback_route?: any; all_routes_infeasible?: boolean; route_status?: string; route_source?: string }>("/routes/score", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    reroute: (data: {
      vehicle_id?: string;
      driver_id?: string;
      incident_route_id: string;
      incident_type: string;
      current_soc: number;
      day_type: string;
      slot: string;
    }) => fetcher<any>("/routes/reroute", {
      method: "POST",
      body: JSON.stringify({
        original_route: data.incident_route_id,
        incident_speed_kmh: data.incident_type === "traffic_jam" ? 8 : 15,
        soc_current: data.current_soc,
        day_type: data.day_type,
        slot: data.slot,
      }),
    }),
  },

  // 6.6 Alerts
  alerts: {
    list: () => fetcher<Alert[]>("/alerts"),
    resolve: (id: string) => fetcher<any>(`/alerts/${id}/resolve`, {
      method: "POST",
    }),
  },

  // 6.7 Admin
  admin: {
    metrics: () => fetcher<ModelMetrics>("/admin/metrics"),
    users: () => fetcher<User[]>("/admin/users"),
  },

  intelligence: {
    driverBehavior: (driver_id: string) => fetcher<any>(`/intelligence/drivers/${driver_id}/behavior`),
    driverLiveProfile: (driver_id: string) => fetcher<any>(`/intelligence/drivers/${driver_id}/live-profile`),
    driverLiveDecision: (driver_id: string) => fetcher<any>(`/intelligence/drivers/${driver_id}/live-decision`),
    fleetLive: (window_minutes = 10080) => fetcher<any>(`/intelligence/fleet/live?window_minutes=${window_minutes}`),
    liveMap: (driver_id?: string) => fetcher<any>(`/intelligence/live-map${driver_id ? `?driver_id=${encodeURIComponent(driver_id)}` : ""}`),
    weeklyReport: (days = 7) => fetcher<any>(`/intelligence/reports/weekly?days=${days}`),
    waitTime: (data: any) => fetcher<any>("/intelligence/wait-time", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    assignOrder: (data: any) => fetcher<any>("/intelligence/orders/assign", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    chargingDecision: (data: any) => fetcher<any>("/intelligence/charging/decision", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    waits: (limit = 50) => fetcher<any[]>(`/intelligence/history/waits?limit=${limit}`),
    orderAssignments: (limit = 50) => fetcher<any[]>(`/intelligence/history/order-assignments?limit=${limit}`),
    chargingDecisions: (limit = 50) => fetcher<any[]>(`/intelligence/history/charging-decisions?limit=${limit}`),
    nudges: (limit = 50) => fetcher<any[]>(`/intelligence/history/nudges?limit=${limit}`),
    driverBehaviorHistory: (limit = 100) => fetcher<any[]>(`/intelligence/history/driver-behavior?limit=${limit}`),
    routeContext: (data: any) => fetcher<any>("/intelligence/context", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  },
};
