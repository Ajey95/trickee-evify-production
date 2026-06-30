import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../../constants/Colors';
import GlassCard from '../../components/GlassCard';
import BackgroundLogo from '../../components/BackgroundLogo';
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from '../../components/StateViews';
import {useLiveData} from '../../context/LiveDataContext';

const WAVE_LEN = 40;

const fmt = (v: number | null | undefined, digits = 1) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '--';

/** Real power (kW) from a telemetry row: prefer V·I, since unit is unambiguous. */
const powerKw = (voltage?: number | null, current?: number | null) => {
  if (typeof voltage === 'number' && typeof current === 'number') {
    return (voltage * current) / 1000;
  }
  return 0;
};

const MonitoringScreen: React.FC = () => {
  const {
    telemetry,
    vehicle,
    alerts,
    loading,
    refreshing,
    error,
    refresh,
    ackAlert,
    lastUpdated,
  } = useLiveData();
  const vehicleCode = vehicle?.vehicle_code || 'No vehicle';

  // Rolling oscilloscope buffer fed from REAL telemetry samples (no fake data).
  const [wave, setWave] = useState<number[]>(Array(WAVE_LEN).fill(0));
  const lastSampleKey = useRef<string | null>(null);

  const dotPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [dotPulse]);

  // Append a new sample whenever fresh telemetry arrives from the poller.
  useEffect(() => {
    if (!telemetry) {
      return;
    }
    const key = telemetry.recorded_at || telemetry.id;
    if (key === lastSampleKey.current) {
      return;
    }
    lastSampleKey.current = key ?? null;
    const p = powerKw(telemetry.battery_voltage, telemetry.current);
    setWave(prev => [...prev.slice(1), p]);
  }, [telemetry]);

  if (loading && !telemetry) {
    return <LoadingState label="Connecting to telemetry…" />;
  }
  if (error && !telemetry) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const voltage = telemetry?.battery_voltage ?? null;
  const current = telemetry?.current ?? null;
  const power = powerKw(voltage, current);
  const packTemp = telemetry?.temp_max ?? null;
  const cellImbalance = telemetry?.cell_imbalance_mv ?? null;
  const voltageSag = telemetry?.voltage_sag_v ?? null;
  const soh = telemetry?.soh ?? null;
  const unresolved = alerts.filter(a => !a.is_resolved);

  return (
    <View style={styles.container}>
      <BackgroundLogo />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.trickeeYellow}
            colors={[Colors.trickeeYellow]}
          />
        }>
        <View style={styles.titleBlock}>
          <View>
            <Text style={styles.titleText}>Telemetry Diagnostics</Text>
            <View style={styles.liveRow}>
              <Animated.View style={[styles.liveDot, {opacity: dotPulse}]} />
              <Text style={styles.liveText}>
                {lastUpdated
                  ? `UPDATED ${new Date(lastUpdated).toLocaleTimeString()}`
                  : 'LIVE'}
              </Text>
            </View>
          </View>
          <View style={styles.vehicleBadge}>
            <Text style={styles.vehicleBadgeText}>{vehicleCode}</Text>
          </View>
        </View>

        {!telemetry ? (
          <GlassCard cornerRadius={18}>
            <EmptyState
              icon="pulse"
              title="No telemetry yet"
              subtitle="Telemetry will appear once your vehicle reports data."
            />
          </GlassCard>
        ) : (
          <>
            {/* Power oscilloscope — fed from real samples */}
            <GlassCard
              cornerRadius={18}
              variant="liquidGlass"
              highlightColor="rgba(255, 202, 32, 0.08)">
              <View style={styles.oscContent}>
                <View style={styles.oscHeader}>
                  <View style={styles.oscHeaderLeft}>
                    <Icon name="pulse" size={14} color={Colors.trickeeYellow} />
                    <Text style={styles.oscHeaderLabel}>
                      POWER OSCILLOSCOPE
                    </Text>
                  </View>
                  <Text style={styles.oscPowerValue}>
                    {fmt(Math.abs(power), 2)} kW
                  </Text>
                </View>

                <View style={styles.waveContainer}>
                  <View style={styles.waveArea}>
                    {wave.map((val, i) => {
                      const height = Math.max(
                        2,
                        Math.min(70, Math.abs(val) * 12 + 6),
                      );
                      return (
                        <View
                          key={i}
                          style={[
                            styles.waveBar,
                            {
                              height,
                              backgroundColor:
                                val < 0
                                  ? Colors.neonGreen
                                  : Colors.trickeeYellow,
                              opacity: 0.3 + (i / wave.length) * 0.7,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
                <Text style={styles.oscFootnote}>
                  {current != null && current < 0
                    ? 'Regenerating / charging'
                    : 'Discharging under load'}
                </Text>
              </View>
            </GlassCard>

            {/* Diagnostic grid from real telemetry */}
            <View style={styles.diagGrid}>
              <DiagCard
                title="BATTERY VOLTAGE"
                value={`${fmt(voltage)} V`}
                icon="battery-charging"
                color={Colors.neonBlue}
              />
              <DiagCard
                title="CURRENT"
                value={`${fmt(current)} A`}
                icon="gauge"
                color={
                  current != null && current < 0
                    ? Colors.neonGreen
                    : Colors.redSoft
                }
              />
              <DiagCard
                title="POWER OUTPUT"
                value={`${fmt(power, 2)} kW`}
                icon="lightning-bolt"
                color={Colors.trickeeYellow}
              />
              <DiagCard
                title="PACK TEMP"
                value={`${fmt(packTemp)} °C`}
                icon="thermometer"
                color={
                  packTemp != null && packTemp > 38
                    ? Colors.redSoft
                    : Colors.moderateYellow
                }
              />
              <DiagCard
                title="CELL IMBALANCE"
                value={`${fmt(cellImbalance, 0)} mV`}
                icon="alert-circle"
                color={
                  cellImbalance != null && cellImbalance > 15
                    ? Colors.redSoft
                    : Colors.neonGreen
                }
              />
              <DiagCard
                title="VOLTAGE SAG"
                value={`${fmt(voltageSag, 2)} V`}
                icon="arrow-collapse-down"
                color={Colors.neonPurple}
              />
            </View>

            {/* State of health */}
            <GlassCard
              cornerRadius={14}
              variant="liquidGlass"
              highlightColor="rgba(57, 255, 20, 0.08)">
              <View style={styles.diagCardContent}>
                <Icon name="heart-pulse" size={13} color={Colors.neonGreen} />
                <Text style={styles.diagValue}>{fmt(soh, 0)} %</Text>
                <Text style={styles.diagLabel}>BATTERY STATE OF HEALTH</Text>
              </View>
            </GlassCard>
          </>
        )}

        {/* Live alerts from backend */}
        <GlassCard cornerRadius={20} variant="liquidGlass">
          <View style={styles.alertsContent}>
            <View style={styles.alertsHeader}>
              <View style={styles.alertsHeaderLeft}>
                <Icon
                  name="bell-badge"
                  size={14}
                  color="rgba(255,255,255,0.5)"
                />
                <Text style={styles.alertsHeaderLabel}>LIVE ALERTS</Text>
              </View>
              {unresolved.length > 0 && (
                <TouchableOpacity
                  onPress={() => unresolved.forEach(a => ackAlert(a.id))}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {unresolved.length === 0 ? (
              <View style={styles.allClearBlock}>
                <Icon name="shield-check" size={28} color={Colors.neonGreen} />
                <Text style={styles.allClearText}>
                  System status fully operational
                </Text>
              </View>
            ) : (
              <View style={styles.alertsList}>
                {unresolved.map(alert => (
                  <View key={alert.id} style={styles.alertRow}>
                    <View style={styles.alertDot} />
                    <View style={styles.alertInfo}>
                      <View style={styles.alertTitleRow}>
                        <Text style={styles.alertTitle}>
                          {alert.alert_type.replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.alertTimestamp}>
                          {alert.created_at
                            ? new Date(alert.created_at).toLocaleTimeString()
                            : ''}
                        </Text>
                      </View>
                      <Text style={styles.alertDesc}>{alert.message}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.ackButton}
                      onPress={() => ackAlert(alert.id)}>
                      <Icon name="check" size={15} color={Colors.neonGreen} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const DiagCard: React.FC<{
  title: string;
  value: string;
  icon: string;
  color: string;
}> = ({title, value, icon, color}) => (
  <GlassCard
    cornerRadius={14}
    variant="liquidGlass"
    highlightColor={`${color}15`}>
    <View style={styles.diagCardContent}>
      <Icon name={icon} size={13} color={color} />
      <Text style={styles.diagValue}>{value}</Text>
      <Text style={styles.diagLabel}>{title}</Text>
    </View>
  </GlassCard>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.appBackground},
  watermark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  watermarkImage: {width: '100%', height: '100%', opacity: 0.15},
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 160,
    gap: 14,
  },

  titleBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  titleText: {fontSize: 26, fontWeight: '700', color: Colors.white},
  liveRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.neonGreen,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neonGreen,
    letterSpacing: 1,
  },
  vehicleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
  },
  vehicleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'monospace',
  },

  oscContent: {padding: 16, gap: 12},
  oscHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  oscHeaderLeft: {flexDirection: 'row', alignItems: 'center', gap: 6},
  oscHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  oscPowerValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.trickeeYellow,
    fontFamily: 'monospace',
  },
  waveContainer: {
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  waveArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    paddingHorizontal: 2,
    gap: 1,
  },
  waveBar: {flex: 1, borderRadius: 1, minHeight: 2},
  oscFootnote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },

  diagGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  diagCardContent: {padding: 14, gap: 6},
  diagValue: {fontSize: 20, fontWeight: '900', color: Colors.white},
  diagLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },

  alertsContent: {padding: 16, gap: 14},
  alertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertsHeaderLeft: {flexDirection: 'row', alignItems: 'center', gap: 6},
  alertsHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  clearAllText: {fontSize: 11, fontWeight: '700', color: Colors.trickeeYellow},
  allClearBlock: {alignItems: 'center', gap: 8, paddingVertical: 24},
  allClearText: {fontSize: 12, color: 'rgba(255,255,255,0.5)'},
  alertsList: {gap: 10},
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,138,128,0.2)',
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.redSoft,
  },
  alertInfo: {flex: 1, gap: 4},
  alertTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    textTransform: 'capitalize',
  },
  alertTimestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
  },
  alertDesc: {fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 16},
  ackButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(57,255,20,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MonitoringScreen;
