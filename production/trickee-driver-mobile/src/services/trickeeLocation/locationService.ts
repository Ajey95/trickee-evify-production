import {Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import BackgroundGeolocation from 'react-native-background-geolocation';
import {check, PERMISSIONS, request, RESULTS} from 'react-native-permissions';

import {env} from '../../config/env';
import {trickeeApi} from '../trickeeApi/client';
import {enqueueEvent} from '../trickeeStorage/offlineQueue';
import type {LocationPoint, MobileState} from '../../features/trickee-driver/types';

function androidPermission() {
  return Number(Platform.Version) >= 29 ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
}

export async function ensureLocationPermission() {
  const permission = Platform.OS === 'android' ? androidPermission() : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
  const current = await check(permission);
  if (current === RESULTS.GRANTED) {
    return true;
  }
  return (await request(permission)) === RESULTS.GRANTED;
}

export async function ensureBackgroundLocationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 29) {
    return true;
  }
  const current = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
  if (current === RESULTS.GRANTED) {
    return true;
  }
  return (await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION)) === RESULTS.GRANTED;
}

export function getCurrentLocation(): Promise<LocationPoint> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          speed_mps: position.coords.speed ?? undefined,
          heading_deg: position.coords.heading ?? undefined,
          captured_at: new Date(position.timestamp).toISOString(),
        }),
      reject,
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 5000},
    );
  });
}

export async function sendLocationPing(state: MobileState, battery_pct?: number) {
  const location = await getCurrentLocation();
  const body = {
    ...location,
    captured_at: location.captured_at || new Date().toISOString(),
    tracking_state: state === 'listening' ? 'ready' : state,
    battery_pct,
    idempotency_key: `loc-${Date.now()}`,
  };
  const result = await trickeeApi.recordLocation(body);
  if (!result.success) {
    await enqueueEvent('/mobile/location', body);
  }
  return result;
}

export async function startTripTracking() {
  await BackgroundGeolocation.ready({
    geolocation: {
      desiredAccuracy: -1,
      distanceFilter: 50,
      locationUpdateInterval: env.locationIntervalMs,
    },
    app: {
      stopOnTerminate: false,
      startOnBoot: true,
      notification: {
        title: 'Trickee ride tracking',
        text: 'Location is active during your trip.',
      },
    },
  });
  await BackgroundGeolocation.start();
}

export async function stopTripTracking() {
  await BackgroundGeolocation.stop();
}
