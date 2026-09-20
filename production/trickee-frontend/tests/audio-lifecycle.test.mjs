import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/marketing/JourneyChrome.tsx", import.meta.url), "utf8");

test("ambient mute disposes the captured audio graph", () => {
  assert.match(source, /const audio = audioRef\.current/);
  assert.match(source, /audioRef\.current = null/);
  assert.match(source, /disposeAudio\(audio/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => audioRef\.current\?\.context\.close/);
});

test("ambient audio reports unavailable and rejected startup", () => {
  assert.match(source, /AudioContext is unavailable/);
  assert.match(source, /Ambient sound could not start/);
  assert.match(source, /role="status"/);
});

test("a pending audio startup is owned before resume can race another toggle", () => {
  assert.ok(source.indexOf("audioRef.current = audio") < source.indexOf("await context.resume()"));
  assert.match(source, /audioRef\.current !== audio/);
});
