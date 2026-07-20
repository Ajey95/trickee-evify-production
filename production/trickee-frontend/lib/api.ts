import {
  AccessRequest,
  Fleet,
  User,
  Vehicle,
  Prediction,
  Driver,
  Route,
  Nudge,
  Alert,
  ModelMetrics,
} from "@/types";
import {
  readAccessToken,
  readRefreshToken,
  writeAuthSession,
} from "@/lib/auth-storage";

const DEFAULT_BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? "https://trickee-backend-397358873357.asia-southeast1.run.app/api/v1"
    : "http://localhost:8000/api/v1";
const BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
).replace(/\/$/, "");

type ApiResult<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
};
type FetcherOptions = RequestInit & {
  cacheTtlMs?: number;
  timeoutMs?: number;
};

const REQUEST_TIMEOUT_MS = 12_000;
const SESSION_CACHE_MS = 20_000;
const DEFAULT_GET_CACHE_MS = 60_000;
const LIVE_GET_CACHE_MS = 5_000;
const STALE_GET_CACHE_MS = 5 * 60_000;

let cachedToken: string | undefined;
let tokenExpiresAt = 0;
let refreshPromise: Promise<string | undefined> | null = null;
let sessionGeneration = 0;

const responseCache = new Map<
  string,
  { expiresAt: number; staleUntil: number; value: ApiResult<any> }
>();
const inflightRequests = new Map<string, Promise<ApiResult<any>>>();

async function getAccessToken() {
  const now = Date.now();
  if (now < tokenExpiresAt) return cachedToken;
  const trickeeToken = readAccessToken();
  if (trickeeToken) {
    cachedToken = trickeeToken;
    tokenExpiresAt = Date.now() + SESSION_CACHE_MS;
    return trickeeToken;
  }
  const refreshToken = readRefreshToken();
  if (refreshToken) {
    if (!refreshPromise) {
      const generation = sessionGeneration;
      const pendingRefresh = runNetworkRequest<{
        access_token: string;
        refresh_token?: string;
        expires_in_seconds?: number;
        user?: User;
      }>(
        `${BASE_URL}/auth/refresh`,
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        "POST",
        undefined,
        REQUEST_TIMEOUT_MS,
      )
        .then((result) => {
          if (generation !== sessionGeneration) return undefined;
          if (result.success && result.data?.access_token) {
            writeAuthSession(result.data);
            cachedToken = result.data.access_token;
            tokenExpiresAt = Date.now() + SESSION_CACHE_MS;
            return result.data.access_token;
          }
          writeAuthSession(undefined);
          return undefined;
        })
        .finally(() => {
          if (refreshPromise === pendingRefresh) refreshPromise = null;
        });
      refreshPromise = pendingRefresh;
    }
    return refreshPromise;
  }
  return undefined;
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
  cachedToken = undefined;
  tokenExpiresAt = 0;
  sessionGeneration += 1;
  refreshPromise = null;
}

export function resetApiClientState() {
  clearReadCache();
}

