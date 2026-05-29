import {env} from '../../config/env';
import {getAccessToken} from '../trickeeAuth/supabaseClient';
import type {
  ApiResult,
  LocationPoint,
  MobileChargingSession,
  MobileIssueEvent,
  MobileMe,
  MobileTripSession,
  MobileWaitEvent,
} from '../../features/trickee-driver/types';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  const response = await fetch(`${env.backendUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
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
}

function post<T>(endpoint: string, body: unknown) {
  return request<T>(endpoint, {method: 'POST', body: JSON.stringify(body)});
}

export const trickeeApi = {
  mobileMe: () => request<MobileMe>('/mobile/me'),
  recordLocation: (point: LocationPoint & {tracking_state: string; idempotency_key: string; battery_pct?: number}) =>
    post('/mobile/location', point),
  resolveDestination: (transcript: string, currentLocation?: LocationPoint) =>
    post<{
      destination_text: string;
      confidence: number;
      needs_confirmation: boolean;
      map_resolution_status: string;
    }>('/mobile/voice/resolve-destination', {
      transcript,
      current_location: currentLocation ? {lat: currentLocation.lat, lng: currentLocation.lng} : undefined,
    }),
  startTrip: (body: {
    destination_text?: string;
    origin?: {lat: number; lng: number};
    idempotency_key: string;
  }) => post<MobileTripSession>('/mobile/trips/start', body),
  endTrip: (trip_session_id: string, location?: LocationPoint) =>
    post<MobileTripSession>('/mobile/trips/end', {
      trip_session_id,
      location: location ? {lat: location.lat, lng: location.lng} : undefined,
      idempotency_key: `end-trip-${trip_session_id}`,
    }),
  startCharging: (body: {trip_session_id?: string; location?: LocationPoint; soc_start?: number; idempotency_key: string}) =>
    post<MobileChargingSession>('/mobile/charging/start', {
      ...body,
      location: body.location ? {lat: body.location.lat, lng: body.location.lng} : undefined,
    }),
  endCharging: (charging_session_id: string, soc_end?: number) =>
    post<MobileChargingSession>('/mobile/charging/end', {
      charging_session_id,
      soc_end,
      idempotency_key: `end-charging-${charging_session_id}`,
    }),
  startWaiting: (body: {trip_session_id?: string; location?: LocationPoint; wait_type?: string; idempotency_key: string}) =>
    post<MobileWaitEvent>('/mobile/waiting/start', {
      ...body,
      location: body.location ? {lat: body.location.lat, lng: body.location.lng} : undefined,
    }),
  endWaiting: (wait_event_id: string) =>
    post<MobileWaitEvent>('/mobile/waiting/end', {
      wait_event_id,
      idempotency_key: `end-wait-${wait_event_id}`,
    }),
  createIssue: (body: {
    trip_session_id?: string;
    issue_type: string;
    message?: string;
    location?: LocationPoint;
    idempotency_key: string;
  }) =>
    post<MobileIssueEvent>('/mobile/issues', {
      ...body,
      location: body.location ? {lat: body.location.lat, lng: body.location.lng} : undefined,
    }),
  alerts: () => request('/mobile/alerts?unresolved_only=true'),
  ackAlert: (alertId: string) => post(`/mobile/alerts/${alertId}/ack`, {}),
  registerFcmToken: (token: string) =>
    post('/auth/fcm-token', {
      token,
      platform: 'android',
      device_label: 'driver-android',
    }),
};
