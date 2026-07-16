import Tts from 'react-native-tts';

let configured = false;

async function configureTts() {
  if (configured) {
    return;
  }
  await Tts.getInitStatus();
  await Tts.setDucking(true).catch(() => undefined);
  await Tts.setDefaultRate(0.48, true).catch(() => undefined);
  await Tts.setDefaultPitch(1).catch(() => undefined);
  await Tts.setDefaultLanguage('en-IN').catch(() =>
    Tts.setDefaultLanguage('en-US').catch(() => undefined),
  );
  configured = true;
}

export async function speakAssistantReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  try {
    await configureTts();
    await Tts.stop();
    Tts.speak(trimmed);
  } catch {
    // TTS is a convenience layer; the chat text remains the source of truth.
  }
}

export async function stopAssistantSpeech() {
  await Tts.stop().catch(() => undefined);
}
