import {PermissionsAndroid, Platform} from 'react-native';
import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice';

export const DEFAULT_VOICE_LOCALE = 'en-IN';

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Voice input failed. Please try again.';
}

export async function ensureMicrophonePermission() {
  if (Platform.OS !== 'android') {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return true;
  }
  return (
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function captureVoiceOnce(
  locale = DEFAULT_VOICE_LOCALE,
  timeoutMs = 12000,
): Promise<string> {
  if (!(await ensureMicrophonePermission())) {
    throw new Error('Microphone permission is required for voice input.');
  }

  const available = await Voice.isAvailable().catch(() => 0);
  if (!available) {
    throw new Error('Speech recognition is not available on this device.');
  }

  await Voice.destroy().catch(() => undefined);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let latestTranscript = '';

    const cleanup = () => {
      Voice.onSpeechResults = () => undefined;
      Voice.onSpeechPartialResults = () => undefined;
      Voice.onSpeechError = () => undefined;
      Voice.onSpeechEnd = () => undefined;
      Voice.stop().catch(() => undefined);
    };

    const finish = (value?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      cleanup();
      const transcript = (value || latestTranscript).trim();
      if (transcript) {
        resolve(transcript);
      } else {
        reject(new Error('No speech was captured.'));
      }
    };

    const fail = (message: string) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(message));
    };

    const onResults = (event: SpeechResultsEvent) => {
      latestTranscript = event.value?.[0]?.trim() || latestTranscript;
      if (latestTranscript) {
        finish(latestTranscript);
      }
    };

    Voice.onSpeechResults = onResults;
    Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
      latestTranscript = event.value?.[0]?.trim() || latestTranscript;
    };
    Voice.onSpeechEnd = () => finish();
    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      fail(
        event.error?.message ||
          event.error?.code ||
          'Speech recognition stopped before any phrase was captured.',
      );
    };

    const timer = setTimeout(() => finish(), timeoutMs);

    Voice.start(locale).catch(error => fail(errorMessage(error)));
  });
}
