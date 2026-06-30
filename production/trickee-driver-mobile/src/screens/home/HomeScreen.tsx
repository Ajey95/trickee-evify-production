import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../../constants/Colors';
import GlassCard from '../../components/GlassCard';
import BatteryVisualizer from '../../components/BatteryVisualizer';
import DriverActionSheet from '../../components/DriverActionSheet';
import {LoadingState, ErrorState} from '../../components/StateViews';
import {useLiveData} from '../../context/LiveDataContext';
import type {Alert as ApiAlert} from '../../services/types';

const formatNumber = (value: number | null | undefined, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '--';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    me,
    telemetry,
    vehicle,
    driver,
    alerts,
    loading,
    refreshing,
    error,
    refresh,
    ackAlert,
  } = useLiveData();
  const [actionsOpen, setActionsOpen] = useState(false);

  if (loading && !me) {
    return <LoadingState label="Loading your fleet…" />;
  }
  if (error && !me) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const soc = telemetry?.soc ?? 0;
  const range = vehicle?.latest_dynamic_range_km;
  const speed = telemetry?.speed;
  const driverStyle = driver?.style_label || 'Unknown';
  const vehicleCode = vehicle?.vehicle_code || 'No vehicle';
  const driverCode = driver?.driver_code || '--';
  const activeTrip = me?.active_trip ?? null;
  const unresolved = alerts.filter(a => !a.is_resolved);

  const openQuickAccess = (target: string) => {
    const rootNav = navigation.getParent?.() ?? navigation;
    switch (target) {
      case 'route':
        rootNav.navigate('RouteIntel');
        break;
      case 'battery':
        navigation.navigate('Monitoring');
        break;
      case 'copilot':
        rootNav.navigate('AIAssistant');
        break;
      case 'trips':
        rootNav.navigate('PastTrips');
        break;
      case 'profile':
        navigation.navigate('More');
        break;
      case 'sos':
        setActionsOpen(true);
        break;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <ScrollView
        style={styles.scroll}
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
        {/* ACTIVE ORDER CARD */}
        <GlassCard style={styles.orderCard} cornerRadius={20}>
          <View style={styles.orderContent}>
            <View style={styles.orderHeader}>
              <View style={styles.orderHeaderLeft}>
                <Icon
                  name="navigation-variant"
                  size={13}
                  color={Colors.trickeeYellow}
                />
                <Text style={styles.orderLabel}>ACTIVE ORDER</Text>
              </View>
              {activeTrip ? (
                <View style={styles.trackLiveBadge}>
                  <View style={styles.greenDot} />
                  <Text style={styles.trackLiveText}>TRACK LIVE</Text>
                </View>
              ) : (
                <View style={styles.idleBadge}>
                  <Text style={styles.idleText}>IDLE</Text>
                </View>
              )}
            </View>

            <View style={styles.orderRow}>
              <View style={styles.orderIconCircle}>
                <Icon name="bike" size={22} color={Colors.trickeeYellow} />
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderName}>
                  {activeTrip?.destination_text || 'Gourmet Garden Bistro'}
                </Text>
                <Text style={styles.orderStatus}>
                  {activeTrip
                    ? 'Out for Delivery'
                    : 'Start a trip to begin tracking'}
                </Text>
              </View>
              {activeTrip && (
                <View style={{alignItems: 'flex-end'}}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: Colors.trickeeYellow,
                    }}>
                    12 mins remaining
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.4)',
                      fontWeight: '600',
                    }}>
                    ETA
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.tapRow}
              onPress={() => setActionsOpen(true)}
              activeOpacity={0.7}>
              <Text style={styles.tapText}>
                {activeTrip
                  ? 'Tap to view restaurant, location and live route'
                  : 'Open driver actions'}
              </Text>
              <Icon
                name="chevron-right"
                size={14}
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* QUICK ACCESS */}
        <View style={styles.quickSection}>
          <View style={styles.quickHeader}>
            <Text style={styles.sectionLabel}>QUICK ACCESS</Text>
            <Text style={styles.quickHint}>Driver tools</Text>
          </View>
          <View style={styles.quickGrid}>
            <QuickAccessButton
              icon="map-marker-path"
              label="Route"
              tone={Colors.trickeeYellow}
              onPress={() => openQuickAccess('route')}
            />
            <QuickAccessButton
              icon="battery-heart"
              label="Battery"
              tone={Colors.neonGreen}
              onPress={() => openQuickAccess('battery')}
            />
            <QuickAccessButton
              icon="account-voice"
              label="Copilot"
              tone={Colors.neonBlue}
              onPress={() => openQuickAccess('copilot')}
            />
            <QuickAccessButton
              icon="history"
              label="Trips"
              tone={Colors.neonPurple}
              onPress={() => openQuickAccess('trips')}
            />
            <QuickAccessButton
              icon="account-cog"
              label="Profile"
              tone={Colors.moderateYellow}
              onPress={() => openQuickAccess('profile')}
            />
            <QuickAccessButton
              icon="alert"
              label="SOS"
              tone={Colors.redSoft}
              onPress={() => openQuickAccess('sos')}
            />
          </View>
        </View>

        {/* RISK ALERTS */}
        <GlassCard style={styles.sectionCard} cornerRadius={20}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Icon name="shield" size={13} color="rgba(255,255,255,0.6)" />
                <Text style={styles.sectionLabel}>RISK ALERTS</Text>
              </View>
              {unresolved.length > 0 && (
                <Text style={styles.alertCount}>{unresolved.length}</Text>
              )}
            </View>

            {unresolved.length === 0 ? (
              <View style={styles.allClearBlock}>
                <View style={styles.greenCircle}>
                  <Icon
                    name="check-circle"
                    size={32}
                    color={Colors.neonGreen}
                  />
                </View>
                <Text style={styles.allClearTitle}>All Clear</Text>
                <Text style={styles.allClearSubtitle}>
                  No active risk alerts for {driver?.full_name || 'this driver'}
                  .
                </Text>
              </View>
            ) : (
              <View style={styles.alertsList}>
                {unresolved.slice(0, 4).map(alert => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onAck={() => ackAlert(alert.id)}
                  />
                ))}
              </View>
            )}
          </View>
        </GlassCard>

        {/* DRIVER ARCHETYPE */}
        <GlassCard style={styles.sectionCard} cornerRadius={20}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Icon name="gauge" size={13} color="rgba(255,255,255,0.6)" />
                <Text style={styles.sectionLabel}>DRIVER ARCHETYPE</Text>
              </View>
              <Icon name="head-cog" size={13} color="rgba(255,255,255,0.4)" />
            </View>

            <View style={styles.archetypeRow}>
              <View style={styles.donutContainer}>
                <View style={styles.donutOuter} />
                <View style={styles.donutFill} />
                <View style={styles.donutCenter}>
                  <Text style={styles.donutValue}>{driver ? '1' : '0'}</Text>
                  <Text style={styles.donutLabel}>Driver</Text>
                </View>
              </View>

              <View style={styles.legendBlock}>
                <LegendRow
                  color={Colors.neonPurple}
                  label="Aggressive"
                  on={driverStyle === 'Aggressive'}
                />
                <LegendRow
                  color={Colors.trickeeYellow}
                  label="Efficient"
                  on={driverStyle === 'Efficient'}
                />
                <LegendRow
                  color={Colors.greenAccent}
                  label="Smooth"
                  on={driverStyle === 'Smooth'}
                />
                <LegendRow
                  color={Colors.moderateYellow}
                  label="Moderate"
                  on={driverStyle === 'Moderate'}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statusTextRow}>
              <Text style={styles.statusPrefix}>Current style: </Text>
              <Text style={styles.statusHighlight}>{driverStyle}</Text>
              <View style={styles.flexSpacer} />
              <Text style={styles.driverIdText}>ID: {driverCode}</Text>
            </View>
          </View>
        </GlassCard>

        {/* VEHICLE STATUS */}
        <View style={styles.fleetSection}>
          <View style={styles.fleetHeader}>
            <Text style={styles.sectionLabel}>MY VEHICLE</Text>
          </View>

          {vehicle ? (
            <GlassCard style={styles.vehicleCard} cornerRadius={20}>
              <View style={styles.vehicleContent}>
                <View style={styles.vehicleTop}>
                  <View>
                    <View style={styles.plateRow}>
                      <Text style={styles.plateNumber}>{vehicleCode}</Text>
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeText}>
                          {telemetry?.ignition_on ? 'ACTIVE' : 'PARKED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.unitText}>
                      {`${vehicle.make || 'EV'} ${vehicle.model || ''}`.trim()}
                    </Text>
                  </View>
                </View>

                <View style={styles.chargeRow}>
                  <View>
                    <Text style={styles.chargeLabel}>STATE OF CHARGE</Text>
                    <View style={styles.chargeValueRow}>
                      <Text style={styles.chargeValue}>
                        {formatNumber(soc)}%
                      </Text>
                      <BatteryVisualizer soc={soc} />
                    </View>
                  </View>
                  <View>
                    <Text style={styles.chargeLabel}>EST. RANGE</Text>
                    <Text style={styles.rangeValue}>
                      {formatNumber(range)} km
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.vehicleBottomRow}>
                  <View style={styles.infoChip}>
                    <Icon name="gauge" size={13} color={Colors.trickeeYellow} />
                    <Text style={styles.chipText}>
                      {formatNumber(speed, 1)} km/h
                    </Text>
                  </View>
                  <View style={styles.infoChip}>
                    <Icon
                      name="thermometer"
                      size={13}
                      color={Colors.trickeeYellow}
                    />
                    <Text style={styles.chipText}>
                      {formatNumber(telemetry?.temp_max)} °C
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.vehicleCard} cornerRadius={20}>
              <View style={styles.noVehicle}>
                <Icon name="car-off" size={28} color="rgba(255,255,255,0.4)" />
                <Text style={styles.noVehicleText}>
                  No vehicle assigned yet. An operator will link your vehicle.
                </Text>
              </View>
            </GlassCard>
          )}
        </View>

        {/* INTELLIGENCE SUMMARY */}
        <GlassCard style={styles.reportCard} cornerRadius={20}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeaderLeft}>
              <Icon
                name="star-four-points"
                size={14}
                color={Colors.trickeeYellow}
              />
              <Text style={styles.sectionLabel}>INTELLIGENCE SUMMARY</Text>
            </View>

            <Text style={styles.reportText}>
              {vehicle ? (
                <>
                  <Text style={styles.reportYellow}>{vehicleCode}</Text> is at{' '}
                  <Text style={styles.reportYellow}>{formatNumber(soc)}%</Text>{' '}
                  charge with an estimated{' '}
                  <Text style={styles.reportGreen}>
                    {formatNumber(range)} km
                  </Text>{' '}
                  of range.
                </>
              ) : (
                'Awaiting a vehicle assignment to generate range intelligence.'
              )}
            </Text>

            <View style={styles.bulletBox}>
              <Bullet
                text={`Driver style: ${driverStyle} profile from Trickee telemetry.`}
              />
              <Bullet
                text={`${unresolved.length} active alert${
                  unresolved.length === 1 ? '' : 's'
                } for your account.`}
              />
            </View>
          </View>
        </GlassCard>
      </ScrollView>

      {/* Floating driver-actions button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setActionsOpen(true)}
        activeOpacity={0.85}>
        <Icon name="lightning-bolt" size={22} color={Colors.buttonText} />
        <Text style={styles.fabText}>Actions</Text>
      </TouchableOpacity>

      <DriverActionSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
      />
    </View>
  );
};

const AlertRow: React.FC<{alert: ApiAlert; onAck: () => void}> = ({
  alert,
  onAck,
}) => (
  <View style={styles.alertRow}>
    <View style={styles.alertDot} />
    <View style={styles.alertInfo}>
      <Text style={styles.alertTitle}>
        {alert.alert_type.replace(/_/g, ' ')}
      </Text>
      <Text style={styles.alertMessage} numberOfLines={2}>
        {alert.message}
      </Text>
    </View>
    <TouchableOpacity style={styles.ackButton} onPress={onAck}>
      <Icon name="check" size={16} color={Colors.neonGreen} />
    </TouchableOpacity>
  </View>
);

const QuickAccessButton: React.FC<{
  icon: string;
  label: string;
  tone: string;
  onPress: () => void;
}> = ({icon, label, tone, onPress}) => (
  <TouchableOpacity
    style={styles.quickButton}
    onPress={onPress}
    activeOpacity={0.78}>
    <View style={[styles.quickIcon, {backgroundColor: `${tone}18`}]}>
      <Icon name={icon} size={19} color={tone} />
    </View>
    <Text style={styles.quickLabel} numberOfLines={1} adjustsFontSizeToFit>
      {label}
    </Text>
  </TouchableOpacity>
);

const LegendRow: React.FC<{color: string; label: string; on: boolean}> = ({
  color,
  label,
  on,
}) => (
  <View style={legendStyles.row}>
    <View
      style={[
        legendStyles.dot,
        {backgroundColor: color, opacity: on ? 1 : 0.3},
      ]}
    />
    <Text style={[legendStyles.label, on && legendStyles.labelOn]}>
      {label}
    </Text>
    {on && <Icon name="check-circle" size={13} color={color} />}
  </View>
);

const Bullet: React.FC<{text: string}> = ({text}) => (
  <View style={styles.bulletRow}>
    <View style={styles.bulletDot} />
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

const legendStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4},
  label: {fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1},
  labelOn: {color: Colors.white, fontWeight: '700'},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.appBackground},
  watermark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  watermarkImage: {width: '100%', height: '100%', opacity: 0.15},
  scroll: {flex: 1},
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 160,
    paddingHorizontal: 16,
    gap: 20,
  },

  orderCard: {},
  orderContent: {padding: 18, gap: 14},
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderHeaderLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
  orderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  trackLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.neonGreen,
    shadowColor: Colors.neonGreen,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 2,
  },
  trackLiveText: {fontSize: 9, fontWeight: '700', color: Colors.neonGreen},
  idleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  idleText: {fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)'},
  orderRow: {flexDirection: 'row', alignItems: 'center', gap: 16},
  orderIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 202, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfo: {flex: 1, gap: 4},
  orderName: {fontSize: 16, fontWeight: '700', color: Colors.white},
  orderStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  divider: {height: 1, backgroundColor: 'rgba(255,255,255,0.08)'},
  tapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapText: {fontSize: 12, fontWeight: '600', color: Colors.trickeeYellow},

  quickSection: {gap: 10},
  quickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quickHint: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.42)',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickButton: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    height: 74,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    maxWidth: '86%',
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },

  sectionCard: {},
  sectionContent: {padding: 18, gap: 14},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  alertCount: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.redSoft,
    backgroundColor: 'rgba(255,68,68,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },

  allClearBlock: {alignItems: 'center', gap: 12, paddingVertical: 8},
  greenCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(57, 255, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allClearTitle: {fontSize: 22, fontWeight: '700', color: Colors.trickeeYellow},
  allClearSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  alertsList: {gap: 10},
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(255,68,68,0.05)',
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
  alertInfo: {flex: 1, gap: 2},
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    textTransform: 'capitalize',
  },
  alertMessage: {fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 15},
  ackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(57,255,20,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  archetypeRow: {flexDirection: 'row', alignItems: 'center', gap: 24},
  donutContainer: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  donutOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 10,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'absolute',
  },
  donutFill: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 10,
    borderColor: Colors.trickeeYellow,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    position: 'absolute',
    transform: [{rotate: '-45deg'}],
  },
  donutCenter: {alignItems: 'center', gap: 2},
  donutValue: {fontSize: 26, fontWeight: '700', color: Colors.white},
  donutLabel: {fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)'},
  legendBlock: {flex: 1, gap: 8, paddingRight: 8},
  statusTextRow: {flexDirection: 'row', alignItems: 'center', paddingTop: 4},
  statusPrefix: {fontSize: 12, color: 'rgba(255,255,255,0.6)'},
  statusHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.moderateYellow,
  },
  flexSpacer: {flex: 1},
  driverIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },

  fleetSection: {gap: 14},
  fleetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  vehicleCard: {},
  vehicleContent: {padding: 18, gap: 16},
  vehicleTop: {flexDirection: 'row', justifyContent: 'space-between'},
  plateRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  plateNumber: {fontSize: 22, fontWeight: '700', color: Colors.white},
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(57, 255, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.4)',
  },
  activeText: {fontSize: 9, fontWeight: '700', color: Colors.neonGreen},
  unitText: {fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4},
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chargeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
  },
  chargeValueRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  chargeValue: {fontSize: 34, fontWeight: '900', color: Colors.trickeeYellow},
  rangeValue: {fontSize: 26, fontWeight: '700', color: Colors.white},
  vehicleBottomRow: {flexDirection: 'row', justifyContent: 'space-between'},
  infoChip: {flexDirection: 'row', alignItems: 'center', gap: 6},
  chipText: {fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)'},
  noVehicle: {alignItems: 'center', gap: 10, padding: 28},
  noVehicleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },

  reportCard: {},
  reportText: {fontSize: 14, color: Colors.white, lineHeight: 22},
  reportGreen: {fontWeight: '700', color: Colors.neonGreen},
  reportYellow: {fontWeight: '700', color: Colors.trickeeYellow},
  bulletBox: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  bulletRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.trickeeYellow,
    marginTop: 5,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },

  fab: {
    position: 'absolute',
    right: 18,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.trickeeYellow,
    shadowColor: Colors.trickeeYellow,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {fontSize: 15, fontWeight: '800', color: Colors.buttonText},
});

export default HomeScreen;
