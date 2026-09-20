import assert from "node:assert/strict";
import test from "node:test";

test("journey links resolve only to supported page sections", async () => {
  let navigation;
  try {
    navigation = await import("../lib/journey-navigation.mjs");
  } catch {
    navigation = undefined;
  }

  assert.equal(navigation?.getJourneyTargetId("#predict"), "predict");
  assert.equal(navigation?.getJourneyTargetId("#trust"), "trust");
  assert.equal(navigation?.getJourneyTargetId("/fleet"), null);
  assert.equal(navigation?.getJourneyTargetId("#unknown"), null);
});

test("motion reel cards map to their matching journey sections", async () => {
  let navigation;
  try {
    navigation = await import("../lib/journey-navigation.mjs");
  } catch {
    navigation = undefined;
  }

  assert.deepEqual(navigation?.MOTION_REEL_TARGETS, {
    "Read the road": "#ping",
    "Move as one": "#trust",
    "See every signal": "#signal-gap",
    "Predict the next mile": "#predict",
    "Arrive with confidence": "#ride",
  });
});
