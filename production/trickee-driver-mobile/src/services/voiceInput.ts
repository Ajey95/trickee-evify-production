import {PermissionsAndroid, Platform} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  OutputFormatAndroidType,
  type AudioSet,
} from 'react-native-audio-recorder-player';
import {api} from './api';

export const DEFAULT_VOICE_LOCALE = 'en-IN';
const DEFAULT_RECORDING_MS = 7000;

const recorder = new AudioRecorderPlayer();

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

function audioSettings(): AudioSet {
  return {
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioSourceAndroid: AudioSourceAndroidType.MIC,
    OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
    AudioEncodingBitRateAndroid: 64000,
    AudioSamplingRateAndroid: 16000,
    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.medium,
    AVFormatIDKeyIOS: AVEncodingOption.aac,
    AVNumberOfChannelsKeyIOS: 1,
    AVSampleRateKeyIOS: 16000,
  };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeFileUri(uri: string) {
  if (Platform.OS === 'android' && !uri.startsWith('file://')) {
    return `file://${uri}`;
  }
  return uri;
}

export async function recordAssistantVoiceClip(
  recordingMs = DEFAULT_RECORDING_MS,
) {
  if (!(await ensureMicrophonePermission())) {
    throw new Error('Microphone permission is required for voice input.');
  }

  let started = false;
  try {
    const startedUri = await recorder.startRecorder(
      undefined,
      audioSettings(),
      false,
    );
    started = true;
    await delay(recordingMs);
    const stoppedUri = await recorder.stopRecorder();
    recorder.removeRecordBackListener();
    return normalizeFileUri(stoppedUri || startedUri);
  } catch (error) {
    if (started) {
      await recorder.stopRecorder().catch(() => undefined);
      recorder.removeRecordBackListener();
    }
    throw new Error(errorMessage(error));
  }
}

export async function transcribeVoiceClip(token: string, uri: string) {
  const response = await api.transcribeAssistantAudio(token, {
    uri,
    name: 'trickee-voice.m4a',
    type: 'audio/mp4',
  });
  const transcript = response.text.trim();
  if (!transcript) {
    throw new Error('No speech was captured.');
  }
  return transcript;
}

export async function captureAndTranscribeVoice(
  token: string,
  recordingMs = DEFAULT_RECORDING_MS,
): Promise<string> {
  const uri = await recordAssistantVoiceClip(recordingMs);
  return transcribeVoiceClip(token, uri);
}