function refreshCacheInBackground<T>(
  key: string,
  ttl: number,
  request: Promise<ApiResult<T>>,
) {
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
  options: FetcherOptions = {},
): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${endpoint}`;
  const { cacheTtlMs, timeoutMs, ...requestOptions } = options;
  const method = (requestOptions.method || "GET").toUpperCase();
  const token = await getAccessToken();
  const ttl = getCacheTtl(endpoint, method, cacheTtlMs);
  const key = cacheKey(url, method, token);

  if (ttl > 0) {
    const cached = responseCache.get(key);
    if (cached && Date.now() < cached.expiresAt)
      return cached.value as ApiResult<T>;
    const inflight = inflightRequests.get(key);
    if (inflight) return inflight as Promise<ApiResult<T>>;
    if (cached && Date.now() < cached.staleUntil) {
      const backgroundRequest = runNetworkRequest<T>(
        url,
        requestOptions,
        method,
        token,
        timeoutMs,
      );
      refreshCacheInBackground(key, ttl, backgroundRequest);
      return cached.value as ApiResult<T>;
    }
  }

  const request = runNetworkRequest<T>(
    url,
    requestOptions,
    method,
    token,
    timeoutMs,
  );

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
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const upstreamSignal = requestOptions.signal;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else
      upstreamSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
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
        error:
          result?.detail ||
          result?.error ||
          `Request failed with ${response.status}`,
      };
    }
    if (method !== "GET") clearReadCache();
    return result as ApiResult<T>;
  } catch (error) {
    return {
      success: false,
      data: null as T,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "Request timed out"
          : error instanceof Error
            ? error.message
            : "Failed to fetch",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  // 6.1 Auth
  auth: {
    signupOptions: () =>
      fetcher<{
        vehicles: Array<{
          id: string;
          vehicle_code: string;
          fleet_id?: string;
          fleet_name?: string;
        }>;
      }>("/auth/signup-options", {
        cacheTtlMs: 60_000,
      }),
    me: () => fetcher<User>("/auth/me"),
    googleLogin: (
      idToken: string,
      context: {
        full_name?: string;
        company?: string;
        requested_role?: string;
        requested_vehicle_id?: string;
      } = {},
    ) =>
      fetcher<{
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in_seconds: number;
        user: User;
      }>("/auth/google-login", {
        method: "POST",
        body: JSON.stringify({ id_token: idToken, ...context }),
        cacheTtlMs: 0,
      }),
    refresh: (refreshToken: string) =>
      fetcher<{
        access_token: string;
        refresh_token?: string;
        token_type: string;
        expires_in_seconds?: number;
        user: User;
      }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        cacheTtlMs: 0,
      }),
    logout: (refreshToken?: string) =>
      fetcher<{ logged_out: boolean; refresh_token_revoked: boolean }>(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify(
            refreshToken ? { refresh_token: refreshToken } : {},
          ),
          cacheTtlMs: 0,
        },
      ),
    accessRequest: (data: {
      email: string;
      full_name: string;
      company?: string;
      requested_role?: string;
      requested_vehicle_id?: string;
    }) =>
      fetcher<{ status: string }>("/auth/access-request", {
        method: "POST",
        body: JSON.stringify(data),
        cacheTtlMs: 0,
      }),
    wsTicket: () =>
      fetcher<{ ticket: string; expires_in_seconds: number }>(
        "/auth/ws-ticket",
        { cacheTtlMs: 0 },
      ),
  },

  // 6.2 Vehicles
  vehicles: {
    list: () => fetcher<Vehicle[]>("/vehicles"),
    mine: () => fetcher<Vehicle[]>("/vehicles/me"),
    get: (id: string) => fetcher<Vehicle>(`/vehicles/${id}`),
    telemetry: (id: string, limit = 20) =>
      fetcher<any[]>(`/vehicles/${id}/telemetry?limit=${limit}`),
  },

  // 6.3 Predictions
  predictions: {
    infer: (vehicle_id: string) =>
      fetcher<Prediction>(`/predictions/infer/${vehicle_id}`, {
        method: "POST",
      }),
    history: (vehicle_id: string) =>
      fetcher<Prediction[]>(`/predictions/${vehicle_id}/history`),
  },

  // 6.4 Drivers
  drivers: {
    list: () => fetcher<Driver[]>("/drivers"),
    me: () => fetcher<Driver>("/drivers/me"),
    get: (id: string) => fetcher<Driver>(`/drivers/${id}`),
    trips: (id: string, limit = 20) =>
      fetcher<any[]>(`/drivers/${id}/trips?limit=${limit}`),
    tripTrace: (id: string, tripId: string) =>
      fetcher<any>(`/drivers/${id}/trips/${tripId}/trace`),
    profile: (id: string) => fetcher<any>(`/drivers/${id}/profile`),
    updateProfile: (id: string, data: any) =>
      fetcher<any>(`/drivers/${id}/profile/update`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    coaching: (id: string, data: any) =>
      fetcher<any>(`/drivers/${id}/coaching`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
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
    }) =>
      fetcher<{
        ranked_routes: Route[];
        departure_nudge?: Nudge;
        nudge?: any;
        recommended_route?: any;
        best_informational_route?: any;
        fallback_route?: any;
        all_routes_infeasible?: boolean;
        route_status?: string;
        route_source?: string;
      }>("/routes/score", {
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
    }) =>
      fetcher<any>("/routes/reroute", {
        method: "POST",
        body: JSON.stringify({
          original_route: data.incident_route_id,
          incident_speed_kmh: data.incident_type === "traffic_jam" ? 8 : 15,
          soc_current: data.current_soc,
          day_type: data.day_type,
          slot: data.slot,
        }),
      }),
    explain: (data: any) =>
      fetcher<any>("/routes/explain", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // 6.6 Alerts
  alerts: {
    list: () => fetcher<Alert[]>("/alerts"),
    resolve: (id: string) =>
      fetcher<any>(`/alerts/${id}/resolve`, {
        method: "POST",
      }),
    testPush: () =>
      fetcher<{
        sent: number;
        failed: number;
        enabled?: boolean;
        error?: string;
      }>("/alerts/test-push", {
        method: "POST",
        body: JSON.stringify({}),
        cacheTtlMs: 0,
      }),
  },

  // 6.7 Admin
  admin: {
    metrics: () => fetcher<ModelMetrics>("/admin/metrics"),
    users: () => fetcher<User[]>("/admin/users"),
    fleets: () => fetcher<Fleet[]>("/admin/fleets"),
    drivers: () => fetcher<Driver[]>("/admin/drivers"),
    accessRequests: () =>
      fetcher<AccessRequest[]>("/admin/access-requests", { cacheTtlMs: 0 }),
    updateUserMapping: (
      id: string,
      data: {
        role: string;
        fleet_id?: string;
        driver_id?: string;
        full_name?: string;
        is_active?: boolean;
      },
    ) =>
      fetcher<User>(`/admin/users/${id}/mapping`, {
        method: "PATCH",
        body: JSON.stringify(data),
        cacheTtlMs: 0,
      }),
    createAccessRequest: (data: {
      email: string;
      full_name: string;
      company?: string;
      requested_role: string;
      requested_vehicle_id?: string;
    }) =>
      fetcher<AccessRequest>("/admin/access-requests", {
        method: "POST",
        body: JSON.stringify(data),
        cacheTtlMs: 0,
      }),
    approveAccessRequest: (
      id: string,
      data: {
        role: string;
        fleet_id?: string;
        driver_id?: string;
        requested_vehicle_id?: string;
        full_name?: string;
        review_note?: string;
      },
    ) =>
      fetcher<{ access_request: AccessRequest; user: User }>(
        `/admin/access-requests/${id}/approve`,
        {
          method: "POST",
          body: JSON.stringify(data),
          cacheTtlMs: 0,
        },
      ),
    rejectAccessRequest: (id: string, data: { review_note?: string } = {}) =>
      fetcher<AccessRequest>(`/admin/access-requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify(data),
        cacheTtlMs: 0,
      }),
  },

  intelligence: {
    driverBehavior: (driver_id: string) =>
      fetcher<any>(`/intelligence/drivers/${driver_id}/behavior`),
    driverLiveProfile: (driver_id: string) =>
      fetcher<any>(`/intelligence/drivers/${driver_id}/live-profile`),
    driverLiveDecision: (driver_id: string) =>
      fetcher<any>(`/intelligence/drivers/${driver_id}/live-decision`),
    fleetLive: (window_minutes = 10080) =>
      fetcher<any>(`/intelligence/fleet/live?window_minutes=${window_minutes}`),
    liveMap: (
      driver_id?: string,
      options?: { timeoutMs?: number; cacheTtlMs?: number },
    ) =>
      fetcher<any>(
        `/intelligence/live-map${driver_id ? `?driver_id=${encodeURIComponent(driver_id)}` : ""}`,
        options,
      ),
    weeklyReport: (days = 7) =>
      fetcher<any>(`/intelligence/reports/weekly?days=${days}`),
    reportCharts: (days = 7) =>
      fetcher<any>(`/intelligence/reports/charts?days=${days}`, {
        cacheTtlMs: 30_000,
      }),
    dailyImpact: (reportDate?: string) =>
      fetcher<any>(
        `/intelligence/reports/daily-impact${reportDate ? `?report_date=${encodeURIComponent(reportDate)}` : ""}`,
        { cacheTtlMs: 30_000 },
      ),
    waitTime: (data: any) =>
      fetcher<any>("/intelligence/wait-time", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    assignOrder: (data: any) =>
      fetcher<any>("/intelligence/orders/assign", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    chargingDecision: (data: any) =>
      fetcher<any>("/intelligence/charging/decision", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    waits: (limit = 50) =>
      fetcher<any[]>(`/intelligence/history/waits?limit=${limit}`),
    orderAssignments: (limit = 50) =>
      fetcher<any[]>(`/intelligence/history/order-assignments?limit=${limit}`),
    chargingDecisions: (limit = 50) =>
      fetcher<any[]>(`/intelligence/history/charging-decisions?limit=${limit}`),
    nudges: (limit = 50) =>
      fetcher<any[]>(`/intelligence/history/nudges?limit=${limit}`),
    driverBehaviorHistory: (limit = 100) =>
      fetcher<any[]>(`/intelligence/history/driver-behavior?limit=${limit}`),
    routeContext: (data: any) =>
      fetcher<any>("/intelligence/context", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  notifications: {
    personalize: (data: any) =>
      fetcher<any>("/notifications/personalize", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  assistant: {
    message: (data: any) =>
      fetcher<any>("/assistant/message", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  battery: {
    insight: (data: any) =>
      fetcher<any>("/battery/insight", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  chargers: {
    recommend: (data: any) =>
      fetcher<any>("/chargers/recommend", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  fleet: {
    summary: (data: any) =>
      fetcher<any>("/fleet/summary", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
