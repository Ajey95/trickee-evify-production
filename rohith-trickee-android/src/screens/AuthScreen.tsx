import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Colors} from '../constants/Colors';
import TrickeeInput from '../components/TrickeeInput';
import TrickeeButton from '../components/TrickeeButton';
import GlassCard from '../components/GlassCard';
import AnimatedOrbs from '../components/AnimatedOrbs';
import {useAuth} from '../context/AuthContext';
import {api} from '../services/api';
import {DEMO_LOGINS, SHOW_DEMO_LOGINS} from '../config';

type AuthScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const AuthScreen: React.FC<AuthScreenProps> = ({navigation}) => {
  const [isSignUp, setIsSignUp] = useState(false);

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

      {isSignUp ? (
        <SignUpView onSignIn={() => setIsSignUp(false)} />
      ) : (
        <SignInView
          onSignUp={() => setIsSignUp(true)}
          onSuccess={() => navigation.replace('Main')}
        />
      )}
    </View>
  );
};

// ============ SIGN IN VIEW ============
interface SignInViewProps {
  onSignUp: () => void;
  onSuccess: () => void;
}

const SignInView: React.FC<SignInViewProps> = ({onSignUp, onSuccess}) => {
  const {login, loading} = useAuth();
  const [email, setEmail] = useState('driver1@evify.in');
  const [password, setPassword] = useState('Driver@2026');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const isFormValid = email.includes('@') && password.length >= 6;

  const handleSignIn = async () => {
    let hasError = false;
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasError = true;
    }
    if (!hasError) {
      try {
        await login(email, password);
        onSuccess();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to sign in. Please check the backend connection.';
        Alert.alert('Sign in failed', message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Logo + header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../trickee_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSubtitle}>
            Sign in to your fleet account
          </Text>
        </View>

        {/* Form card */}
        <GlassCard style={styles.formCard} cornerRadius={22}>
          <View style={styles.formContent}>
            <TrickeeInput
              title="Email Address"
              placeholder="john.doe@fleet.com"
              value={email}
              onChangeText={text => {
                setEmail(text);
                if (emailError) {
                  setEmailError(null);
                }
              }}
              icon="email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={emailError}
            />
            <View>
              <TrickeeInput
                title="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={text => {
                  setPassword(text);
                  if (passwordError) {
                    setPasswordError(null);
                  }
                }}
                icon="lock"
                secureTextEntry
                showPasswordToggle
                error={passwordError}
              />
              <TouchableOpacity style={styles.forgotButton}>
                <Text style={styles.forgotText}>FORGOT PASSWORD?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </GlassCard>

        {/* Sign In button */}
        <TrickeeButton
          label="Sign in"
          onPress={handleSignIn}
          disabled={!isFormValid}
          loading={loading}
          style={styles.signInButton}
        />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() =>
              Alert.alert(
                'Apple login',
                'Apple/Firebase sign-in is supported by the backend but needs the native client SDK + credentials. The pilot uses email & password.',
              )
            }>
            <Icon name="apple" size={18} color={Colors.white} />
            <Text style={styles.socialText}>Apple</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() =>
              Alert.alert(
                'Google login',
                'Google/Firebase sign-in is supported by the backend but needs the native client SDK + credentials. The pilot uses email & password.',
              )
            }>
            <Icon name="google" size={18} color={Colors.white} />
            <Text style={styles.socialText}>Google</Text>
          </TouchableOpacity>
        </View>

        {/* Demo logins — local pilot only */}
        {SHOW_DEMO_LOGINS && DEMO_LOGINS.length > 0 && (
          <View style={styles.demoBlock}>
            <Text style={styles.demoLabel}>QUICK DEMO LOGIN</Text>
            <View style={styles.demoRow}>
              {DEMO_LOGINS.map(cred => (
                <TouchableOpacity
                  key={cred.email}
                  style={styles.demoChip}
                  onPress={() => {
                    setEmail(cred.email);
                    setPassword(cred.password);
                    setEmailError(null);
                    setPasswordError(null);
                  }}>
                  <Text style={styles.demoChipText}>{cred.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Trickee?</Text>
          <TouchableOpacity onPress={onSignUp}>
            <Text style={styles.footerLink}>Create account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ============ SIGN UP VIEW ============
interface SignUpViewProps {
  onSignIn: () => void;
}

const SignUpView: React.FC<SignUpViewProps> = ({onSignIn}) => {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 fields
  const [driverId, setDriverId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Errors
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [driverIdError, setDriverIdError] = useState<string | null>(null);
  const [vehiclePlateError, setVehiclePlateError] = useState<string | null>(
    null,
  );
  const [licenceError, setLicenceError] = useState<string | null>(null);

  const isStep1Valid =
    firstName.length > 0 &&
    lastName.length > 0 &&
    email.includes('@') &&
    phone.length > 0 &&
    password.length >= 6;

  const isStep2Valid =
    driverId.length > 0 &&
    vehiclePlate.length > 0 &&
    licenceNumber.length > 0 &&
    agreedToTerms;

  const getPasswordStrength = () => {
    if (password.length === 0) {
      return {label: '', color: 'transparent', segments: 0};
    }
    if (password.length < 6) {
      return {label: 'Weak password', color: Colors.red, segments: 1};
    }
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasDigits = /\d/.test(password);
    const hasSpecials = /[!@#$%^&*()_+{}|:<>?]/.test(password);
    if (hasLetters && hasDigits && hasSpecials && password.length >= 8) {
      return {label: 'Strong password', color: Colors.greenAccent, segments: 4};
    }
    if (hasLetters && hasDigits) {
      return {
        label: 'Medium password',
        color: Colors.trickeeYellow,
        segments: 3,
      };
    }
    return {label: 'Weak password', color: Colors.red, segments: 1};
  };

  const handleStep1 = () => {
    let hasError = false;
    if (!firstName) {
      setFirstNameError('First Name is required');
      hasError = true;
    }
    if (!lastName) {
      setLastNameError('Last Name is required');
      hasError = true;
    }
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email');
      hasError = true;
    }
    if (!phone) {
      setPhoneError('Phone Number is required');
      hasError = true;
    }
    if (password.length < 6) {
      setPasswordError('Password must be 6+ characters');
      hasError = true;
    }
    if (!hasError) {
      setStep(2);
    }
  };

  const handleStep2 = async () => {
    let hasError = false;
    if (!driverId) {
      setDriverIdError('Driver ID is required');
      hasError = true;
    }
    if (!vehiclePlate) {
      setVehiclePlateError('Vehicle Plate is required');
      hasError = true;
    }
    if (!licenceNumber) {
      setLicenceError('Licence Number is required');
      hasError = true;
    }
    if (!hasError && agreedToTerms) {
      try {
        // The backend access-request contract accepts email, full_name,
        // requested_role and a vehicle hint. We send the assigned plate as the
        // vehicle hint; the internal driver id / licence are captured by the
        // operator during approval.
        await api.accessRequest({
          email: email.trim().toLowerCase(),
          full_name: `${firstName} ${lastName}`.trim(),
          requested_role: 'driver',
          requested_vehicle_id: vehiclePlate.trim() || undefined,
        });
        Alert.alert(
          'Request sent',
          'Your workspace access request was sent to Trickee. An operator will finish setting up your driver account and assigned vehicle.',
          [{text: 'OK', onPress: onSignIn}],
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to submit access request.';
        Alert.alert('Request failed', message);
      }
    }
  };

  const strength = getPasswordStrength();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}>
      {/* Top nav bar */}
      <View style={styles.signUpHeader}>
        <TouchableOpacity
          onPress={() => (step === 2 ? setStep(1) : onSignIn())}
          style={styles.backButton}>
          <Icon name="chevron-left" size={20} color={Colors.trickeeYellow} />
          <Text style={styles.backText}>{step === 2 ? 'Back' : 'Sign in'}</Text>
        </TouchableOpacity>
        <View style={styles.driverBadge}>
          <Text style={styles.driverBadgeText}>DRIVER</Text>
        </View>
      </View>

      {/* Title row */}
      <View style={styles.signUpTitleRow}>
        <View style={styles.signUpTitleLeft}>
          <Text style={styles.signUpTitle}>Driver registration</Text>
          <Text style={styles.signUpStep}>STEP {step} OF 2</Text>
        </View>
        <View style={styles.miniLogo}>
          <Image
            source={require('../trickee_logo.png')}
            style={styles.miniLogoImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.signUpScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <GlassCard style={styles.formCard} cornerRadius={22}>
            <View style={styles.formContent}>
              <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>
              <View style={styles.nameRow}>
                <View style={styles.halfInput}>
                  <TrickeeInput
                    title="First Name"
                    placeholder="John"
                    value={firstName}
                    onChangeText={t => {
                      setFirstName(t);
                      setFirstNameError(null);
                    }}
                    icon="account"
                    error={firstNameError}
                  />
                </View>
                <View style={styles.halfInput}>
                  <TrickeeInput
                    title="Last Name"
                    placeholder="Doe"
                    value={lastName}
                    onChangeText={t => {
                      setLastName(t);
                      setLastNameError(null);
                    }}
                    icon="account"
                    error={lastNameError}
                  />
                </View>
              </View>
              <TrickeeInput
                title="Email Address"
                placeholder="john.doe@fleet.com"
                value={email}
                onChangeText={t => {
                  setEmail(t);
                  setEmailError(null);
                }}
                icon="email"
                keyboardType="email-address"
                autoCapitalize="none"
                error={emailError}
              />
              <TrickeeInput
                title="Phone Number"
                placeholder="98765 43210"
                value={phone}
                onChangeText={t => {
                  setPhone(t);
                  setPhoneError(null);
                }}
                icon="phone"
                keyboardType="phone-pad"
                error={phoneError}
              />
              <View>
                <TrickeeInput
                  title="Password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={t => {
                    setPassword(t);
                    setPasswordError(null);
                  }}
                  icon="lock"
                  secureTextEntry
                  showPasswordToggle
                  error={passwordError}
                />
                {password.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBar}>
                      {[0, 1, 2, 3].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.strengthSegment,
                            {
                              backgroundColor:
                                i < strength.segments
                                  ? strength.color
                                  : 'rgba(255,255,255,0.06)',
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text
                      style={[styles.strengthLabel, {color: strength.color}]}>
                      {strength.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.formCard} cornerRadius={22}>
            <View style={styles.formContent}>
              <Text style={styles.sectionLabel}>VEHICLE & LICENCE DETAILS</Text>
              <TrickeeInput
                title="Internal Driver ID"
                placeholder="EMP-2024-88"
                value={driverId}
                onChangeText={t => {
                  setDriverId(t);
                  setDriverIdError(null);
                }}
                icon="card-account-details"
                error={driverIdError}
              />
              <TrickeeInput
                title="Assigned Vehicle Plate"
                placeholder="KA 01 EV 1234"
                value={vehiclePlate}
                onChangeText={t => {
                  setVehiclePlate(t);
                  setVehiclePlateError(null);
                }}
                icon="car"
                error={vehiclePlateError}
              />
              <TrickeeInput
                title="Driving Licence Number"
                placeholder="DL-1420110012345"
                value={licenceNumber}
                onChangeText={t => {
                  setLicenceNumber(t);
                  setLicenceError(null);
                }}
                icon="file-document"
                error={licenceError}
              />
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}>
                <Icon
                  name={
                    agreedToTerms ? 'checkbox-marked' : 'checkbox-blank-outline'
                  }
                  size={22}
                  color={
                    agreedToTerms ? Colors.trickeeYellow : Colors.secondaryText
                  }
                />
                <Text style={styles.termsText}>
                  I agree to the Terms of Service and Privacy Policy regarding
                  data telemetry and driver monitoring.
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        <TrickeeButton
          label={step === 1 ? 'Next step' : 'Create driver account'}
          onPress={step === 1 ? handleStep1 : handleStep2}
          disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
          icon={
            step === 1 ? (
              <Icon name="chevron-right" size={18} color={Colors.buttonText} />
            ) : undefined
          }
          style={styles.signInButton}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={onSignIn}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Sign In
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 202, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 202, 32, 0.2)',
    marginTop: 20,
  },
  logoImage: {
    width: '65%',
    height: '65%',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.secondaryText,
  },
  formCard: {
    marginBottom: 24,
  },
  formContent: {
    padding: 20,
    gap: 20,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.trickeeYellow,
    letterSpacing: 1,
  },
  signInButton: {
    marginBottom: 20,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 1.5,
    paddingHorizontal: 10,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  // Demo logins
  demoBlock: {
    marginBottom: 20,
    gap: 8,
  },
  demoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  demoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  demoChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 202, 32, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 202, 32, 0.3)',
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.trickeeYellow,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 16,
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 15,
    color: Colors.secondaryText,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.trickeeYellow,
  },

  // Sign Up specific
  signUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: Colors.trickeeYellow,
  },
  driverBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(51, 204, 128, 0.4)',
    backgroundColor: 'rgba(13, 38, 26, 0.4)',
  },
  driverBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.greenAccent,
  },
  signUpTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  signUpTitleLeft: {
    gap: 4,
  },
  signUpTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
  },
  signUpStep: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 1.5,
  },
  miniLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 202, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLogoImage: {
    width: '60%',
    height: '60%',
  },
  signUpScroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  strengthContainer: {
    marginTop: 8,
    gap: 6,
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 6,
  },
  strengthSegment: {
    flex: 1,
    height: 5,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
});

export default AuthScreen;
