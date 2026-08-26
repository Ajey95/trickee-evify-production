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
import {
  Features,
  LIVE_POLL_INTERVAL_MS,
  LOCATION_PING_INTERVAL_MS,
} from '../config';
import {api, ApiError} from '../services/api';
import {
  startBackgroundLocation,
  stopBackgroundLocation,
} from '../services/backgroundLocation';
import {startLiveMapSocket, stopLiveMapSocket} from '../services/liveMapSocket';
import {postForegroundLocation} from '../services/mobileLocation';
import {
  consumePendingNativeQuickAction,
  startNativeQuickAccessNotification,
  stopNativeQuickAccessNotification,
  subscribeNativeQuickActions,
  type NativeQuickAction,
} from '../services/nativeQuickActions';
import type {
  Alert,
  Driver,
  LiveMapSnapshot,
  MobileLocationPoint,
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

const FOREGROUND_LOCATION_FRESH_MS = 90_000;

function isFreshForegroundLocation(location: MobileLocationPoint | null) {
  if (!location) {
    return false;
  }
  const rawTime = location.captured_at ?? location.received_at;
  if (!rawTime) {
    return true;
  }
  const timestamp = Date.parse(rawTime);
  return Number.isFinite(timestamp)
    ? Date.now() - timestamp <= FOREGROUND_LOCATION_FRESH_MS
    : true;
}

function applyForegroundLocation(
  current: MobileMe | null,
  location: MobileLocationPoint | null,
): MobileMe | null {
  if (!current || !isFreshForegroundLocation(location)) {
    return current;
  }
  const previousTelemetry = current.latest_telemetry ?? current.vehicle?.latest;
  const latestTelemetry: Telemetry = {
    ...(previousTelemetry ?? {
      id: `device-${current.driver?.id ?? 'location'}`,
    }),
    driver_id: location!.driver_id ?? previousTelemetry?.driver_id ?? null,
    vehicle_id: location!.vehicle_id ?? previousTelemetry?.vehicle_id ?? null,
    lat: location!.lat,
    lng: location!.lng,
    soc: location!.battery_pct ?? previousTelemetry?.soc ?? null,
    speed:
      location!.speed_mps != null
        ? Math.max(0, location!.speed_mps * 3.6)
        : previousTelemetry?.speed ?? null,
    recorded_at:
      location!.captured_at ?? previousTelemetry?.recorded_at ?? null,
  };
  return {
    ...current,
    latest_telemetry: latestTelemetry,
    vehicle: current.vehicle
      ? {...current.vehicle, latest: latestTelemetry}
      : current.vehicle,
  };
}

function mergeLiveMapSnapshot(
  current: MobileMe | null,
  snapshot: LiveMapSnapshot,
  foregroundLocation: MobileLocationPoint | null = null,
): MobileMe | null {
  if (!current?.driver) {
    return current;
  }

  const point = snapshot.vehicle_points.find(
    row =>
      row.driver_id === current.driver.id ||
      (current.vehicle?.id && row.vehicle_id === current.vehicle.id),
  );
  if (!point) {
    return current;
  }

  const previousTelemetry = current.latest_telemetry ?? current.vehicle?.latest;
  const freshForeground = isFreshForegroundLocation(foregroundLocation);
  const latestTelemetry: Telemetry = {
    ...(previousTelemetry ?? {id: `live-${current.driver.id}`}),
    driver_id: point.driver_id,
    vehicle_id: point.vehicle_id ?? previousTelemetry?.vehicle_id ?? null,
    lat: freshForeground ? foregroundLocation!.lat : point.lat,
    lng: freshForeground ? foregroundLocation!.lng : point.lng,
    soc: point.soc ?? previousTelemetry?.soc ?? null,
    speed:
      freshForeground && foregroundLocation!.speed_mps != null
        ? Math.max(0, foregroundLocation!.speed_mps * 3.6)
        : point.speed ?? previousTelemetry?.speed ?? null,
    recorded_at: freshForeground
      ? foregroundLocation!.captured_at ??
        previousTelemetry?.recorded_at ??
        null
      : point.recorded_at ?? previousTelemetry?.recorded_at ?? null,
  };

  return {
    ...current,
    latest_telemetry: latestTelemetry,
    vehicle: current.vehicle
      ? {...current.vehicle, latest: latestTelemetry}
      : current.vehicle,
  };
}

const nativeActionKey = (action: string) =>
  `native-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function currentLocationFromMe(me: MobileMe | null) {
  const telemetry = me?.latest_telemetry ?? me?.vehicle?.latest ?? null;
  return telemetry?.lat != null && telemetry.lng != null
    ? {lat: telemetry.lat, lng: telemetry.lng}
    : undefined;
}

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
  const lastLocationPingAt = useRef(0);
  const foregroundLocationRef = useRef<MobileLocationPoint | null>(null);

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

        if (Features.mockBackendFallback && token === 'mock-session-token') {
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

        const liveMeResult = applyForegroundLocation(
          meResult,
          foregroundLocationRef.current,
        );
        meRef.current = liveMeResult;
        setMe(liveMeResult);
        setAlerts(alertsResult);

        if (meResult.user) {
          setUser(meResult.user);
        }
        setError(null);
        setLastUpdated(Date.now());

        if (
          Features.foregroundLocationPings &&
          token !== 'mock-session-token' &&
          Date.now() - lastLocationPingAt.current >= LOCATION_PING_INTERVAL_MS
        ) {
          lastLocationPingAt.current = Date.now();
          postForegroundLocation(token, meResult)
            .then(location => {
              if (!location) {
                return;
              }
              foregroundLocationRef.current = location;
              setMe(prev => {
                const next = applyForegroundLocation(prev, location);
                meRef.current = next;
                return next;
              });
            })
            .catch(err => {
              console.warn(
                'Foreground location ping failed',
                err instanceof Error ? err.message : err,
              );
            });
        }

        if (
          Features.backgroundLocationTracking &&
          token !== 'mock-session-token'
        ) {
          startBackgroundLocation(token, meResult).catch(err => {
            console.warn(
              'Background location start failed',
              err instanceof Error ? err.message : err,
            );
          });
        }

        if (Features.liveWebSocket && token !== 'mock-session-token') {
          startLiveMapSocket({
            token,
            driverId: meResult.driver?.id,
            onSnapshot: snapshot => {
              setMe(prev => {
                const next = mergeLiveMapSnapshot(
                  prev,
                  snapshot,
                  foregroundLocationRef.current,
                );
                meRef.current = next;
                return next;
              });
              setLastUpdated(Date.now());
            },
            onError: err => {
              console.warn(
                'Live-map WebSocket unavailable',
                err instanceof Error ? err.message : err,
              );
            },
          });
        }
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

  const runNativeQuickAction = useCallback(
    async (action: NativeQuickAction) => {
      if (!token || token === 'mock-session-token') {
        return;
      }

      const current = meRef.current;
      if (!current?.driver) {
        return;
      }

      const activeTrip = current.active_trip ?? null;
      const activeCharging = current.active_charging ?? null;
      const telemetry = current.latest_telemetry ?? current.vehicle?.latest;
      const location = currentLocationFromMe(current);
      const vehicleId =
        current.vehicle?.id ??
        activeTrip?.vehicle_id ??
        activeCharging?.vehicle_id ??
        undefined;

      try {
        if (action === 'sos') {
          await api.reportIssue(token, {
            issue_type: 'need_help',
            trip_session_id: activeTrip?.id,
            vehicle_id: vehicleId,
            location,
            idempotency_key: nativeActionKey('sos'),
          });
        } else if (action === 'trip') {
          if (activeTrip) {
            await api.endTrip(token, {
              trip_session_id: activeTrip.id,
              location,
              idempotency_key: nativeActionKey('trip-end'),
            });
          } else {
            await api.startTrip(token, {
              origin: location,
              vehicle_id: vehicleId,
              idempotency_key: nativeActionKey('trip-start'),
            });
          }
        } else if (action === 'charging') {
          if (activeCharging) {
            await api.endCharging(token, {
              charging_session_id: activeCharging.id,
              soc_end: telemetry?.soc ?? undefined,
              idempotency_key: nativeActionKey('charge-end'),
            });
          } else {
            await api.startCharging(token, {
              trip_session_id: activeTrip?.id,
              location,
              vehicle_id: vehicleId,
              soc_start: telemetry?.soc ?? undefined,
              idempotency_key: nativeActionKey('charge-start'),
            });
          }
        } else if (vehicleId) {
          await api.assistantMessage(token, {
            driver_id: current.driver.id,
            vehicle_id: vehicleId,
            message:
              'Give me the most important driving guidance right now based on my current mobility context.',
            channel: 'app',
            location,
          });
        }

        await load('refresh');
      } catch (err) {
        console.warn(
          'Native quick action failed',
          err instanceof Error ? err.message : err,
        );
      }
    },
    [token, load],
  );

  useEffect(() => {
    if (!token || token === 'mock-session-token') {
      stopNativeQuickAccessNotification();
      return;
    }

    startNativeQuickAccessNotification().catch(err => {
      console.warn(
        'Native quick access notification failed',
        err instanceof Error ? err.message : err,
      );
    });
    const sub = subscribeNativeQuickActions(action => {
      runNativeQuickAction(action).catch(err => {
        console.warn(
          'Native quick action handler failed',
          err instanceof Error ? err.message : err,
        );
      });
    });

    if (me?.driver?.id) {
      consumePendingNativeQuickAction()
        .then(action => {
          if (action) {
            return runNativeQuickAction(action);
          }
          return undefined;
        })
        .catch(err => {
          console.warn(
            'Could not consume pending native quick action',
            err instanceof Error ? err.message : err,
          );
        });
    }

    return () => sub.remove();
  }, [token, me?.driver?.id, runNativeQuickAction]);

  // Initial load whenever a token becomes available.
  useEffect(() => {
    if (token) {
      setLoading(true);
      load('initial');
    } else {
      setMe(null);
      setAlerts([]);
      setLoading(false);
      stopBackgroundLocation().catch(() => undefined);
      stopLiveMapSocket();
    }
    return () => {
      inFlight.current?.abort();
      stopLiveMapSocket();
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
