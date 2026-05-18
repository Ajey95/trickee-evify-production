export type UserRole = 'trickee_admin' | 'fleet_operator' | 'driver';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  fleet_id?: string;
  driver_id?: string;
  is_active?: boolean;
}

export interface AccessRequest {
  id: string;
  email: string;
  supabase_user_id?: string;
  full_name: string;
  company?: string;
  requested_role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_user_id?: string;
  review_note?: string;
  created_at?: string;
  updated_at?: string;
  reviewed_at?: string;
}

export interface Fleet {
  id: string;
  name: string;
  city: string;
}

export interface Telemetry {
  id: string;
  vehicle_id: string;
  driver_id?: string;
  recorded_at: string;
  soc: number;
  current: number;
  battery_voltage: number;
  speed: number;
  temp_max: number;
  soh: number;
  charge_plug: boolean;
  ignition_on: boolean;
  regen_status: boolean;
  throttle_status: boolean;
  status_tag?: string;
  lat?: number;
  lng?: number;
}

export interface Prediction {
  dynamic_range_km: number;
  predicted_next_soc: number;
  predicted_range_km: number;
  actual_soc: number;
  predicted_delta_soc: number;
  true_next_soc?: number;
  ai_error?: number;
  soh_factor: number;
  thermal_factor: number;
  aggression_factor: number;
  base_range_km?: number;
  window_size?: number;
}

export interface Vehicle {
  id: string;
  fleet_id?: string;
  vehicle_code: string;
  make: string;
  model: string;
  battery_capacity_kwh?: number;
  max_range_km: number;
  is_active?: boolean;
  latest?: Telemetry;
  latest_telemetry?: Telemetry;
  latest_driver?: Driver;
  latest_dynamic_range_km?: number;
  latest_prediction?: Prediction;
}

export interface Driver {
  id: string;
  fleet_id?: string;
  driver_code: string;
  full_name: string;
  style_label: 'Aggressive' | 'Smooth' | 'Efficient' | 'Cautious' | 'Moderate';
  personal_factor: number;
  avg_regen_ratio: number;
  avg_throttle_variance: number;
  avg_current_30m: number;
  avg_speed_30m: number;
  current_vehicle?: string;
  trips_this_week?: number;
  kwh_used_this_week?: number;
  efficiency_rank?: number;
  efficiency_vs_fleet_pct?: number;
  trickee_points?: number;
}

export interface Route {
  rank: number;
  route_id: string;
  route_name: string;
  distance_km: number;
  avg_speed_kmh: number;
  google_eta_min: number;
  personalized_eta_min: number;
  ev_kwh_used: number;
  soc_end_pct: number;
  range_remaining_km: number;
  composite_score: number;
  is_ev_optimal: boolean;
  is_feasible?: boolean;
  feasibility_reason?: string;
  soc_required_pct?: number;
  destination_charge_plan?: {
    needed: boolean;
    current_soc_pct: number;
    destination_soc_required_pct: number;
    buffer_pct: number;
    target_soc_pct: number;
    top_up_soc_pct: number;
    charge_minutes: number;
    charger_name?: string;
    message: string;
  };
  charge_minutes_required?: number;
  top_up_soc_required_pct?: number;
  stop_and_go_index: number;
}

export interface Nudge {
  desired_arrival: string;
  recommended_departure: string;
  buffer_min: number;
  traffic_decay_ratio: number;
  alert_level: string;
  message: string;
}

export interface Alert {
  id: string;
  vehicle_id?: string;
  driver_id?: string;
  vehicle_code: string;
  driver_name?: string;
  alert_type: 'low_soc_parked' | 'charging_opportunity' | 'reroute' | 'driver_risk';
  message: string;
  soc_at_alert: number;
  nearest_charger?: string;
  charger_distance_m?: number;
  is_resolved: boolean;
  created_at: string;
}

export interface ModelMetrics {
  model?: {
    name: string;
    ready: boolean;
    seq_len: number;
    feature_count: number;
    feature_columns: string[];
    target: string;
    delta_soc_input: boolean;
  };
  counts?: Record<string, number>;
  roadmap_features?: Record<string, boolean>;
  v5a_candidate?: any;
  model_version?: string;
  mae_soc_units?: number;
  rmse_soc_units?: number;
  accuracy_within_1pct?: number;
  accuracy_within_3pct?: number;
  model_parameters?: number;
  total_predictions_served?: number;
  avg_inference_latency_ms?: number;
  training_vehicles?: number;
  test_vehicles?: number;
  features_used?: number;
}
