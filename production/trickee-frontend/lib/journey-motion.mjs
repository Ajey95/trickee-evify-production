const PREDICTION_LAYERS = ["Elevation", "Weather", "Traffic", "Charging"];
const RIDE_STATES = ["Protected range", "Charging stop", "Arrival confidence"];
const CHAPTER_TELEMETRY = [0.85, 0.55, 1, 0.75, 0.65, 0.35];

export function clampJourneyProgress(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function precise(value) {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function segmentedFrame(value, labels) {
  const progress = clampJourneyProgress(value);
  if (progress === 1) {
    return { index: labels.length - 1, local: 1, label: labels.at(-1) };
  }

  const scaled = progress * labels.length;
  const index = Math.floor(scaled);
  return { index, local: precise(scaled - index), label: labels[index] };
}

export function getChapterFrame(value) {
  const progress = clampJourneyProgress(value);
  const chapterCount = 6;
  if (progress === 1) return { progress, chapter: chapterCount - 1, local: 1 };

  const scaled = progress * chapterCount;
  const chapter = Math.floor(scaled);
  return { progress: precise(progress), chapter, local: precise(scaled - chapter) };
}

export function getLayerFrame(value) {
  return segmentedFrame(value, PREDICTION_LAYERS);
}

export function getRideFrame(value) {
  return segmentedFrame(value, RIDE_STATES);
}

export function formatJourneyMetric(value, target, suffix = "") {
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const count = Math.round(clampJourneyProgress(value) * safeTarget);
  return `${count}${suffix}`;
}

export function getKineticWordShift(index) {
  return index % 2 ? 3 : -3;
}

export function getSceneFrame(value) {
  const progress = clampJourneyProgress(value);
  const frame = getChapterFrame(value);
  const centerEnergy = Math.sin(Math.PI * frame.local);
  const boundaryDistance = Math.abs(frame.local - 0.5) * 2;
  const density = CHAPTER_TELEMETRY[frame.chapter] ?? CHAPTER_TELEMETRY[0];

  return {
    chapter: frame.chapter,
    local: frame.local,
    transition: precise(boundaryDistance ** 2),
    routeEnergy: precise(0.55 + centerEnergy * 0.45),
    telemetry: precise(density * (0.72 + centerEnergy * 0.28)),
    camera: {
      travel: precise(progress * 5),
      drift: precise(Math.sin(progress * Math.PI * 2) * 0.7),
    },
  };
}
