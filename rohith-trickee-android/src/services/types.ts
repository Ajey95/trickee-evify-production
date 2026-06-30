/**
 * TypeScript models mirroring the Trickee backend serializers
 * (backend/app/services/serializers.py). Field names and nullability match the
 * JSON the API returns so screens can consume `data` directly.
 *
 * Keep this file in sync with the backend serializers — it is the contract.
 */

/** Standard response envelope used by every REST endpoint. */
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
  error: string | null;
};

export type UserRole = 'driver' | 'fleet_operator' | 'trickee_admin';

export type User = {
  id: string;
  email: string;
  supabase_user_id?: string | null;
  firebase_uid?: string | null;
  auth_provider?: string | null;
  full_name: string;
  role: UserRole | string;
  fleet_id?: string | null;
  driver_id?: string | null;
  is_active?: boolean;
};

export type Driver = {
  id: string;
  fleet_id?: string | null;
  driver_code: string;
  full_name: string;
  phone?: string | null;
  style_label?: string | null;
  personal_factor?: number | null;
  avg_regen_ratio?: number | null;
  avg_throttle_variance?: number | null;
  avg_current_30m?: number | null;
  avg_speed_30m?: number | null;
};

export type Telemetry = {
  id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  recorded_at?: string | null;
  soc?: number | null;
  current?: number | null;
  battery_voltage?: number | null;
  speed?: number | null;
  temp_max?: number | null;
  soh?: number | null;
  charge_plug?: boolean | null;
  ignition_on?: boolean | null;
  regen_status?: boolean | null;
  throttle_status?: boolean | null;
  cycle_count?: number | null;
  cell_imbalance_mv?: number | null;
  wh_throughput?: number | null;
  lat?: number | null;
  lng?: number | null;
  power?: number | null;
  power_density?: number | null;
  temp_rise_rate?: number | null;
  voltage_sag_v?: number | null;
  r_internal_mohm?: number | null;
  minute_of_day?: number | null;
  day_of_week?: number | null;
};

export type Vehicle = {
  id: string;
  fleet_id?: string | null;
  vehicle_code: string;
  make?: string | null;
  model?: string | null;
  battery_capacity_kwh?: number | null;
  max_range_km?: number | null;
  battery_chemistry?: string | null;
  manufacture_year?: number | null;
  is_active?: boolean;
  latest?: Telemetry | null;
  latest_dynamic_range_km?: number | null;
};

export type Alert = {
  id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  alert_type: string;
  message: string;
  soc_at_alert?: number | null;
  nearest_charger?: string | null;
  charger_distance_m?: number | null;
  is_resolved: boolean;
  created_at?: string | null;
};

export type MobileTripSession = {
  id: string;
  user_id: string;
  driver_id: string;
  vehicle_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_text?: string | null;
  destination_place_id?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  status: string;
  confidence?: number | null;
  source?: string | null;
  context?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MobileWaitEvent = {
  id: string;
  trip_session_id?: string | null;
  driver_id: string;
  vehicle_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  wait_type: string;
  confidence?: number | null;
  duration_seconds?: number | null;
  duration_min?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MobileChargingSession = {
  id: string;
  trip_session_id?: string | null;
  driver_id: string;
  vehicle_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  charger_name?: string | null;
  charger_place_id?: string | null;
  soc_start?: number | null;
  soc_end?: number | null;
  confidence?: number | null;
  duration_seconds?: number | null;
  duration_min?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MobileIssueEvent = {
  id: string;
  trip_session_id?: string | null;
  driver_id: string;
  vehicle_id?: string | null;
  issue_type: string;
  message?: string | null;
  lat?: number | null;
  lng?: number | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MobileLocationPoint = {
  id: string;
  driver_id: string;
  vehicle_id?: string | null;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  battery_pct?: number | null;
  tracking_state: string;
  captured_at?: string | null;
  received_at?: string | null;
};

/** Aggregate driver context returned by GET /mobile/me. */
export type MobileMe = {
  user: User;
  driver: Driver;
  vehicle: Vehicle | null;
  latest_telemetry: Telemetry | null;
  approval?: {approved: boolean; requires_driver_mapping: boolean};
  active_trip: MobileTripSession | null;
  active_waiting: MobileWaitEvent | null;
  active_charging: MobileChargingSession | null;
};

/** GPS/ignition-inferred trip (GET /drivers/{id}/trips). */
export type Trip = {
  id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  origin_label?: string | null;
  dest_label?: string | null;
  soc_start?: number | null;
  soc_end?: number | null;
  kwh_used?: number | null;
  distance_km?: number | null;
  route_taken?: string | null;
  recommended_route?: string | null;
  followed_nudge?: boolean | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

/** Issue categories accepted by POST /mobile/issues. */
export type IssueType =
  | 'low_battery'
  | 'breakdown'
  | 'puncture'
  | 'charger_not_working'
  | 'unsafe_route'
  | 'accident'
  | 'need_help';

export type TrackingState =
  | 'ready'
  | 'trip_active'
  | 'waiting'
  | 'charging'
  | 'emergency';

/** A single recommended charger (POST /chargers/recommend). */
export type ChargerOption = {
  name?: string | null;
  distance_km?: number | null;
  rating?: number | null;
  charger_type?: string | null; // "fast" | "unknown"
  amenities?: string[] | null;
  estimated_soc_gain?: number | null;
  availability_confirmed?: boolean | null;
  lat?: number | null;
  lng?: number | null;
};

/** Full response of POST /chargers/recommend. */
export type ChargerRecommendation = {
  recommended_charger: ChargerOption | null;
  reason: string;
  alternatives: ChargerOption[];
  fallback_used: boolean;
};

/** Response of POST /assistant/message. */
export type AssistantReply = {
  intent: string;
  answer: string;
  tools_called: string[];
  confidence: number;
  escalated: boolean;
  fallback_used?: boolean;
};
