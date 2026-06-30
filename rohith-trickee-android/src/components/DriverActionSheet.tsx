import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../constants/Colors';
import {api, ApiError} from '../services/api';
import {useAuth} from '../context/AuthContext';
import {useLiveData} from '../context/LiveDataContext';
import type {IssueType} from '../services/types';

type Props = {visible: boolean; onClose: () => void};

const ISSUE_OPTIONS: {type: IssueType; label: string; icon: string}[] = [
  {type: 'need_help', label: 'Need help', icon: 'hand-back-right'},
  {type: 'breakdown', label: 'Breakdown', icon: 'car-wrench'},
  {type: 'low_battery', label: 'Low battery', icon: 'battery-alert'},
  {type: 'puncture', label: 'Puncture', icon: 'tire'},
  {type: 'charger_not_working', label: 'Charger down', icon: 'ev-station'},
  {type: 'unsafe_route', label: 'Unsafe route', icon: 'shield-alert'},
  {type: 'accident', label: 'Accident', icon: 'alert-octagon'},
];

const key = (action: string) => `${action}-${Date.now()}`;

const DriverActionSheet: React.FC<Props> = ({visible, onClose}) => {
  const {token} = useAuth();
  const {me, telemetry, refresh} = useLiveData();
  const [busy, setBusy] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);

  const activeTrip = me?.active_trip ?? null;
  const activeCharging = me?.active_charging ?? null;
  const activeWaiting = me?.active_waiting ?? null;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (!token || busy) {
      return;
    }
    setBusy(label);
    try {
      await fn();
      await refresh();
    } catch (err) {
      Alert.alert(
        'Action failed',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const reportIssue = (issue: IssueType) =>
    run(`issue-${issue}`, async () => {
      await api.reportIssue(token!, {
        issue_type: issue,
        idempotency_key: key(issue),
      });
      setShowIssues(false);
      Alert.alert('Reported', 'Your issue was sent to the fleet operator.');
    });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Driver Actions</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color={Colors.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Status summary */}
          <View style={styles.statusRow}>
            <StatusPill
              active={!!activeTrip}
              label={activeTrip ? 'On a trip' : 'Idle'}
              icon="navigation-variant"
            />
            {activeCharging && (
              <StatusPill active label="Charging" icon="ev-station" />
            )}
            {activeWaiting && (
              <StatusPill active label="Waiting" icon="timer-sand" />
            )}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}>
            {!showIssues ? (
              <>
                <ActionButton
                  label={activeTrip ? 'End trip' : 'Start trip'}
                  icon={activeTrip ? 'flag-checkered' : 'play'}
                  tone={activeTrip ? 'neutral' : 'primary'}
                  loading={busy === 'trip'}
                  onPress={() =>
                    run('trip', () =>
                      activeTrip
                        ? api.endTrip(token!, {
                            trip_session_id: activeTrip.id,
                            idempotency_key: key('trip-end'),
                          })
                        : api.startTrip(token!, {
                            idempotency_key: key('trip-start'),
                          }),
                    )
                  }
                />
                <ActionButton
                  label={activeCharging ? 'End charging' : 'Start charging'}
                  icon="ev-station"
                  tone="neutral"
                  loading={busy === 'charging'}
                  onPress={() =>
                    run('charging', () =>
                      activeCharging
                        ? api.endCharging(token!, {
                            charging_session_id: activeCharging.id,
                            soc_end: telemetry?.soc ?? undefined,
                            idempotency_key: key('charge-end'),
                          })
                        : api.startCharging(token!, {
                            soc_start: telemetry?.soc ?? undefined,
                            idempotency_key: key('charge-start'),
                          }),
                    )
                  }
                />
                <ActionButton
                  label={activeWaiting ? 'End waiting' : 'Start waiting'}
                  icon="timer-sand"
                  tone="neutral"
                  loading={busy === 'waiting'}
                  onPress={() =>
                    run('waiting', () =>
                      activeWaiting
                        ? api.endWaiting(token!, {
                            wait_event_id: activeWaiting.id,
                            idempotency_key: key('wait-end'),
                          })
                        : api.startWaiting(token!, {
                            wait_type: 'unknown',
                            idempotency_key: key('wait-start'),
                          }),
                    )
                  }
                />
                <ActionButton
                  label="Report issue / SOS"
                  icon="alert"
                  tone="danger"
                  onPress={() => setShowIssues(true)}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => setShowIssues(false)}>
                  <Icon
                    name="chevron-left"
                    size={18}
                    color={Colors.trickeeYellow}
                  />
                  <Text style={styles.backLinkText}>Back to actions</Text>
                </TouchableOpacity>
                <Text style={styles.issuePrompt}>What's happening?</Text>
                <View style={styles.issueGrid}>
                  {ISSUE_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.type}
                      style={styles.issueChip}
                      disabled={!!busy}
                      onPress={() => reportIssue(opt.type)}>
                      {busy === `issue-${opt.type}` ? (
                        <ActivityIndicator color={Colors.redSoft} />
                      ) : (
                        <>
                          <Icon
                            name={opt.icon}
                            size={20}
                            color={Colors.redSoft}
                          />
                          <Text style={styles.issueChipText}>{opt.label}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const StatusPill: React.FC<{active: boolean; label: string; icon: string}> = ({
  active,
  label,
  icon,
}) => (
  <View style={[styles.pill, active && styles.pillActive]}>
    <Icon
      name={icon}
      size={13}
      color={active ? Colors.neonGreen : Colors.secondaryText}
    />
    <Text style={[styles.pillText, active && styles.pillTextActive]}>
      {label}
    </Text>
  </View>
);

const ActionButton: React.FC<{
  label: string;
  icon: string;
  tone: 'primary' | 'neutral' | 'danger';
  loading?: boolean;
  onPress: () => void;
}> = ({label, icon, tone, loading, onPress}) => (
  <TouchableOpacity
    style={[
      styles.action,
      tone === 'primary' && styles.actionPrimary,
      tone === 'danger' && styles.actionDanger,
    ]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}>
    {loading ? (
      <ActivityIndicator
        color={tone === 'primary' ? Colors.buttonText : Colors.white}
      />
    ) : (
      <>
        <Icon
          name={icon}
          size={20}
          color={
            tone === 'primary'
              ? Colors.buttonText
              : tone === 'danger'
              ? Colors.redSoft
              : Colors.white
          }
        />
        <Text
          style={[
            styles.actionText,
            tone === 'primary' && styles.actionTextPrimary,
            tone === 'danger' && styles.actionTextDanger,
          ]}>
          {label}
        </Text>
      </>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropTouch: {...StyleSheet.absoluteFillObject},
  sheet: {
    backgroundColor: '#0B1018',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {fontSize: 20, fontWeight: '700', color: Colors.white},
  statusRow: {flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8},
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pillActive: {
    backgroundColor: 'rgba(57,255,20,0.1)',
    borderColor: 'rgba(57,255,20,0.3)',
  },
  pillText: {fontSize: 12, fontWeight: '700', color: Colors.secondaryText},
  pillTextActive: {color: Colors.neonGreen},
  body: {marginTop: 6},
  bodyContent: {gap: 12, paddingBottom: 8},
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionPrimary: {
    backgroundColor: Colors.trickeeYellow,
    borderColor: Colors.trickeeYellow,
  },
  actionDanger: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderColor: 'rgba(255,138,128,0.4)',
  },
  actionText: {fontSize: 15, fontWeight: '700', color: Colors.white},
  actionTextPrimary: {color: Colors.buttonText},
  actionTextDanger: {color: Colors.redSoft},
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  backLinkText: {fontSize: 14, fontWeight: '600', color: Colors.trickeeYellow},
  issuePrompt: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  issueGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  issueChip: {
    width: '47%',
    flexGrow: 1,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255,68,68,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,128,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  issueChipText: {fontSize: 12, fontWeight: '700', color: Colors.white},
});

export default DriverActionSheet;
