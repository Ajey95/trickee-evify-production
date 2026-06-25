import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {api, ApiError, type MobileLocationPayload} from './api';

const LOCATION_QUEUE_KEY = 'trickee.mobile.location.queue.v1';
const MAX_QUEUE_ITEMS = 500;
const MAX_ATTEMPTS = 8;

type QueuedLocation = {
  id: string;
  payload: MobileLocationPayload;
  createdAt: string;
  attempts: number;
};

async function readLocationQueue(): Promise<QueuedLocation[]> {
  const raw = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as QueuedLocation[];
  } catch {
    await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
    return [];
  }
}

async function writeLocationQueue(queue: QueuedLocation[]) {
  await AsyncStorage.setItem(
    LOCATION_QUEUE_KEY,
    JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS)),
  );
}

export async function enqueueLocation(payload: MobileLocationPayload) {
  const queue = await readLocationQueue();
  queue.push({
    id: payload.idempotency_key || `${Date.now()}-${Math.random()}`,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await writeLocationQueue(queue);
}

export async function queuedLocationCount() {
  return (await readLocationQueue()).length;
}

export async function flushLocationQueue(token: string) {
  const network = await NetInfo.fetch();
  const queue = await readLocationQueue();
  if (!network.isConnected || !queue.length) {
    return {flushed: 0, remaining: queue.length};
  }

  const remaining: QueuedLocation[] = [];
  let flushed = 0;
  let authBlocked = false;

  for (const item of queue) {
    if (authBlocked) {
      remaining.push(item);
      continue;
    }

    try {
      await api.postLocation(token, item.payload);
      flushed += 1;
    } catch (err) {
      if (err instanceof ApiError && err.isAuth) {
        authBlocked = true;
        remaining.push(item);
      } else if (item.attempts + 1 < MAX_ATTEMPTS) {
        remaining.push({...item, attempts: item.attempts + 1});
      }
    }
  }

  await writeLocationQueue(remaining);
  return {flushed, remaining: remaining.length};
}
