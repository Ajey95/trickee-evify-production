import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {trickeeApi} from '../../../services/trickeeApi/client';
import {getCurrentLocation, sendLocationPing, startTripTracking, stopTripTracking} from '../../../services/trickeeLocation/locationService';
import {flushOfflineQueue} from '../../../services/trickeeStorage/offlineQueue';
import {listenForDestination} from '../../../services/trickeeVoice/voiceService';
import {EmergencyIssueScreen} from '../emergency/EmergencyIssueScreen';
import {useDriverStore} from '../store/useDriverStore';
import {ActionButton} from './ActionButton';

export function DriverHomeScreen() {
  const {state, me, activeTrip, activeCharging, activeWaiting, latestMessage, setMe, setState, setTrip, setCharging, setWaiting, setMessage} =
    useDriverStore();
  const [loading, setLoading] = useState(true);
  const [emergency, setEmergency] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await trickeeApi.mobileMe();
    if (result.success) {
      setMe(result.data);
    } else {
      setMessage(result.error || 'Unable to load driver state');
    }
    setLoading(false);
  }, [setMe, setMessage]);

  useEffect(() => {
    refresh();
    flushOfflineQueue();
  }, [refresh]);

  async function handleStartTrip() {
    try {
      setState('listening');
      const origin = await getCurrentLocation();
      const transcript = await listenForDestination();
      const resolved = await trickeeApi.resolveDestination(transcript, origin);
      const trip = await trickeeApi.startTrip({
        destination_text: resolved.success ? resolved.data.destination_text : transcript,
        origin: {lat: origin.lat, lng: origin.lng},
        idempotency_key: `trip-${Date.now()}`,
      });
      if (!trip.success) {
        setMessage(trip.error || 'Trip start failed');
        setState(activeTrip ? 'trip_active' : 'ready');
        return;
      }
      setTrip(trip.data);
      await startTripTracking();
      await sendLocationPing('trip_active', me?.latest_telemetry?.soc);
      setMessage(trip.data.destination_text || 'Trip active');
    } catch (err) {
      setState(activeTrip ? 'trip_active' : 'ready');
      setMessage(err instanceof Error ? err.message : 'Destination was not captured');
    }
  }

  async function handleCharging() {
    const location = await getCurrentLocation();
    const result = await trickeeApi.startCharging({
      trip_session_id: activeTrip?.id,
      location,
      soc_start: me?.latest_telemetry?.soc,
      idempotency_key: `charge-${Date.now()}`,
    });
    if (result.success) {
      setCharging(result.data);
      await sendLocationPing('charging', me?.latest_telemetry?.soc);
    } else {
      setMessage(result.error || 'Charging failed');
    }
  }

  async function handleWaiting() {
    const location = await getCurrentLocation();
    const result = await trickeeApi.startWaiting({
      trip_session_id: activeTrip?.id,
      location,
      wait_type: 'unknown',
      idempotency_key: `wait-${Date.now()}`,
    });
    if (result.success) {
      setWaiting(result.data);
      await sendLocationPing('waiting', me?.latest_telemetry?.soc);
    } else {
      setMessage(result.error || 'Waiting failed');
    }
  }

  async function handleEndTrip() {
    if (!activeTrip) {
      return;
    }
    const location = await getCurrentLocation().catch(() => undefined);
    const result = await trickeeApi.endTrip(activeTrip.id, location);
    if (result.success) {
      setTrip(null);
      setCharging(null);
      setWaiting(null);
      await stopTripTracking();
      setMessage('Trip completed');
    } else {
      setMessage(result.error || 'Trip end failed');
    }
  }

  async function submitIssue(issueType: string, message?: string) {
    const location = await getCurrentLocation().catch(() => undefined);
    const result = await trickeeApi.createIssue({
      trip_session_id: activeTrip?.id,
      issue_type: issueType,
      message,
      location,
      idempotency_key: `issue-${Date.now()}`,
    });
    if (result.success) {
      setEmergency(false);
      setState('emergency');
      setMessage('Issue sent');
    } else {
      setMessage(result.error || 'Issue failed');
    }
  }

  if (emergency) {
    return <EmergencyIssueScreen onCancel={() => setEmergency(false)} onSubmit={submitIssue} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Trickee</Text>
        <Pressable onPress={refresh} style={styles.refresh}>
          <Text style={styles.refreshText}>Sync</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color="#16c7b8" /> : null}
      <View style={styles.statusBand}>
        <Text style={styles.driver}>{me?.driver.full_name || 'Driver'}</Text>
        <Text style={styles.meta}>{me?.vehicle?.vehicle_code || 'Vehicle pending'}</Text>
        <Text style={styles.soc}>SOC {Math.round(Number(me?.latest_telemetry?.soc || 0))}%</Text>
      </View>
      <ActionButton
        state={state}
        onTap={handleStartTrip}
        onDoubleTap={handleCharging}
        onSwipeRight={handleWaiting}
        onLongPress={() => setEmergency(true)}
      />
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{activeTrip?.destination_text || 'No active destination'}</Text>
        <Text style={styles.panelText}>
          {activeCharging ? 'Charging timer active' : activeWaiting ? 'Waiting timer active' : activeTrip ? 'Ride tracking active' : 'Ready'}
        </Text>
        {latestMessage ? <Text style={styles.message}>{latestMessage}</Text> : null}
        <View style={styles.row}>
          {activeCharging ? (
            <Pressable onPress={() => trickeeApi.endCharging(activeCharging.id, me?.latest_telemetry?.soc).then(r => r.success && setCharging(null))} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>End charging</Text>
            </Pressable>
          ) : null}
          {activeWaiting ? (
            <Pressable onPress={() => trickeeApi.endWaiting(activeWaiting.id).then(r => r.success && setWaiting(null))} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>End waiting</Text>
            </Pressable>
          ) : null}
          {activeTrip ? (
            <Pressable onPress={handleEndTrip} style={styles.dangerButton}>
              <Text style={styles.dangerText}>End trip</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081018',
  },
  content: {
    padding: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
  },
  refresh: {
    borderColor: '#263445',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  refreshText: {
    color: '#cbd5e1',
    fontWeight: '800',
  },
  statusBand: {
    backgroundColor: '#101b26',
    borderColor: '#263445',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  driver: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: '#94a3b8',
    marginTop: 4,
  },
  soc: {
    color: '#16c7b8',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 12,
  },
  panel: {
    backgroundColor: '#101b26',
    borderColor: '#263445',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  panelTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  panelText: {
    color: '#94a3b8',
    marginTop: 6,
  },
  message: {
    color: '#cbd5e1',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  smallButton: {
    backgroundColor: '#223247',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallButtonText: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  dangerButton: {
    backgroundColor: '#d64545',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dangerText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
