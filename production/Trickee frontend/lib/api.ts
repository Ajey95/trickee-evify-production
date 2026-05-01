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

async function fetcher<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; message?: string; error?: string }> {
  const url = `${BASE_URL}${endpoint}`;
  const session = await getSession();
  const token = (session as any)?.accessToken;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
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
    return result;
  } catch (error) {
    return {
      success: false,
      data: null as any,
      error: error instanceof Error ? error.message : "Unknown error",
    };
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
      origin_label: string;
      dest_label: string;
    }) => fetcher<{ ranked_routes: Route[]; departure_nudge?: Nudge; nudge?: any; recommended_route?: any; fallback_route?: any }>("/routes/score", {
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
  },
};
