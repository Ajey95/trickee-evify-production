/**
 * Trickee API client.
 *
 * One typed surface over the FastAPI backend. Every call unwraps the standard
 * `{success, data, message, error}` envelope and throws a typed {@link ApiError}
 * on transport failure, timeout, non-2xx status, or `success: false`.
 *
 * The base URL comes from src/config — never hardcode a URL here.
 */
import {API_BASE_URL, REQUEST_TIMEOUT_MS} from '../config';
import type {
  Alert,
  ApiResponse,
  AssistantReply,
  ChargerRecommendation,
  IssueType,
  LoginResponse,
  MobileChargingSession,
  MobileIssueEvent,
  MobileLocationPoint,
  MobileMe,
  MobileTripSession,
  MobileWaitEvent,
  TrackingState,
  Trip,
  User,
} from './types';

/** Error thrown by every client method. `status` is 0 for network/timeout. */
export class ApiError extends Error {
  status: number;
  isNetwork: boolean;
  isAuth: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetwork = status === 0;
    this.isAuth = status === 401 || status === 403;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Query params; undefined/null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  let url = `${API_BASE_URL}${path}`;
  if (query) {
    const parts = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      );
    if (parts.length) {
      url += `?${parts.join('&')}`;
    }
  }
  return url;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {method = 'GET', body, token, query, signal} = options;

  // Timeout via AbortController, merged with any caller-supplied signal.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort);
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    throw new ApiError(
      aborted
        ? 'Request timed out. Check your connection and that the backend is running.'
        : 'Network error. Is the backend reachable?',
      0,
    );
  } finally {
    clearTimeout(timeout);
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
  }

  let envelope: ApiResponse<T> | null = null;
  try {
    envelope = (await response.json()) as ApiResponse<T>;
  } catch {
    envelope = null;
  }

  if (!response.ok || !envelope || !envelope.success) {
    const message =
      envelope?.error ||
      envelope?.message ||
      `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return envelope.data;
}

// ---- API surface ------------------------------------------------------------

export const api = {
  // -- Auth --
  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: {email: email.trim().toLowerCase(), password},
    });
  },

  me(token: string, signal?: AbortSignal) {
    return request<User>('/auth/me', {token, signal});
  },

  logout(token: string) {
    return request<{logged_out: boolean}>('/auth/logout', {
      method: 'POST',
      token,
    });
  },

  accessRequest(payload: {
    email: string;
    full_name: string;
    company?: string;
    requested_role?: 'driver' | 'fleet_operator' | 'trickee_admin';
    requested_vehicle_id?: string;
  }) {
    return request<{status: string}>('/auth/access-request', {
      method: 'POST',
      body: payload,
    });
  },

  wsTicket(token: string) {
    return request<{ticket: string; expires_in_seconds: number}>(
      '/auth/ws-ticket',
      {token},
    );
  },

  registerFcmToken(
    token: string,
    fcmToken: string,
    platform: 'android' | 'ios' | 'web' = 'android',
    deviceLabel?: string,
  ) {
    return request<unknown>('/auth/fcm-token', {
      method: 'POST',
      token,
      body: {token: fcmToken, platform, device_label: deviceLabel},
    });
  },

  // -- Driver (mobile) --
  mobileMe(token: string, signal?: AbortSignal) {
    return request<MobileMe>('/mobile/me', {token, signal});
  },

  mobileAlerts(
    token: string,
    opts: {unresolvedOnly?: boolean; limit?: number} = {},
    signal?: AbortSignal,
  ) {
    return request<Alert[]>('/mobile/alerts', {
      token,
      signal,
      query: {unresolved_only: opts.unresolvedOnly, limit: opts.limit},
    });
  },

  ackAlert(token: string, alertId: string) {
    return request<Alert>(`/mobile/alerts/${alertId}/ack`, {
      method: 'POST',
      token,
    });
  },

  postLocation(
    token: string,
    payload: {
      lat: number;
      lng: number;
      accuracy_m?: number;
      speed_mps?: number;
      heading_deg?: number;
      battery_pct?: number;
      tracking_state?: TrackingState;
      vehicle_id?: string;
      idempotency_key?: string;
    },
  ) {
    return request<MobileLocationPoint>('/mobile/location', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  startTrip(
    token: string,
    payload: {
      destination_text?: string;
      destination_lat?: number;
      destination_lng?: number;
      origin?: {lat: number; lng: number};
      vehicle_id?: string;
      idempotency_key?: string;
    } = {},
  ) {
    return request<MobileTripSession>('/mobile/trips/start', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  endTrip(
    token: string,
    payload: {
      trip_session_id?: string;
      location?: {lat: number; lng: number};
      idempotency_key?: string;
    } = {},
  ) {
    return request<MobileTripSession>('/mobile/trips/end', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  startCharging(
    token: string,
    payload: {
      trip_session_id?: string;
      location?: {lat: number; lng: number};
      vehicle_id?: string;
      charger_name?: string;
      soc_start?: number;
      idempotency_key?: string;
    } = {},
  ) {
    return request<MobileChargingSession>('/mobile/charging/start', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  endCharging(
    token: string,
    payload: {
      charging_session_id?: string;
      soc_end?: number;
      idempotency_key?: string;
    } = {},
  ) {
    return request<MobileChargingSession>('/mobile/charging/end', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  startWaiting(
    token: string,
    payload: {
      trip_session_id?: string;
      location?: {lat: number; lng: number};
      vehicle_id?: string;
      wait_type?: string;
      idempotency_key?: string;
    } = {},
  ) {
    return request<MobileWaitEvent>('/mobile/waiting/start', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  endWaiting(
    token: string,
    payload: {wait_event_id?: string; idempotency_key?: string} = {},
  ) {
    return request<MobileWaitEvent>('/mobile/waiting/end', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  reportIssue(
    token: string,
    payload: {
      issue_type: IssueType;
      message?: string;
      location?: {lat: number; lng: number};
      vehicle_id?: string;
      trip_session_id?: string;
      idempotency_key?: string;
    },
  ) {
    return request<MobileIssueEvent>('/mobile/issues', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  // -- Intelligence --
  recommendChargers(
    token: string,
    payload: {
      driver_id: string;
      vehicle_id: string;
      lat: number;
      lng: number;
      soc: number;
      destination_km: number;
      available_time_min: number;
    },
    signal?: AbortSignal,
  ) {
    return request<ChargerRecommendation>('/chargers/recommend', {
      method: 'POST',
      token,
      body: payload,
      signal,
    });
  },

  driverTrips(
    token: string,
    driverId: string,
    limit = 50,
    signal?: AbortSignal,
  ) {
    return request<Trip[]>(`/drivers/${driverId}/trips`, {
      token,
      query: {limit},
      signal,
    });
  },

  driverProfile(token: string, driverId: string, signal?: AbortSignal) {
    return request<Record<string, unknown>>(`/drivers/${driverId}/profile`, {
      token,
      signal,
    });
  },

  assistantMessage(
    token: string,
    payload: {
      driver_id: string;
      vehicle_id: string;
      message: string;
      channel?: 'app' | 'whatsapp';
      location?: {lat: number; lng: number};
    },
  ) {
    return request<AssistantReply>('/assistant/message', {
      method: 'POST',
      token,
      body: payload,
    });
  },
};
