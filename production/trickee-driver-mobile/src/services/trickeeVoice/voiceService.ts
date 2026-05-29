import Voice, {SpeechResultsEvent} from '@react-native-voice/voice';

export function listenForDestination(): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      Voice.removeAllListeners();
    };

    Voice.onSpeechResults = (event: SpeechResultsEvent) => {
      const transcript = event.value?.[0]?.trim();
      if (transcript) {
        cleanup();
        resolve(transcript);
      }
    };
    Voice.onSpeechError = error => {
      cleanup();
      reject(error);
    };
    Voice.start('en-IN').catch(error => {
      cleanup();
      reject(error);
    });
  });
}

export async function stopListening() {
  await Voice.stop();
  Voice.removeAllListeners();
}
