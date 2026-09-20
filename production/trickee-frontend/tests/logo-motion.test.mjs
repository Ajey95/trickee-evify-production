import test from "node:test";
import assert from "node:assert/strict";

async function loadLogoMotion() {
  try {
    return await import("../lib/logo-motion.mjs");
  } catch (error) {
    assert.fail(`The production logo-motion model must load: ${error instanceof Error ? error.message : String(error)}`);
  }
}

test("logo motion stays compact and bounded throughout the scroll", async () => {
  const { getLogoMotionFrame } = await loadLogoMotion();

  for (let step = 0; step <= 100; step += 1) {
    const frame = getLogoMotionFrame(step / 100);

    assert.ok(frame.scale >= 1 && frame.scale <= 1.45, `scale ${frame.scale} is outside the compact range`);
    for (const value of Object.values(frame)) {
      assert.ok(Number.isFinite(value), `motion value ${value} must be finite`);
    }
  }
});

test("logo motion reveals signal, route, brand, and celebration in sequence", async () => {
  const { getLogoMotionFrame } = await loadLogoMotion();
  const opening = getLogoMotionFrame(0);
  const signal = getLogoMotionFrame(0.2);
  const route = getLogoMotionFrame(0.5);
  const brand = getLogoMotionFrame(0.76);
  const finale = getLogoMotionFrame(1);

  assert.deepEqual(opening, {
    scale: 1,
    waveDraw: 0,
    waveOpacity: 1,
    routeDraw: 0,
    routeOpacity: 0,
    logoOpacity: 0,
    celebration: 0,
  });
  assert.ok(signal.waveDraw > 0.9, "the oscilloscope line should be substantially drawn first");
  assert.ok(route.routeDraw > 0.5, "the route should be visibly drawing by the midpoint");
  assert.ok(route.waveOpacity < signal.waveOpacity, "the waveform should yield to the route");
  assert.ok(brand.logoOpacity > 0.8, "the real Trickee logo should resolve late in the sequence");
  assert.equal(finale.celebration, 1);
  assert.equal(finale.scale, 1.45);
});

test("logo motion clamps out-of-range scroll progress", async () => {
  const { getLogoMotionFrame } = await loadLogoMotion();

  assert.deepEqual(getLogoMotionFrame(-2), getLogoMotionFrame(0));
  assert.deepEqual(getLogoMotionFrame(4), getLogoMotionFrame(1));
});
