/**
 * @typedef {object} LogoMotionFrame
 * @property {number} scale
 * @property {number} waveDraw
 * @property {number} waveOpacity
 * @property {number} routeDraw
 * @property {number} routeOpacity
 * @property {number} logoOpacity
 * @property {number} celebration
 */

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothStep(start, end, value) {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
}

function precise(value) {
  return Number(value.toFixed(4));
}

/** @param {number} scrollProgress @returns {LogoMotionFrame} */
export function getLogoMotionFrame(scrollProgress) {
  const progress = clamp(scrollProgress);
  const scaleProgress = smoothStep(0.12, 1, progress);

  return {
    scale: precise(1 + scaleProgress * 0.45),
    waveDraw: precise(smoothStep(0, 0.18, progress)),
    waveOpacity: precise(1 - smoothStep(0.22, 0.52, progress)),
    routeDraw: precise(smoothStep(0.22, 0.66, progress)),
    routeOpacity: precise(smoothStep(0.18, 0.38, progress) * (1 - 0.18 * smoothStep(0.82, 1, progress))),
    logoOpacity: precise(smoothStep(0.56, 0.76, progress)),
    celebration: precise(smoothStep(0.72, 1, progress)),
  };
}
