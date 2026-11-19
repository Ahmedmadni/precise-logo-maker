import { parseOutline } from "./pathEditor";

/** Exact axis-aligned bounds for M/L/Q/C font outlines, including extrema
 * between Bézier nodes. This is a lightweight local vector geometry helper:
 * SVG thumbnails and placement must not assume a hard-coded 100×100 box. */
export interface OutlineRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  midX: number;
  midY: number;
}

const epsilon = 1e-9;
const parameterRoots = (p0: number, p1: number, p2: number, p3?: number): number[] => {
  if (p3 === undefined) {
    const denominator = p0 - 2 * p1 + p2;
    const t = Math.abs(denominator) > epsilon ? (p0 - p1) / denominator : NaN;
    return t > 0 && t < 1 ? [t] : [];
  }
  // Cubic derivative: a*t^2 + b*t + c = 0.
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  if (Math.abs(a) < epsilon) {
    const t = Math.abs(b) > epsilon ? -c / b : NaN;
    return t > 0 && t < 1 ? [t] : [];
  }
  const determinant = b * b - 4 * a * c;
  if (determinant < 0) return [];
  const root = Math.sqrt(determinant);
  const ts = [(-b + root) / (2 * a), (-b - root) / (2 * a)];
  return ts.filter((t) => t > 0 && t < 1);
};

export function outlineBounds(path: string): OutlineRect | null {
  const segments = parseOutline(path);
  if (!segments || segments.length === 0) return null;
  let current = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const include = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  const quad = (p0: number, p1: number, p2: number, t: number) => {
    const s = 1 - t;
    return s * s * p0 + 2 * s * t * p1 + t * t * p2;
  };
  const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const s = 1 - t;
    return s ** 3 * p0 + 3 * s * s * t * p1 + 3 * s * t * t * p2 + t ** 3 * p3;
  };
  for (const segment of segments) {
    const v = segment.values;
    if (segment.cmd === "Z") {
      current = { ...start };
    } else if (segment.cmd === "M") {
      current = { x: v[0]!, y: v[1]! };
      start = { ...current };
      include(current.x, current.y);
    } else if (segment.cmd === "L") {
      current = { x: v[0]!, y: v[1]! };
      include(current.x, current.y);
    } else if (segment.cmd === "Q") {
      const to = { x: v[2]!, y: v[3]! };
      include(to.x, to.y);
      const ts = [...parameterRoots(current.x, v[0]!, to.x),
        ...parameterRoots(current.y, v[1]!, to.y)];
      for (const t of ts) include(
        quad(current.x, v[0]!, to.x, t), quad(current.y, v[1]!, to.y, t));
      current = to;
    } else if (segment.cmd === "C") {
      const to = { x: v[4]!, y: v[5]! };
      include(to.x, to.y);
      const ts = [...parameterRoots(current.x, v[0]!, v[2]!, to.x),
        ...parameterRoots(current.y, v[1]!, v[3]!, to.y)];
      for (const t of ts) include(
        cubic(current.x, v[0]!, v[2]!, to.x, t),
        cubic(current.y, v[1]!, v[3]!, to.y, t));
      current = to;
    }
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  const width = maxX - minX, height = maxY - minY;
  if (width < epsilon || height < epsilon || width > 100_000 || height > 100_000) return null;
  return { minX, minY, maxX, maxY, width, height,
    midX: (minX + maxX) / 2, midY: (minY + maxY) / 2 };
}

/** SVG path is plotted with positive font Y upwards, while SVG display Y is
 * downwards. A flipped <g> and an inverse-Y viewBox keep the exact proportions. */
export function outlinePreviewViewBox(path: string, marginFraction = 0.12): string {
  const rect = outlineBounds(path);
  if (!rect) return "0 0 100 100";
  const margin = Math.max(3, Math.max(rect.width, rect.height) * marginFraction);
  return [
    rect.minX - margin, -rect.maxY - margin,
    rect.width + 2 * margin, rect.height + 2 * margin,
  ].map((n) => Number(n.toFixed(3))).join(" ");
}
