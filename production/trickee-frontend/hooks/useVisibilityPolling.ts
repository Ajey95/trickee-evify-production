"use client";

import { useEffect, useRef } from "react";

type PollingOptions = {
  enabled?: boolean;
  intervalMs?: number;
  maxBackoffMs?: number;
  idleMs?: number;
  immediate?: boolean;
};

const MIN_POLL_INTERVAL_MS = 30_000;

export function useVisibilityPolling(
  callback: () => Promise<void> | void,
  {
    enabled = true,
    intervalMs = MIN_POLL_INTERVAL_MS,
    maxBackoffMs = 5 * 60_000,
    idleMs = 5 * 60_000,
    immediate = false,
  }: PollingOptions = {}
) {
  const callbackRef = useRef(callback);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let running = false;
    let failures = 0;
    let timer: number | null = null;
    const safeInterval = Math.max(intervalMs, MIN_POLL_INTERVAL_MS);

    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const isActive = () => Date.now() - lastActivityRef.current <= idleMs;
    const canPoll = () =>
      document.visibilityState === "visible" &&
      navigator.onLine !== false &&
      isActive();

    const schedule = (delayMs: number) => {
      clearTimer();
      if (!stopped) {
        timer = window.setTimeout(tick, delayMs);
      }
    };

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    const resumeIfReady = () => {
      markActive();
      if (canPoll()) schedule(0);
    };

    const tick = async () => {
      if (stopped) return;
      if (!canPoll()) {
        schedule(safeInterval);
        return;
      }
      if (running) {
        schedule(safeInterval);
        return;
      }

      running = true;
      try {
        await callbackRef.current();
        failures = 0;
        schedule(safeInterval);
      } catch {
        failures += 1;
        const backoff = Math.min(maxBackoffMs, safeInterval * 2 ** failures);
        const jitter = Math.floor(Math.random() * 1000);
        schedule(backoff + jitter);
      } finally {
        running = false;
      }
    };

    document.addEventListener("visibilitychange", resumeIfReady);
    window.addEventListener("online", resumeIfReady);
    window.addEventListener("focus", resumeIfReady);
    window.addEventListener("pointerdown", markActive, { passive: true });
    window.addEventListener("keydown", markActive);

    schedule(immediate ? 0 : safeInterval);

    return () => {
      stopped = true;
      clearTimer();
      document.removeEventListener("visibilitychange", resumeIfReady);
      window.removeEventListener("online", resumeIfReady);
      window.removeEventListener("focus", resumeIfReady);
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
    };
  }, [enabled, intervalMs, maxBackoffMs, idleMs, immediate]);
}
