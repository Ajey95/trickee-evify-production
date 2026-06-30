import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {AppState} from 'react-native';
import {LIVE_POLL_INTERVAL_MS} from '../config';
import {api, ApiError} from '../services/api';
import type {
  Alert,
  Driver,
  MobileMe,
  Telemetry,
  Vehicle,
} from '../services/types';
import {useAuth} from './AuthContext';
import {useInterval} from '../hooks/useInterval';

type LiveDataValue = {
  me: MobileMe | null;
  alerts: Alert[];
  /** True only during the very first load (drives full-screen spinners). */
  loading: boolean;
  /** True during a user-triggered pull-to-refresh. */
  refreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
  ackAlert: (alertId: string) => Promise<void>;
  // Convenience selectors derived from `me`.
  telemetry: Telemetry | null;
  vehicle: Vehicle | null;
  driver: Driver | null;
};

const LiveDataContext = createContext<LiveDataValue | undefined>(undefined);

export const LiveDataProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const {token, logout, setUser} = useAuth();
  const [me, setMe] = useState<MobileMe | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const appActive = useRef(true);
  const inFlight = useRef<AbortController | null>(null);

  const meRef = useRef<MobileMe | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'poll') => {
      if (!token) {
        return;
      }
      if (mode === 'poll' && inFlight.current) {
        return;
      }
      const controller = new AbortController();
      inFlight.current = controller;
      if (mode === 'refresh') {
        setRefreshing(true);
      }
      try {
        let meResult: MobileMe;
        let alertsResult: Alert[];

        if (token === 'mock-session-token') {
          // Provide mock data for demo when backend is offline
          meResult = {
            user: {
              id: 'mock-user-id',
              email: 'driver1@evify.in',
              full_name: 'Ravi Kumar',
              role: 'driver',
            },
            driver: {
              id: 'mock-driver-id',
              driver_code: 'DRV-001',
              full_name: 'Ravi Kumar',
              style_label: 'Efficient',
            },
            vehicle: {
              id: 'mock-vehicle-id',
              vehicle_code: 'EV-X1',
              make: 'EVIFY',
              model: 'Cargo E3',
              battery_capacity_kwh: 15,
              max_range_km: 120,
              latest_dynamic_range_km: 84.5,
            },
            latest_telemetry: {
              id: 'mock-tel-id',
              soc: 72.4,
              speed: 0,
              recorded_at: new Date().toISOString(),
            },
            active_trip: null,
            active_waiting: null,
            active_charging: null,
          };
          alertsResult = [];
        } else {
          const results = await Promise.all([
            api.mobileMe(token, controller.signal),
            api
              .mobileAlerts(token, {limit: 50}, controller.signal)
              .catch(() => [] as Alert[]),
          ]);
          meResult = results[0];
          alertsResult = results[1];
        }

        meRef.current = meResult;
        setMe(meResult);
        setAlerts(alertsResult);

        if (meResult.user) {
          setUser(meResult.user);
        }
        setError(null);
        setLastUpdated(Date.now());
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        if (err instanceof ApiError && err.isAuth) {
          await logout();
          return;
        }
        if (mode !== 'poll' || meRef.current === null) {
          setError(
            err instanceof ApiError ? err.message : 'Could not load live data.',
          );
        }
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
        }
        setLoading(false);
        if (mode === 'refresh') {
          setRefreshing(false);
        }
      }
    },
    [token, logout, setUser], // Removed 'me' to prevent function recreation on every poll
  );

  // Initial load whenever a token becomes available.
  useEffect(() => {
    if (token) {
      setLoading(true);
      load('initial');
    } else {
      setMe(null);
      setAlerts([]);
      setLoading(false);
    }
    return () => {
      inFlight.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Pause polling when the app is backgrounded to save battery/data.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      const wasActive = appActive.current;
      appActive.current = state === 'active';
      if (!wasActive && appActive.current && token) {
        load('poll');
      }
    });
    return () => sub.remove();
  }, [token, load]);

  useInterval(
    () => {
      if (appActive.current && token) {
        load('poll');
      }
    },
    token ? LIVE_POLL_INTERVAL_MS : null,
  );

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  const ackAlert = useCallback(
    async (alertId: string) => {
      if (!token) {
        return;
      }
      // Optimistic removal; reconcile on next poll.
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      try {
        await api.ackAlert(token, alertId);
      } catch {
        // Re-sync if the ack failed.
        load('poll');
      }
    },
    [token, load],
  );

  const value = useMemo<LiveDataValue>(
    () => ({
      me,
      alerts,
      loading,
      refreshing,
      error,
      lastUpdated,
      refresh,
      ackAlert,
      telemetry: me?.latest_telemetry ?? me?.vehicle?.latest ?? null,
      vehicle: me?.vehicle ?? null,
      driver: me?.driver ?? null,
    }),
    [me, alerts, loading, refreshing, error, lastUpdated, refresh, ackAlert],
  );

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  );
};

export function useLiveData() {
  const value = useContext(LiveDataContext);
  if (!value) {
    throw new Error('useLiveData must be used inside LiveDataProvider');
  }
  return value;
}
