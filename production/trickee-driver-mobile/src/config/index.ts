import {Platform} from 'react-native';

/**
 * Central app configuration — the single swap point for environment values.
 *
 * Why a TS module instead of a `.env` file?
 * React Native does not read `.env` files at runtime without a native module
 * (e.g. react-native-config), which requires a native rebuild. Keeping config
 * here means: (1) no extra native dependency, (2) one obvious place to change
 * when pointing the app at a real backend, (3) type-safe access everywhere.
 *
 * To move from the local pilot backend to a hosted one, change ONLY
 * `HOSTED_API_ORIGIN` and flip `USE_HOSTED_BACKEND` to true (or wire these
 * to your CI/build environment). Nothing else in the app should hardcode a URL.
 */

// ---- Backend host -----------------------------------------------------------

/** Hosted backend origin (Render / Railway / your domain). No trailing slash. */
const HOSTED_API_ORIGIN = 'https://trickee-backend.onrender.com';

/**
 * Flip to true once you have a deployed backend URL. When false, the app talks
 * to a backend running on the developer machine (Android emulator → 10.0.2.2,
 * iOS simulator / web → 127.0.0.1).
 */
const USE_HOSTED_BACKEND = false;

/** Local backend origin, resolved per-platform for emulators/simulators. */
const LOCAL_API_ORIGIN =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

/** The active backend origin (scheme + host + port), no path, no trailing slash. */
export const API_ORIGIN = USE_HOSTED_BACKEND
  ? HOSTED_API_ORIGIN
  : LOCAL_API_ORIGIN;

/** REST base URL — all HTTP routes live under /api/v1. */
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

/** WebSocket origin derived from the API origin (http→ws, https→wss). */
export const WS_ORIGIN = API_ORIGIN.replace(/^http(s?):\/\//, (_m, s) =>
  s ? 'wss://' : 'ws://',
);

/** Live-map WebSocket endpoint (no /api/v1 prefix — see backend ws router). */
export const WS_LIVE_MAP_URL = `${WS_ORIGIN}/ws/live-map`;

// ---- Networking -------------------------------------------------------------

/** Per-request network timeout in milliseconds. */
export const REQUEST_TIMEOUT_MS = 15000;

/** How often live screens poll /mobile/me + /mobile/alerts (ms). */
export const LIVE_POLL_INTERVAL_MS = 15000;

/** Minimum interval between foreground mobile GPS pings (ms). */
export const LOCATION_PING_INTERVAL_MS = 60000;

/** Minimum movement before native background tracking emits a point (meters). */
export const BACKGROUND_LOCATION_DISTANCE_FILTER_M = 50;

// ---- Map / geo defaults -----------------------------------------------------

/**
 * Fallback map center used only when no telemetry/GPS is available yet.
 * Surat, India — the pilot fleet's operating city.
 */
export const DEFAULT_MAP_CENTER = {latitude: 21.1702, longitude: 72.8311};

// ---- Feature flags ----------------------------------------------------------

export const Features = {
  /**
   * Legacy email/password login. The pilot backend enables this
   * (LEGACY_AUTH_ENABLED=true in local/dev mode). Set false once Firebase or
   * Supabase auth is wired on the client.
   */
  passwordLogin: true,
  /**
   * Try the live-map WebSocket for realtime updates, falling back to polling.
   * The backend ws endpoint requires a redis-backed live state in production;
   * polling always works, so this is opt-in.
   */
  liveWebSocket: true,
  /** Show driver self-service actions (start trip, charging, waiting, SOS). */
  driverActions: true,
  /** Send foreground Android GPS pings to POST /mobile/location. */
  foregroundLocationPings: true,
  /** Enable native background GPS tracking and offline location retry queue. */
  backgroundLocationTracking: true,
  /**
   * Allows the old demo-only in-memory session when the backend is unreachable.
   * Keep false for real backend integration so connection/auth failures surface
   * to the driver instead of showing fake live data.
   */
  mockBackendFallback: false,
};

// ---- Demo credentials (local pilot only) ------------------------------------

/**
 * Convenience demo logins, shown on the sign-in screen ONLY for the local
 * backend. These are seeded demo accounts, not secrets, and are never shown
 * when pointing at a hosted backend.
 *
 * Only driver accounts are listed: this is the driver mobile app, and the
 * backend's /mobile/me rejects non-driver tokens with 403 (which would bounce
 * a fleet/admin user straight back to the sign-in screen).
 */
export const DEMO_LOGINS = USE_HOSTED_BACKEND
  ? []
  : [
      {
        label: 'Driver (Ravi)',
        email: 'driver1@evify.in',
        password: 'Driver@2026',
      },
      {
        label: 'Driver (Priya)',
        email: 'driver2@evify.in',
        password: 'Driver@2026',
      },
    ];

export const SHOW_DEMO_LOGINS = !USE_HOSTED_BACKEND;
