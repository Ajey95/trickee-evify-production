import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const floatingChat = readFileSync(new URL("../components/intelligence/FloatingIntelligenceChat.tsx", import.meta.url), "utf8");
const aiPage = readFileSync(new URL("../app/(dashboard)/ai/page.tsx", import.meta.url), "utf8");

test("floating intelligence uses authenticated backend context and never fabricates a reply", () => {
  assert.match(floatingChat, /useAuth\(\)/);
  assert.match(floatingChat, /api\.assistant\.message/);
  assert.match(floatingChat, /driver_id/);
  assert.match(floatingChat, /vehicle_id/);
  assert.doesNotMatch(floatingChat, /buildMockReply|TRK-204|Rohith/);
});

test("both voice entry points share the owned speech-recognition lifecycle", () => {
  assert.match(floatingChat, /useSpeechRecognition/);
  assert.match(aiPage, /useSpeechRecognition/);
  assert.doesNotMatch(floatingChat, /new SpeechRecognition/);
  assert.doesNotMatch(aiPage, /new SpeechRecognition/);
});

test("voice transcripts remain editable before an assistant request", () => {
  assert.doesNotMatch(floatingChat, /sendMessage\(transcript\)/);
  assert.match(floatingChat, /onTranscript:\s*setInput/);
  assert.match(aiPage, /onTranscript:/);
});
