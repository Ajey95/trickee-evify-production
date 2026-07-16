import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {api, type MobileLocationPayload} from './api';
import {enqueueLocation} from './offlineQueue';
import type {MobileMe, TrackingState} from './types';

type LocationSnapshot = {
  lat: number;
  lng: number;
  accuracy_m?: number;
  speed_mps?: number;
  heading_deg?: number;
};

let deniedThisSession = false;
let preciseLocationGranted = false;

export function trackingStateFor(me: MobileMe): TrackingState {
  if (me.active_charging) {
    return 'charging';
  }
  if (me.active_waiting) {
    return 'waiting';
  }
  if (me.active_trip) {
    return 'trip_active';
  }
  return 'ready';
}

export async function ensureForegroundLocationPermission() {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (deniedThisSession) {
    return false;
  }

  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  const [fineAlreadyGranted, coarseAlreadyGranted] = await Promise.all([
    PermissionsAndroid.check(fine),
    PermissionsAndroid.check(coarse),
  ]);
  preciseLocationGranted = fineAlreadyGranted;
  if (fineAlreadyGranted || coarseAlreadyGranted) {
    return true;
  }

  const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
  const granted =
    result[fine] === PermissionsAndroid.RESULTS.GRANTED ||
    result[coarse] === PermissionsAndroid.RESULTS.GRANTED;
  preciseLocationGranted = result[fine] === PermissionsAndroid.RESULTS.GRANTED;
  deniedThisSession = !granted;
  return granted;
}

export function getCurrentLocation(): Promise<LocationSnapshot> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        const {coords} = position;
        resolve({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy_m: coords.accuracy,
          speed_mps: coords.speed ?? undefined,
          heading_deg: coords.heading ?? undefined,
        });
      },
      reject,
      {
        enableHighAccuracy: preciseLocationGranted,
        accuracy: {
          android: preciseLocationGranted ? 'high' : 'balanced',
        },
        showLocationDialog: true,
        forceRequestLocation: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  });
}

export function locationPayloadFor(
  location: LocationSnapshot,
  me: MobileMe,
  idPrefix = 'loc',
): MobileLocationPayload {
  return {
    ...location,
    captured_at: new Date().toISOString(),
    battery_pct:
      me.latest_telemetry?.soc ?? me.vehicle?.latest?.soc ?? undefined,
    tracking_state: trackingStateFor(me),
    vehicle_id: me.vehicle?.id ?? me.active_trip?.vehicle_id ?? undefined,
    idempotency_key: `${idPrefix}-${Date.now()}`,
  };
}

export async function postOrQueueLocation(
  token: string,
  payload: MobileLocationPayload,
) {
  try {
    return await api.postLocation(token, payload);
  } catch (err) {
    await enqueueLocation(payload);
    throw err;
  }
}

export async function postForegroundLocation(token: string, me: MobileMe) {
  const allowed = await ensureForegroundLocationPermission();
  if (!allowed) {
    return null;
  }

  const location = await getCurrentLocation();
  return postOrQueueLocation(token, locationPayloadFor(location, me));
}
