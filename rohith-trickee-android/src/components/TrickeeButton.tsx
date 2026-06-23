import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import {Colors} from '../constants/Colors';
import {Spacing} from '../constants/Spacing';

interface TrickeeButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

const TrickeeButton: React.FC<TrickeeButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  icon,
}) => {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary && styles.primaryButton,
        isOutline && styles.outlineButton,
        variant === 'secondary' && styles.secondaryButton,
        disabled && styles.disabledButton,
        isPrimary && disabled && styles.primaryDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? Colors.buttonText : Colors.trickeeYellow}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              isPrimary && styles.primaryLabel,
              isOutline && styles.outlineLabel,
              variant === 'secondary' && styles.secondaryLabel,
            ]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: Spacing.buttonHeight,
    borderRadius: Spacing.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: Colors.trickeeYellow,
    shadowColor: Colors.trickeeYellow,
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryDisabled: {
    backgroundColor: 'rgba(255, 202, 32, 0.5)',
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.trickeeYellow,
  },
  disabledButton: {
    opacity: 0.7,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: Colors.buttonText,
  },
  secondaryLabel: {
    color: Colors.white,
  },
  outlineLabel: {
    color: Colors.trickeeYellow,
  },
});

export default TrickeeButton;
