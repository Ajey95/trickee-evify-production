import assert from "node:assert/strict";
import test from "node:test";

const motion = await import("../lib/journey-motion.mjs");

test("kinetic text normalizes whitespace while preserving punctuation and stable character order", async () => {
  const { tokenizeKineticText } = await import("../lib/kinetic-type.mjs");

  assert.deepEqual(tokenizeKineticText("  Route   intelligence.\nNow "), {
    label: "Route intelligence. Now",
    characterCount: 21,
    words: [
      {
        text: "Route",
        wordIndex: 0,
        chars: [
          { text: "R", charIndex: 0 },
          { text: "o", charIndex: 1 },
          { text: "u", charIndex: 2 },
          { text: "t", charIndex: 3 },
          { text: "e", charIndex: 4 },
        ],
      },
      {
        text: "intelligence.",
        wordIndex: 1,
        chars: [
          { text: "i", charIndex: 5 },
          { text: "n", charIndex: 6 },
          { text: "t", charIndex: 7 },
          { text: "e", charIndex: 8 },
          { text: "l", charIndex: 9 },
          { text: "l", charIndex: 10 },
          { text: "i", charIndex: 11 },
          { text: "g", charIndex: 12 },
          { text: "e", charIndex: 13 },
          { text: "n", charIndex: 14 },
          { text: "c", charIndex: 15 },
          { text: "e", charIndex: 16 },
          { text: ".", charIndex: 17 },
        ],
      },
      {
        text: "Now",
        wordIndex: 2,
        chars: [
          { text: "N", charIndex: 18 },
          { text: "o", charIndex: 19 },
          { text: "w", charIndex: 20 },
        ],
      },
    ],
  });
});

test("kinetic word drift stays inside the text safe area", () => {
  const shifts = Array.from({ length: 8 }, (_, index) => motion.getKineticWordShift?.(index));

  assert.deepEqual(shifts, [-3, 3, -3, 3, -3, 3, -3, 3]);
  assert.ok(shifts.every((shift) => Math.abs(shift) <= 3));
});

test("chapter frame clamps invalid progress and exposes a stable six-chapter index", () => {
  assert.deepEqual(motion.getChapterFrame(-4), { progress: 0, chapter: 0, local: 0 });
  assert.deepEqual(motion.getChapterFrame(Number.NaN), { progress: 0, chapter: 0, local: 0 });
  assert.deepEqual(motion.getChapterFrame(0.5), { progress: 0.5, chapter: 3, local: 0 });
  assert.deepEqual(motion.getChapterFrame(2), { progress: 1, chapter: 5, local: 1 });
});

test("prediction layers switch at quarter boundaries without skipping the final layer", () => {
  assert.deepEqual(motion.getLayerFrame(0), { index: 0, local: 0, label: "Elevation" });
  assert.deepEqual(motion.getLayerFrame(0.249), { index: 0, local: 0.996, label: "Elevation" });
  assert.deepEqual(motion.getLayerFrame(0.25), { index: 1, local: 0, label: "Weather" });
  assert.deepEqual(motion.getLayerFrame(0.5), { index: 2, local: 0, label: "Traffic" });
  assert.deepEqual(motion.getLayerFrame(1), { index: 3, local: 1, label: "Charging" });
});

test("ride frames crossfade through protected range, charging, and arrival", () => {
  assert.deepEqual(motion.getRideFrame(0), { index: 0, local: 0, label: "Protected range" });
  assert.deepEqual(motion.getRideFrame(0.5), { index: 1, local: 0.5, label: "Charging stop" });
  assert.deepEqual(motion.getRideFrame(1), { index: 2, local: 1, label: "Arrival confidence" });
});

test("metric formatting counts from zero and never exceeds the target", () => {
  assert.equal(motion.formatJourneyMetric(0, 142, " km"), "0 km");
  assert.equal(motion.formatJourneyMetric(0.5, 142, " km"), "71 km");
  assert.equal(motion.formatJourneyMetric(5, 92, "%"), "92%");
  assert.equal(motion.formatJourneyMetric(Number.NaN, 20, " Hz"), "0 Hz");
});

test("scene frame peaks route energy at chapter centers and transition energy at boundaries", () => {
  assert.deepEqual(motion.getSceneFrame(0), {
    chapter: 0,
    local: 0,
    transition: 1,
    routeEnergy: 0.55,
    telemetry: 0.612,
    camera: { travel: 0, drift: 0 },
  });
  assert.deepEqual(motion.getSceneFrame(1 / 12), {
    chapter: 0,
    local: 0.5,
    transition: 0,
    routeEnergy: 1,
    telemetry: 0.85,
    camera: { travel: 0.4167, drift: 0.35 },
  });
  assert.deepEqual(motion.getSceneFrame(0.25), {
    chapter: 1,
    local: 0.5,
    transition: 0,
    routeEnergy: 1,
    telemetry: 0.55,
    camera: { travel: 1.25, drift: 0.7 },
  });
});

test("scene frame clamps completion into the final calm-down state", () => {
  assert.deepEqual(motion.getSceneFrame(4), {
    chapter: 5,
    local: 1,
    transition: 1,
    routeEnergy: 0.55,
    telemetry: 0.252,
    camera: { travel: 5, drift: 0 },
  });
});
