import React, {useState} from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardTypeOptions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../constants/Colors';
import {Spacing} from '../constants/Spacing';

interface TrickeeInputProps {
  title: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  error?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  showPasswordToggle?: boolean;
}

const TrickeeInput: React.FC<TrickeeInputProps> = ({
  title,
  placeholder,
  value,
  onChangeText,
  icon,
  keyboardType = 'default',
  secureTextEntry = false,
  error = null,
  autoCapitalize = 'sentences',
  showPasswordToggle = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isSecure = secureTextEntry && !isPasswordVisible;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}>
        <Icon
          name={icon}
          size={18}
          color={isFocused ? Colors.trickeeYellow : Colors.secondaryText}
          style={styles.icon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={'rgba(156, 163, 175, 0.6)'}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={isSecure}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={Colors.trickeeYellow}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.toggleButton}>
            <Icon
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={Colors.secondaryText}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Spacing.inputHeight,
    backgroundColor: Colors.overlay,
    borderRadius: Spacing.inputRadius,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 14,
    gap: 12,
  },
  inputFocused: {
    borderColor: Colors.borderFocus,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: 'rgba(255, 68, 68, 0.4)',
  },
  icon: {
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.white,
    padding: 0,
  },
  toggleButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 11,
    color: Colors.red,
    paddingLeft: 4,
  },
});

export default TrickeeInput;
