const JOURNEY_TARGET_IDS = new Set([
  "ping",
  "signal-gap",
  "predict",
  "prie",
  "ride",
  "trust",
  "field-notes",
  "contact",
]);

export const MOTION_REEL_TARGETS = Object.freeze({
  "Read the road": "#ping",
  "Move as one": "#trust",
  "See every signal": "#signal-gap",
  "Predict the next mile": "#predict",
  "Arrive with confidence": "#ride",
});

export function getJourneyTargetId(href) {
  if (typeof href !== "string" || !href.startsWith("#")) return null;
  const id = href.slice(1);
  return JOURNEY_TARGET_IDS.has(id) ? id : null;
}
