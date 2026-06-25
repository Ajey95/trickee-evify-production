import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Colors} from '../constants/Colors';
import PageIndicator from '../components/PageIndicator';
import GlassCard from '../components/GlassCard';
import TrickeeButton from '../components/TrickeeButton';
import AnimatedOrbs from '../components/AnimatedOrbs';

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({navigation}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<PagerView>(null);

  const handleNext = () => {
    if (currentPage < 2) {
      pagerRef.current?.setPage(currentPage + 1);
    } else {
      navigation.replace('Auth');
    }
  };

  const handleSkip = () => {
    navigation.replace('Auth');
  };

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Animated ambient orbs — matching iOS infinite drift */}
      <View style={styles.orbContainer}>
        <AnimatedOrbs />
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={e => setCurrentPage(e.nativeEvent.position)}>
        {/* Page 1 — Zero Range Anxiety */}
        <View key="0" style={styles.page}>
          <View style={styles.spacer} />

          {/* Route Icon */}
          <View style={styles.iconBox}>
            <View style={styles.iconBorder}>
              <Icon
                name="map-marker-path"
                size={32}
                color={Colors.trickeeYellow}
              />
            </View>
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.title}>Zero range anxiety</Text>
            <Text style={styles.highlightTitle}>ever again</Text>
            <Text style={styles.subtitle}>
              AI predicts your exact range with 99.2% accuracy, factoring
              battery chemistry, SOC, and payload.
            </Text>
          </View>

          <View style={styles.cardRow}>
            <GlassCard style={styles.statCard} cornerRadius={18}>
              <View style={styles.statCardInner}>
                <Text style={styles.statValue}>99.2%</Text>
                <Text style={styles.statLabel}>Range accuracy</Text>
              </View>
            </GlassCard>
            <GlassCard style={styles.statCard} cornerRadius={18}>
              <View style={styles.statCardInner}>
                <Text style={styles.statValue}>150+</Text>
                <Text style={styles.statLabel}>AI parameters</Text>
              </View>
            </GlassCard>
          </View>

          <View style={styles.spacer} />
        </View>

        {/* Page 2 — Smart Charging */}
        <View key="1" style={styles.page}>
          <View style={styles.spacer} />

          {/* Chargers Icon */}
          <View style={styles.chargersIconContainer}>
            <View style={styles.chargersGlow} />
            <View style={styles.chargersBox}>
              <Icon name="ev-station" size={26} color={Colors.greenAccent} />
              <Icon name="ev-station" size={26} color={Colors.trickeeYellow} />
            </View>
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.title}>Smart charging,</Text>
            <Text style={styles.highlightTitle}>smarter routes</Text>
          </View>

          <View style={styles.featureCards}>
            <GlassCard style={styles.featureCard} cornerRadius={18}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconCircle}>
                  <Icon
                    name="lightning-bolt"
                    size={20}
                    color={Colors.trickeeYellow}
                  />
                </View>
                <View style={styles.featureTextBlock}>
                  <Text style={styles.featureTitle}>
                    Predictive charge scheduling
                  </Text>
                  <Text style={styles.featureSubtitle}>
                    Intelligent timing based on dynamic tariffs.
                  </Text>
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.featureCard} cornerRadius={18}>
              <View style={styles.featureRow}>
                <View style={[styles.featureIconCircle, styles.greenCircle]}>
                  <Icon
                    name="map-marker-radius"
                    size={20}
                    color={Colors.greenAccent}
                  />
                </View>
                <View style={styles.featureTextBlock}>
                  <Text style={styles.featureTitle}>32% energy savings</Text>
                  <Text style={styles.featureSubtitle}>
                    Verified savings across the fleet lifecycle.
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>

          <View style={styles.spacer} />
        </View>

        {/* Page 3 — Fleet Analytics */}
        <View key="2" style={styles.page}>
          <View style={styles.spacer} />

          {/* Dashboard Icon */}
          <View style={styles.dashboardIcon}>
            <View style={styles.dashCol}>
              <View
                style={[
                  styles.dashBlock,
                  {backgroundColor: Colors.greenAccent},
                ]}
              />
              <View style={[styles.dashBlock, {backgroundColor: '#8B66E5'}]} />
            </View>
            <View
              style={[styles.dashTall, {backgroundColor: Colors.trickeeYellow}]}
            />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.title}>Real-time fleet</Text>
            <Text style={styles.highlightTitle}>analytics & control</Text>
            <Text style={styles.subtitle}>
              Live vehicle tracking, driver behavior insights, and predictive
              maintenance alerts in one unified dashboard.
            </Text>
          </View>

          <View style={styles.gridCards}>
            <View style={styles.gridRow}>
              <GlassCard style={styles.gridCardSmall} cornerRadius={16}>
                <View style={styles.gridCardInner}>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Live</Text>
                  </View>
                  <View style={styles.gpsRow}>
                    <Icon
                      name="crosshairs-gps"
                      size={14}
                      color="rgba(255,255,255,0.8)"
                    />
                    <Text style={styles.gpsText}>GPS tracking</Text>
                  </View>
                </View>
              </GlassCard>
              <GlassCard style={styles.gridCardSmall} cornerRadius={16}>
                <View style={styles.gridCardInner}>
                  <View style={styles.savingsRow}>
                    <Text style={styles.savingsValue}>₹2.4 Cr</Text>
                    <Icon
                      name="chart-line"
                      size={14}
                      color={Colors.greenAccent}
                    />
                  </View>
                  <Text style={styles.savingsLabel}>SAVINGS UNLOCKED</Text>
                </View>
              </GlassCard>
            </View>

            <GlassCard style={styles.gridCardWide} cornerRadius={16}>
              <View style={styles.statusRow}>
                <View>
                  <Text style={styles.statusLabel}>System Status</Text>
                  <Text style={styles.statusValue}>Operational</Text>
                </View>
                <View style={styles.avatarGroup}>
                  <View style={[styles.avatar, {backgroundColor: '#F97316'}]}>
                    <Text style={styles.avatarText}>R</Text>
                  </View>
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarOverlap,
                      {backgroundColor: '#6366F1'},
                    ]}>
                    <Text style={styles.avatarText}>S</Text>
                  </View>
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarOverlap,
                      {backgroundColor: '#334D99'},
                    ]}>
                    <Text style={styles.avatarSmall}>+12</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </View>

          <View style={styles.spacer} />
        </View>
      </PagerView>

      {/* Control panel */}
      <View style={styles.controlPanel}>
        <PageIndicator count={3} activeIndex={currentPage} />

        <TrickeeButton
          label={currentPage === 2 ? 'Get started' : 'Continue'}
          onPress={handleNext}
          style={styles.ctaButton}
        />

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>
            {currentPage === 2 ? 'Already have an account' : 'Skip intro'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  spacer: {
    flex: 1,
  },
  textBlock: {
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  highlightTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.trickeeYellow,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    marginTop: 8,
  },

  // Page 1 icon
  iconBox: {
    marginBottom: 12,
  },
  iconBorder: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(18, 20, 25, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Page 1 stat cards
  cardRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    width: '100%',
  },
  statCard: {
    flex: 1,
    height: 90,
  },
  statCardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.trickeeYellow,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // Page 2 icons
  chargersIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  chargersGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 202, 32, 0.08)',
  },
  chargersBox: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(13, 36, 31, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },

  // Page 2 feature cards
  featureCards: {
    width: '100%',
    gap: 14,
    marginTop: 16,
  },
  featureCard: {
    height: 80,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    flex: 1,
  },
  featureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 202, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCircle: {
    backgroundColor: 'rgba(51, 204, 128, 0.12)',
  },
  featureTextBlock: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.trickeeYellow,
  },
  featureSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.secondaryText,
  },

  // Page 3 dashboard icon
  dashboardIcon: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 31, 56, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dashCol: {
    gap: 6,
  },
  dashBlock: {
    width: 16,
    height: 14,
    borderRadius: 3,
  },
  dashTall: {
    width: 10,
    height: 34,
    borderRadius: 3,
  },

  // Page 3 grid cards
  gridCards: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCardSmall: {
    flex: 1,
    height: 76,
  },
  gridCardInner: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.trickeeYellow,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.trickeeYellow,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gpsText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savingsValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.trickeeYellow,
  },
  savingsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondaryText,
  },
  gridCardWide: {
    height: 76,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.trickeeYellow,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 4,
  },
  avatarGroup: {
    flexDirection: 'row',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  avatarSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },

  // Control panel
  controlPanel: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    paddingTop: 8,
    gap: 8,
  },
  ctaButton: {
    width: '100%',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondaryText,
  },
});

export default OnboardingScreen;
