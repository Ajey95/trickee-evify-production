import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import {env} from '../../config/env';
import {getAccessToken} from '../trickeeAuth/supabaseClient';
import type {QueuedEvent} from '../../features/trickee-driver/types';

const QUEUE_KEY = 'trickee.offline.queue.v1';

async function readQueue(): Promise<QueuedEvent[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: QueuedEvent[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-500)));
}

export async function enqueueEvent(endpoint: string, body: unknown) {
  const queue = await readQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    endpoint,
    method: 'POST',
    body,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await writeQueue(queue);
}

export async function flushOfflineQueue() {
  const network = await NetInfo.fetch();
  if (!network.isConnected) {
    return {flushed: 0, remaining: (await readQueue()).length};
  }
  const token = await getAccessToken();
  const queue = await readQueue();
  const remaining: QueuedEvent[] = [];
  let flushed = 0;

  for (const event of queue) {
    try {
      const response = await fetch(`${env.backendUrl}${event.endpoint}`, {
        method: event.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? {Authorization: `Bearer ${token}`} : {}),
        },
        body: JSON.stringify(event.body),
      });
      if (response.ok) {
        flushed += 1;
      } else if (event.attempts < 8) {
        remaining.push({...event, attempts: event.attempts + 1});
      }
    } catch {
      remaining.push({...event, attempts: event.attempts + 1});
    }
  }

  await writeQueue(remaining);
  return {flushed, remaining: remaining.length};
}
