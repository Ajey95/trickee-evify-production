import assert from 'node:assert/strict';
import test from 'node:test';
import { getLogoIntroPlan, getTextMotionPlan } from '../lib/intro-motion.mjs';

test('custom logo resolves fully and holds before the site opens', () => {
  const plan = getLogoIntroPlan();
  assert.ok(plan.logoResolvedAt + .8 <= plan.revealAt);
  assert.ok(plan.revealAt + plan.exitDuration < plan.watchdogMs / 1000);
  assert.equal(plan.reducedMotion, false);
});

test('reduced motion keeps the complete brand visible and gives immediate access', () => {
  const plan = getLogoIntroPlan(true);
  assert.equal(plan.logoResolvedAt, 0);
  assert.equal(plan.exitDuration, 0);
  assert.ok(plan.revealAt <= 1);
});

test('text motion remains visible long enough and fits its reserved movement space', () => {
  for (const width of [320, 390, 768, 1280, 1920]) {
    const plan = getTextMotionPlan(width);
    assert.ok(plan.duration >= 1.2);
    assert.ok(plan.stagger >= .02);
    assert.ok(plan.drift > 0 && plan.drift < plan.safeInset);
    assert.ok(plan.risePercent > 30 && plan.risePercent < 100);
  }
});
