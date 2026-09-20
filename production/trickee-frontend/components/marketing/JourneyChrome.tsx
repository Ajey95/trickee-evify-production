"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, Volume2, VolumeX, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useJourneyStore } from "./journey-store";

const navigation = [
  ["Journey", "#ping"],
  ["Intelligence", "#predict"],
  ["PRIE", "#prie"],
  ["Results", "#trust"],
];

const chapters = [
  ["01", "Ping", "#ping"],
  ["02", "Signal gap", "#signal-gap"],
  ["03", "Predict", "#predict"],
  ["04", "PRIE", "#prie"],
  ["05", "Ride", "#ride"],
  ["06", "Trust", "#trust"],
];

type JourneyChromeProps = {
  onNavigate: (href: string) => boolean;
};

type AmbientAudio = { context: AudioContext; oscillator: OscillatorNode; gain: GainNode };

function disposeAudio(audio: AmbientAudio) {
  try { audio.oscillator.stop(); } catch { /* It may already be stopped. */ }
  try { audio.oscillator.disconnect(); } catch { /* It may already be disconnected. */ }
  try { audio.gain.disconnect(); } catch { /* It may already be disconnected. */ }
  if (audio.context.state !== "closed") void audio.context.close().catch(() => undefined);
}

export function JourneyChrome({ onNavigate }: JourneyChromeProps) {
  const chapter = useJourneyStore((state) => state.chapter);
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef<AmbientAudio | null>(null);
  const retiringAudioRef = useRef(new Set<AmbientAudio>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const retiringAudio = retiringAudioRef.current;
    return () => {
      mountedRef.current = false;
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) disposeAudio(audio);
      retiringAudio.forEach(disposeAudio);
      retiringAudio.clear();
    };
  }, []);

  const toggleSound = async () => {
    if (audioRef.current) {
      const audio = audioRef.current;
      audioRef.current = null;
      audio.gain.gain.setTargetAtTime(0, audio.context.currentTime, 0.08);
      retiringAudioRef.current.add(audio);
      window.setTimeout(() => {
        retiringAudioRef.current.delete(audio);
        disposeAudio(audio);
      }, 180);
      setSoundOn(false);
      return;
    }
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setAudioError("Ambient AudioContext is unavailable in this browser.");
      return;
    }
    let audio: AmbientAudio | null = null;
    try {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      audio = { context, oscillator, gain };
      oscillator.type = "sine"; oscillator.frequency.value = 54; gain.gain.value = 0.018;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      audioRef.current = audio;
      if (context.state === "suspended") await context.resume();
      if (!mountedRef.current || audioRef.current !== audio) {
        if (!retiringAudioRef.current.has(audio)) disposeAudio(audio);
        return;
      }
      setAudioError("");
      setSoundOn(true);
    } catch {
      if (audioRef.current === audio) audioRef.current = null;
      if (audio) disposeAudio(audio);
      if (mountedRef.current) {
        setSoundOn(false);
        setAudioError("Ambient sound could not start. Check browser audio permission and try again.");
      }
    }
  };

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (onNavigate(href)) event.preventDefault();
  };

  return (
    <>
      <a className="journey-skip-link" href="#content">Skip to content</a>
      <header className="journey-header" data-journey-header>
        <a href="#ping" className="journey-brand" aria-label="Trickee home" data-magnetic onClick={(event) => navigate(event, "#ping")}>
          <Image src="/trickee_logo.png" alt="Trickee" width={154} height={154} priority />
        </a>
        <nav className="journey-nav" aria-label="Primary navigation">
          {navigation.map(([label, href]) => <a key={href} href={href} data-magnetic onClick={(event) => navigate(event, href)}>{label}</a>)}
        </nav>
        <div className="journey-actions">
          <ThemeToggle className="journey-theme-toggle" />
          <button type="button" className="journey-icon-action" onClick={() => void toggleSound()} aria-label={soundOn ? "Mute ambient sound" : "Enable ambient sound"} aria-pressed={soundOn}>
            {soundOn ? <Volume2 /> : <VolumeX />}
          </button>
          {audioError ? <span role="status" className="sr-only">{audioError}</span> : null}
          <Link href="/login" className="journey-signin" data-magnetic>Sign in</Link>
          <Link href="/fleet" className="journey-primary-action" data-magnetic>Enter operations</Link>
          <button type="button" className="journey-menu-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        <span className="journey-page-progress" aria-hidden="true"><i data-page-progress /></span>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.nav className="journey-mobile-menu" aria-label="Mobile navigation" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {[...navigation, ["Sign in", "/login"], ["Enter operations", "/fleet"]].map(([label, href]) => (
              href.startsWith("#") ? <a key={href} href={href} onClick={(event) => { navigate(event, href); setMenuOpen(false); }}>{label}</a> : <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>
            ))}
          </motion.nav>
        ) : null}
      </AnimatePresence>

      <nav className="journey-rail" aria-label="Journey chapters">
        <span className="journey-rail-line" aria-hidden="true"><i style={{ transform: `scaleY(${(chapter + 1) / chapters.length})` }} /></span>
        {chapters.map(([number, label, href], index) => (
          <a key={href} href={href} className={chapter === index ? "is-active" : ""} aria-current={chapter === index ? "step" : undefined} onClick={(event) => navigate(event, href)}>
            <span>{number}</span><b>{label}</b>
          </a>
        ))}
      </nav>
      <div className="journey-cursor" data-journey-cursor aria-hidden="true"><i /></div>
    </>
  );
}
