/** Timing shared by the custom brand reveal and its regression checks. */
export function getLogoIntroPlan(reducedMotion = false) {
  return {
    reducedMotion,
    logoResolvedAt: reducedMotion ? 0 : 2.6,
    revealAt: reducedMotion ? 0.65 : 4.4,
    exitDuration: reducedMotion ? 0 : 0.65,
    watchdogMs: 8000,
  };
}

export function getTextMotionPlan(viewportWidth = 1280) {
  return {
    duration: 1.35,
    stagger: 0.026,
    risePercent: 65,
    drift: viewportWidth < 768 ? 5 : 10,
    safeInset: 16,
  };
}
