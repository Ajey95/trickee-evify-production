import {WS_LIVE_MAP_URL} from '../config';
import {api} from './api';
import type {LiveMapSnapshot} from './types';

type LiveMapMessage =
  | {type: 'live_map'; data: LiveMapSnapshot}
  | {type: string; data?: unknown};

type Options = {
  token: string;
  driverId?: string | null;
  onSnapshot: (snapshot: LiveMapSnapshot) => void;
  onError?: (error: unknown) => void;
};

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentKey: string | null = null;
let stopped = true;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function liveMapUrl(ticket: string, driverId?: string | null) {
  const parts = [`ticket=${encodeURIComponent(ticket)}`];
  if (driverId) {
    parts.push(`driver_id=${encodeURIComponent(driverId)}`);
  }
  return `${WS_LIVE_MAP_URL}?${parts.join('&')}`;
}

function isLiveMapSnapshot(value: unknown): value is LiveMapSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as LiveMapSnapshot).vehicle_points)
  );
}

function closeSocket() {
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

async function connect(options: Options) {
  const key = `${options.token}:${options.driverId || ''}`;
  if (!stopped && currentKey === key && socket) {
    return;
  }

  stopped = false;
  currentKey = key;
  clearReconnectTimer();
  closeSocket();

  try {
    const {ticket} = await api.wsTicket(options.token);
    if (stopped || currentKey !== key) {
      return;
    }

    socket = new WebSocket(liveMapUrl(ticket, options.driverId));
    socket.onmessage = event => {
      try {
        const parsed = JSON.parse(String(event.data)) as LiveMapMessage;
        if (parsed.type === 'live_map' && isLiveMapSnapshot(parsed.data)) {
          options.onSnapshot(parsed.data);
        }
      } catch (err) {
        options.onError?.(err);
      }
    };
    socket.onerror = event => {
      options.onError?.(event);
    };
    socket.onclose = () => {
      socket = null;
      if (!stopped && currentKey === key) {
        reconnectTimer = setTimeout(() => connect(options), 10000);
      }
    };
  } catch (err) {
    options.onError?.(err);
    if (!stopped && currentKey === key) {
      reconnectTimer = setTimeout(() => connect(options), 30000);
    }
  }
}

export function startLiveMapSocket(options: Options) {
  connect(options);
}

export function stopLiveMapSocket() {
  stopped = true;
  currentKey = null;
  clearReconnectTimer();
  closeSocket();
}
