"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelSpeechRecognition } from "@/lib/speech-recognition-lifecycle.mjs";

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => Recognition;

type Options = {
  onTranscript: (transcript: string) => void;
  onStatus?: (message: string) => void;
  lang?: string;
};

function errorMessage(code?: string) {
  if (code === "not-allowed" || code === "service-not-allowed") return "Microphone permission was denied. Allow microphone access or type your question.";
  if (code === "no-speech") return "No speech was detected. Try again or type your question.";
  if (code === "audio-capture") return "No working microphone was found. Type your question instead.";
  if (code === "network") return "Voice recognition could not reach its service. Try again or type your question.";
  return "Voice capture stopped before a command was captured. Try again or type your question.";
}

export function useSpeechRecognition({ onTranscript, onStatus, lang = "en-IN" }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const callbacksRef = useRef({ onTranscript, onStatus });
  const generationRef = useRef(0);

  callbacksRef.current = { onTranscript, onStatus };

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setIsListening(false);
    setError("");
    cancelSpeechRecognition(recognition);
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) {
      stop();
      return;
    }

    const RecognitionApi = ((window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition);
    if (!RecognitionApi) {
      setIsSupported(false);
      const message = "Voice input is unavailable in this browser. Type your question instead.";
      setError(message);
      callbacksRef.current.onStatus?.(message);
      return;
    }

    const generation = ++generationRef.current;
    const recognition = new RecognitionApi();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (generation !== generationRef.current) return;
      setError("");
      setIsListening(true);
      callbacksRef.current.onStatus?.("Listening for your voice command...");
    };
    recognition.onresult = (event) => {
      if (generation !== generationRef.current) return;
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (transcript) {
        callbacksRef.current.onTranscript(transcript);
        callbacksRef.current.onStatus?.("Voice command captured. Review it, then send when ready.");
      } else {
        const message = errorMessage("no-speech");
        setError(message);
        callbacksRef.current.onStatus?.(message);
      }
    };
    recognition.onerror = (event) => {
      if (generation !== generationRef.current || event.error === "aborted") return;
      const message = errorMessage(event.error);
      setError(message);
      setIsListening(false);
      callbacksRef.current.onStatus?.(message);
    };
    recognition.onend = () => {
      if (generation !== generationRef.current) return;
      recognitionRef.current = null;
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      const message = "Voice input could not start. Try again or type your question.";
      setError(message);
      callbacksRef.current.onStatus?.(message);
    }
  }, [lang, stop]);

  useEffect(() => () => {
    generationRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    cancelSpeechRecognition(recognition);
  }, []);

  return { isListening, isSupported, error, start, stop, cancel };
}
