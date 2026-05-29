export type MobileState = 'ready' | 'listening' | 'trip_active' | 'waiting' | 'charging' | 'emergency';

export type LocationPoint = {
  lat: number;
  lng: number;
  accuracy_m?: number;
  speed_mps?: number;
  heading_deg?: number;
  captured_at?: string;
};

export type MobileTripSession = {
  id: string;
  destination_text?: string;
  status: string;
  started_at: string;
  ended_at?: string;
};

export type MobileChargingSession = {
  id: string;
  started_at: string;
  duration_seconds: number;
  soc_start?: number;
  soc_end?: number;
};

export type MobileWaitEvent = {
  id: string;
  started_at: string;
  duration_seconds: number;
  wait_type: string;
};

export type MobileIssueEvent = {
  id: string;
  issue_type: string;
  status: string;
  message?: string;
};

export type MobileMe = {
  user: { id: string; email: string; full_name: string; role: string; driver_id?: string };
  driver: { id: string; full_name: string; driver_code: string };
  vehicle?: { id: string; vehicle_code: string; latest_dynamic_range_km?: number } | null;
  latest_telemetry?: { soc?: number; lat?: number; lng?: number; recorded_at?: string } | null;
  active_trip?: MobileTripSession | null;
  active_waiting?: MobileWaitEvent | null;
  active_charging?: MobileChargingSession | null;
};

export type ApiResult<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
};

export type QueuedEvent = {
  id: string;
  endpoint: string;
  method: 'POST';
  body: unknown;
  createdAt: string;
  attempts: number;
};
