export function cancelSpeechRecognition(recognition) {
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onend = null;
  recognition.onerror = null;
  recognition.onresult = null;
  try {
    recognition.abort();
  } catch {
    // The browser may already have ended the recognizer.
  }
}
