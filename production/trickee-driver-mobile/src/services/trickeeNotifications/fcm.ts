import messaging from '@react-native-firebase/messaging';
import {PermissionsAndroid, Platform} from 'react-native';

import {trickeeApi} from '../trickeeApi/client';

export async function ensureNotificationPermission() {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return status === PermissionsAndroid.RESULTS.GRANTED;
  }
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function registerFcmToken() {
  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    return {registered: false};
  }
  const token = await messaging().getToken();
  const result = await trickeeApi.registerFcmToken(token);
  return {registered: result.success, token};
}
