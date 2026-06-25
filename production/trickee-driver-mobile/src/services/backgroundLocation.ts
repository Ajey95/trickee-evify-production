import {PermissionsAndroid, Platform} from 'react-native';
import BackgroundGeolocation, {
  type Config,
  type Location,
  type Subscription,
} from 'react-native-background-geolocation';
import {
  BACKGROUND_LOCATION_DISTANCE_FILTER_M,
  Features,
  LOCATION_PING_INTERVAL_MS,
} from '../config';
import {flushLocationQueue} from './offlineQueue';
import {
  ensureForegroundLocationPermission,
  postOrQueueLocation,
  trackingStateFor,
} from './mobileLocation';
import type {MobileMe} from './types';

let locationSub: Subscription | null = null;
let connectivitySub: Subscription | null = null;
let enabledSub: Subscription | null = null;
let configured = false;
let latestToken: string | null = null;
let latestMe: MobileMe | null = null;
let backgroundDeniedThisSession = false;

async function ensureNotificationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return true;
  }
  return (
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

async function ensureBackgroundLocationPermission() {
  if (
    Platform.OS !== 'android' ||
    Number(Platform.Version) < 29 ||
    backgroundDeniedThisSession
  ) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return true;
  }

  const granted =
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED;
  backgroundDeniedThisSession = !granted;
  return granted;
}

function payloadFromBackgroundLocation(location: Location, me: MobileMe) {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    captured_at:
      typeof location.timestamp === 'number'
        ? new Date(location.timestamp).toISOString()
        : location.timestamp || new Date().toISOString(),
    accuracy_m: location.coords.accuracy,
    speed_mps: location.coords.speed ?? undefined,
    heading_deg: location.coords.heading ?? undefined,
    battery_pct:
      me.latest_telemetry?.soc ?? me.vehicle?.latest?.soc ?? undefined,
    tracking_state: trackingStateFor(me),
    vehicle_id: me.vehicle?.id ?? me.active_trip?.vehicle_id ?? undefined,
    idempotency_key: `bg-loc-${Date.now()}-${Math.round(
      location.coords.latitude * 100000,
    )}-${Math.round(location.coords.longitude * 100000)}`,
  };
}

function configureSubscriptions() {
  locationSub?.remove();
  connectivitySub?.remove();
  enabledSub?.remove();

  locationSub = BackgroundGeolocation.onLocation(
    location => {
      if (!latestToken || !latestMe) {
        return;
      }
      postOrQueueLocation(
        latestToken,
        payloadFromBackgroundLocation(location, latestMe),
      )
        .then(() => flushLocationQueue(latestToken!))
        .catch(err => {
          console.warn(
            'Background location queued',
            err instanceof Error ? err.message : err,
          );
        });
    },
    err => {
      console.warn('Background location error', err);
    },
  );

  connectivitySub = BackgroundGeolocation.onConnectivityChange(event => {
    if (event.connected && latestToken) {
      flushLocationQueue(latestToken).catch(err => {
        console.warn(
          'Location queue flush failed',
          err instanceof Error ? err.message : err,
        );
      });
    }
  });

  enabledSub = BackgroundGeolocation.onEnabledChange(enabled => {
    if (enabled && latestToken) {
      flushLocationQueue(latestToken).catch(() => undefined);
    }
  });
}

async function configureBackgroundGeolocation() {
  if (configured) {
    return;
  }

  configureSubscriptions();
  const config: Config = {
    logger: {
      logLevel: BackgroundGeolocation.LogLevel.Warning,
    },
    geolocation: {
      desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
      distanceFilter: BACKGROUND_LOCATION_DISTANCE_FILTER_M,
      locationUpdateInterval: LOCATION_PING_INTERVAL_MS,
    },
    app: {
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: false,
      notification: {
        title: 'Trickee ride tracking',
        text: 'Location is active during your trip.',
        channelName: 'Trickee driver tracking',
      },
    },
    persistence: {
      persistMode: BackgroundGeolocation.PersistMode.All,
      maxDaysToPersist: 3,
    },
    activity: {
      disableStopDetection: false,
    },
  };

  await BackgroundGeolocation.ready(config);
  configured = true;
}

export async function startBackgroundLocation(token: string, me: MobileMe) {
  if (!Features.backgroundLocationTracking) {
    return false;
  }

  latestToken = token;
  latestMe = me;

  const foregroundAllowed = await ensureForegroundLocationPermission();
  const backgroundAllowed = await ensureBackgroundLocationPermission();
  await ensureNotificationPermission();

  if (!foregroundAllowed || !backgroundAllowed) {
    return false;
  }

  await configureBackgroundGeolocation();
  const state = await BackgroundGeolocation.getState();
  if (!state.enabled) {
    await BackgroundGeolocation.start();
  }
  await flushLocationQueue(token);
  return true;
}

export async function stopBackgroundLocation() {
  latestToken = null;
  latestMe = null;
  try {
    if (configured) {
      await BackgroundGeolocation.stop();
    }
  } catch {
    // Native service may not be available in test/runtime shells.
  }
}
