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
  const clean = raw.filter((sample, i) =>
    i === 0 || distance(sample, raw[i - 1]!) > 0.15);
  if (!clean.length) return null;

  const pressed = (sample: BrushSample) => settings.pressure
    ? (0.3 + 0.7 * clamp(sample.pressure, 0.08, 1)) : 1;
  const point = clean[0]!;
  if (clean.length === 1) {
    const r = settings.size * pressed(point) / 2;
    const points = Array.from({ length: 20 }, (_, i) => {
      const t = 2 * Math.PI * i / 20;
      return { x: point.x + r * Math.cos(t), y: point.y + r * Math.sin(t) };
    });
    return { kind: "path", points, closed: true };
  }

  const samples = smooth(clean, settings.smoothing);
  const angle = settings.angle * Math.PI / 180;
  const fixedNib = { x: -Math.sin(angle), y: Math.cos(angle) };
  const left: Point[] = [], right: Point[] = [];
  const last = samples.length - 1;

  samples.forEach((sample, i) => {
    const a = samples[Math.max(i - 1, 0)]!;
    const b = samples[Math.min(i + 1, last)]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / len, y: dx / len };
    let halfWidth = settings.size * pressed(sample) / 2;
    if (settings.preset === "qalam") {
      // A broad pen gets wider or narrower as the tangent rotates relative
      // to the fixed reed nib, rather than painting a uniform round stroke.
      halfWidth *= 0.23 + 0.77 * Math.abs(normal.x * fixedNib.x + normal.y * fixedNib.y);
    } else if (settings.preset === "taper") {
      const t = i / last;
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
