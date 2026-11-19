import type { Point, PathGeometry } from "../geometry/types";

export type BrushPreset = "round" | "qalam" | "taper";
export interface BrushSettings {
  preset: BrushPreset;
  size: number;
  color: string;
  angle: number;
  pressure: boolean;
  smoothing: number;
}
export interface BrushSample extends Point { pressure: number }

export const DEFAULT_BRUSH: BrushSettings = {
  preset: "qalam", size: 18, color: "#d1a95e",
  angle: 40, pressure: true, smoothing: 0.28,
};

const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const valid = (s: BrushSample) => Number.isFinite(s.x) && Number.isFinite(s.y) &&
  Number.isFinite(s.pressure) && Math.abs(s.x) <= 100000 && Math.abs(s.y) <= 100000;


/**
 * Stroke-sampling helper used for both coalesced pointer events and the final
 * pointer-up position. The final point is preserved even if it falls within
 * the normal event throttling distance; otherwise a quick flick can end short.
 */
export function appendBrushSamples(
  previous: readonly BrushSample[],
  incoming: readonly BrushSample[],
  zoom: number,
  finish = false,
  maxSamples = 2800,
): BrushSample[] {
  if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isSafeInteger(maxSamples) ||
      maxSamples < 1) return [...previous];
  const result = previous.slice(0, maxSamples);
  for (let i = 0; i < incoming.length; i++) {
    const sample = incoming[i]!;
    if (!valid(sample)) continue;
    const last = result.at(-1);
    if (last && distance(last, sample) * zoom < 1.3) {
      if (finish && i === incoming.length - 1) result[result.length - 1] = sample;
      continue;
    }
    if (result.length === maxSamples) {
      if (finish && i === incoming.length - 1) result[maxSamples - 1] = sample;
      break;
    }
    result.push(sample);
  }
  return result;
}

export function brushPressure(pointerPressure: number, pointerType: string): number {
  // Browsers typically emit 0.5 for a mouse held down. Treat touch/mouse
  // as a medium-pressure stroke, not an absent or zero-pressure stylus.
  return pointerType === "pen" ? clamp(pointerPressure || 0.15, 0.08, 1) : 0.68;
}

export function brushIsValid(config: BrushSettings): boolean {
  return ["round", "qalam", "taper"].includes(config.preset) &&
    Number.isFinite(config.size) && config.size >= 1 && config.size <= 200 &&
    Number.isFinite(config.angle) && Math.abs(config.angle) <= 180 &&
    Number.isFinite(config.smoothing) && config.smoothing >= 0 && config.smoothing <= 0.9 &&
    /^#[0-9a-fA-F]{6}$/.test(config.color);
}

function smooth(samples: BrushSample[], amount: number): BrushSample[] {
  if (samples.length < 3 || amount === 0) return samples;
  return samples.map((sample, i) => {
    if (i === 0 || i === samples.length - 1) return sample;
    const left = samples[i - 1]!, right = samples[i + 1]!;
    return {
      x: sample.x * (1 - amount) + (left.x + right.x) * amount / 2,
      y: sample.y * (1 - amount) + (left.y + right.y) * amount / 2,
      pressure: sample.pressure * (1 - amount) + (left.pressure + right.pressure) * amount / 2,
    };
  });
}

/** Build a filled, closed vector silhouette. No raster brushes and no
 * runtime font dependency: every brush mark can be scaled and exported in SVG.
 * The round, reed-pen and tapered profiles all use the same point pipeline. */
export function vectorBrushOutline(raw: BrushSample[], settings: BrushSettings): PathGeometry | null {
  if (!brushIsValid(settings) || raw.length < 1 || raw.length > 3000 ||
    raw.some((sample) => !valid(sample))) return null;
  const clean: BrushSample[] = [];
  for (const sample of raw) {
    if (!clean.length || distance(sample, clean[clean.length - 1]!) > 0.15) clean.push(sample);
  }
  if (!clean.length) return null;

  const pressed = (sample: BrushSample) => settings.pressure
    ? (0.3 + 0.7 * clamp(sample.pressure, 0.08, 1)) : 1;
  const point = clean[0]!;
  if (clean.length === 1) {
    const radius = settings.size * pressed(point) / 2;
    if (settings.preset === "round") {
      const points = Array.from({ length: 20 }, (_, i) => {
        const t = 2 * Math.PI * i / 20;
        return { x: point.x + radius * Math.cos(t), y: point.y + radius * Math.sin(t) };
      });
      return { kind: "path", points, closed: true };
    }
    const angle = settings.angle * Math.PI / 180;
    const along = { x: Math.cos(angle), y: Math.sin(angle) };
    const across = { x: -along.y, y: along.x };
    if (settings.preset === "taper") {
      const r = radius * 0.65;
      return { kind: "path", closed: true, points: [
        { x: point.x + along.x * r, y: point.y + along.y * r },
        { x: point.x + across.x * r * 0.55, y: point.y + across.y * r * 0.55 },
        { x: point.x - along.x * r, y: point.y - along.y * r },
        { x: point.x - across.x * r * 0.55, y: point.y - across.y * r * 0.55 },
      ] };
    }
    // A chisel makes a short angled nib imprint rather than a round dot.
    const thin = Math.max(0.2, radius * 0.22);
    const points = [
      [radius, thin * 0.55], [radius * 0.82, thin], [-radius * 0.82, thin], [-radius, thin * 0.55],
      [-radius, -thin * 0.55], [-radius * 0.82, -thin], [radius * 0.82, -thin], [radius, -thin * 0.55],
    ].map(([u, v]) => ({
      x: point.x + along.x * u! + across.x * v!,
      y: point.y + along.y * u! + across.y * v!,
    }));
    return { kind: "path", points, closed: true };
  }

  const samples = smooth(clean, settings.smoothing);
  const angle = settings.angle * Math.PI / 180;
  const nibEdge = { x: Math.cos(angle), y: Math.sin(angle) };
  const left: Point[] = [], right: Point[] = [];
  const last = samples.length - 1;
  const distances = samples.map((sample, i) =>
    i === 0 ? 0 : distance(sample, samples[i - 1]!));
  const cumulative: number[] = [];
  let strokeLength = 0;
  for (const d of distances) {
    strokeLength += d;
    cumulative.push(strokeLength);
  }
  if (strokeLength < 0.15) return vectorBrushOutline([samples[0]!], settings);

  samples.forEach((sample, i) => {
    const a = samples[Math.max(i - 1, 0)]!;
    const b = samples[Math.min(i + 1, last)]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / len, y: dx / len };
    let halfWidth = settings.size * pressed(sample) / 2;
    if (settings.preset === "qalam") {
      // The flat nib EDGE (not its normal) determines the cross-section:
      // moving perpendicular to the edge creates a thick stroke; moving
      // parallel creates a hairline. Previously the directions were reversed.
      halfWidth *= 0.18 + 0.82 * Math.abs(normal.x * nibEdge.x + normal.y * nibEdge.y);
    } else if (settings.preset === "taper") {
      const t = cumulative[i]! / strokeLength;
      halfWidth *= 0.16 + 0.84 * Math.pow(Math.sin(Math.PI * t), 0.5);
    }
    halfWidth = Math.max(0.22, halfWidth);
    left.push({ x: sample.x + normal.x * halfWidth, y: sample.y + normal.y * halfWidth });
    right.push({ x: sample.x - normal.x * halfWidth, y: sample.y - normal.y * halfWidth });
  });

  const outline = [...left, ...right.reverse()];
  if (outline.length < 4 || outline.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return null;
  return { kind: "path", points: outline, closed: true };
}
