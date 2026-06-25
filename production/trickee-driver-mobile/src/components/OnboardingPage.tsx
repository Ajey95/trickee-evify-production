import React from 'react';
import {View, Text, StyleSheet, Dimensions} from 'react-native';
import {Colors} from '../constants/Colors';

interface OnboardingPageProps {
  title: string;
  highlightTitle: string;
  subtitle?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

const {width} = Dimensions.get('window');

const OnboardingPage: React.FC<OnboardingPageProps> = ({
  title,
  highlightTitle,
  subtitle,
  icon,
  children,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.spacer} />
      <View style={styles.iconContainer}>{icon}</View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.highlightTitle}>{highlightTitle}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {children && <View style={styles.cardsContainer}>{children}</View>}
      <View style={styles.spacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  spacer: {
    flex: 1,
  },
  iconContainer: {
    marginBottom: 12,
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
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
    paddingHorizontal: 36,
    marginTop: 8,
  },
  cardsContainer: {
    width: '100%',
    marginTop: 16,
  },
});

export default OnboardingPage;
