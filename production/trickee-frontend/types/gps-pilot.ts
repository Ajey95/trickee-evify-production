export type GpsPilotServiceStatus = "healthy" | "attention" | "degraded";

export interface GpsPilotSummary {
  active_trips: number;
  recent_windows: number;
  gps_gaps: number;
  gps_availability_pct: number | null;
  recent_rejections: number;
  pending_outbox: number;
  stuck_finalizations: number;
  oldest_outbox_age_seconds: number | null;
}

export interface GpsPilotLiveVehicle {
  vehicle_id: string;
  vehicle_code: string;
  trip_id: string | null;
  freshness: string;
  projection_status: string;
  sequence_no: number;
  last_packet_at: string | null;
  last_packet_age_seconds: number | null;
  gps_available: boolean;
  latitude: number | null;
  longitude: number | null;
  collector_state: string | null;
  local_outbox_pending: number | null;
}

export interface GpsPilotTrip {
  trip_id: string;
  vehicle_id: string;
  vehicle_code: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  finalization_state: string;
  final_sequence_no: number | null;
  stored_windows: number;
  gps_windows: number;
  gps_availability_pct: number | null;
  stored_gps_pct: number | null;
  end_to_end_gps_pct: number | null;
  upload_completeness_pct: number | null;
  highest_contiguous_sequence: number;
  highest_received_sequence: number;
  actual_missing_sequences: number | null;
  missing_ranges: number[][] | null;
  phone_backlog: number | null;
  phone_backlog_observed_at: string | null;
  uploaded_through: number;
  processed_through: number | null;
  missing_sequences: number | null;
  finalizer_state: string | null;
  training_eligible: boolean | null;
  label_confidence: number | null;
}

export interface GpsPilotRejection {
  received_at: string | null;
  trip_id: string | null;
  sequence_no: number | null;
  code: string;
  message: string;
}

export interface GpsPilotSnapshot {
  generated_at: string;
  service_status: GpsPilotServiceStatus;
  summary: GpsPilotSummary;
  live_vehicles: GpsPilotLiveVehicle[];
  recent_trips: GpsPilotTrip[];
  recent_rejections: GpsPilotRejection[];
}
