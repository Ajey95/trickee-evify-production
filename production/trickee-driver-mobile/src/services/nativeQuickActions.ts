import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export type NativeQuickAction = 'sos' | 'copilot' | 'trip' | 'charging';

type TrickeeActionNativeModule = {
  startQuickAccessNotification: () => void;
  stopQuickAccessNotification: () => void;
  consumePendingAction: () => Promise<NativeQuickAction | null>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

const nativeModule =
  Platform.OS === 'android'
    ? (NativeModules.TrickeeActionModule as
        | TrickeeActionNativeModule
        | undefined)
    : undefined;

const emitter = nativeModule ? new NativeEventEmitter(nativeModule) : null;

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

export async function startNativeQuickAccessNotification() {
  if (!(await ensureNotificationPermission())) {
    return;
  }
  nativeModule?.startQuickAccessNotification();
}

export function stopNativeQuickAccessNotification() {
  nativeModule?.stopQuickAccessNotification();
}

export async function consumePendingNativeQuickAction() {
  return nativeModule?.consumePendingAction() ?? null;
}

export function subscribeNativeQuickActions(
  handler: (action: NativeQuickAction) => void,
): EmitterSubscription | {remove: () => void} {
  if (!emitter) {
    return {remove: () => undefined};
  }
  return emitter.addListener('quickAction', handler);
}
