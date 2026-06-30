import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../constants/Colors';

type Props = {children: React.ReactNode};
type State = {error: Error | null};

/**
 * App-level error boundary. Catches render/lifecycle crashes in the tree so a
 * single bad screen never shows a white/blank screen to a pilot user — they get
 * a recoverable fallback with a "Try again" reset instead.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error) {
    // Surface to Metro/logcat for debugging; swap for a crash reporter later.

    console.error('[Trickee] Uncaught UI error:', error);
  }

  handleReset = () => this.setState({error: null});

  render() {
    const {error} = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Icon name="alert-decagram" size={40} color={Colors.trickeeYellow} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app hit an unexpected error. You can try again — your session is
          still active.
        </Text>
        {__DEV__ && (
          <ScrollView style={styles.devBox}>
            <Text style={styles.devText}>{error.message}</Text>
          </ScrollView>
        )}
        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
          <Icon name="refresh" size={18} color={Colors.buttonText} />
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.appBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 202, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {fontSize: 20, fontWeight: '700', color: Colors.white},
  subtitle: {
    fontSize: 14,
    color: Colors.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
  devBox: {
    maxHeight: 140,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    padding: 12,
  },
  devText: {fontSize: 11, color: Colors.redSoft, fontFamily: 'monospace'},
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: Colors.trickeeYellow,
    marginTop: 8,
  },
  buttonText: {fontSize: 15, fontWeight: '700', color: Colors.buttonText},
});

export default ErrorBoundary;
