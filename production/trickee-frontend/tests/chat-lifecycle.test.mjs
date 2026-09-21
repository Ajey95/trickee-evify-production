import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const speechLifecycle = await import("../lib/speech-recognition-lifecycle.mjs").catch(() => ({}));
const chatContext = await import("../lib/chat-context.mjs").catch(() => ({}));
const floatingChat = readFileSync(new URL("../components/intelligence/FloatingIntelligenceChat.tsx", import.meta.url), "utf8");

test("speech cancellation detaches callbacks before aborting capture", () => {
  assert.equal(typeof speechLifecycle.cancelSpeechRecognition, "function");
  const events = [];
  const recognition = {
    onstart: () => events.push("start"),
    onend: () => events.push("end"),
    onerror: () => events.push("error"),
    onresult: () => events.push("result"),
    abort() {
      events.push(this.onresult === null && this.onend === null ? "abort-detached" : "abort-live");
    },
  };

  speechLifecycle.cancelSpeechRecognition(recognition);

  assert.deepEqual(events, ["abort-detached"]);
  assert.equal(recognition.onstart, null);
  assert.equal(recognition.onerror, null);
});

test("chat context keeps an explicit compatible vehicle and rejects mismatched vehicles", () => {
  assert.equal(typeof chatContext.vehicleDriverId, "function");
  assert.equal(typeof chatContext.selectChatVehicleId, "function");
  const vehicles = [
    { id: "v1", latest: { driver_id: "d1" } },
    { id: "v2", latest_telemetry: { driver_id: "d1" } },
    { id: "v3", latest_driver: { id: "d2" } },
  ];

  assert.equal(chatContext.selectChatVehicleId(vehicles, "d1", "v2"), "v2");
  assert.equal(chatContext.selectChatVehicleId(vehicles, "d1", "v3"), "v1");
  assert.equal(chatContext.selectChatVehicleId(vehicles, "missing", "v2"), "");
  assert.deepEqual(chatContext.chatVehiclesForDriver(vehicles, "d2").map((vehicle) => vehicle.id), ["v3"]);
});

test("floating chat cancels capture on minimize and clear and locks context during requests", () => {
  assert.match(floatingChat, /voice\.cancel\(\);\s*setIsOpen\(false\)/);
  assert.match(floatingChat, /function changeDriverContext/);
  assert.match(floatingChat, /function changeVehicleContext/);
  assert.match(floatingChat, /disabled=\{isLoading\}/);
});
