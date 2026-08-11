import { angleOf, dist, normalizeAngle, pt } from "../geometry/math";
import type { Geometry, Point } from "../geometry/types";

/**
 * Turns a shaky freehand stroke into clean geometry: the wobble is averaged
 * out, redundant samples are dropped, and a stroke that is really a straight
 * line or a circular arc is promoted to that primitive.
 */
export interface CleanOptions {
  /** Deviation allowed when dropping samples, in world units. */
  tolerance: number;
  /** Moving-average passes applied before simplifying. 0 disables smoothing. */
  smoothing: number;
  /** Recognise straight lines and circular arcs instead of keeping a polyline. */
  fitShapes: boolean;
}

export const DEFAULT_CLEAN: CleanOptions = {
  tolerance: 2.5,
  smoothing: 2,
  fitShapes: true,
};

/** Moving average over each interior sample; endpoints stay pinned. */
export const smoothPolyline = (points: Point[], passes: number): Point[] => {
  if (points.length < 3 || passes <= 0) return points;
  let current = points;
  for (let p = 0; p < passes; p += 1) {
    const next: Point[] = [current[0]!];
    for (let i = 1; i < current.length - 1; i += 1) {
      const a = current[i - 1]!;
      const b = current[i]!;
      const c = current[i + 1]!;
      next.push(pt((a.x + 2 * b.x + c.x) / 4, (a.y + 2 * b.y + c.y) / 4));
    }
    next.push(current[current.length - 1]!);
    current = next;
  }
  return current;
};

/** Perpendicular distance from `p` to the infinite line through `a` and `b`. */
const lineDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-9) return dist(p, a);
  return Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / l;
};

/** Ramer–Douglas–Peucker: keeps the corners, drops everything within tolerance. */
export const simplifyPath = (points: Point[], tolerance: number): Point[] => {
  if (points.length < 3 || tolerance <= 0) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let worst = -1;
    let worstIndex = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = lineDistance(points[i]!, points[start]!, points[end]!);
      if (d > worst) {
        worst = d;
        worstIndex = i;
      }
    }
    if (worst > tolerance && worstIndex > 0) {
      keep[worstIndex] = true;
      stack.push([start, worstIndex], [worstIndex, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

/** Largest deviation of the samples from the straight line between the ends. */
export const straightness = (points: Point[]): number => {
  const a = points[0];
  const b = points[points.length - 1];
  if (!a || !b) return Infinity;
  let worst = 0;
  for (const p of points) worst = Math.max(worst, lineDistance(p, a, b));
  return worst;
};

export interface CircleFit {
  center: Point;
  radius: number;
  /** Largest distance between a sample and the fitted circle. */
  error: number;
}

/**
 * Algebraic (Kåsa) least-squares circle through the samples. Returns null when
 * the samples are collinear or too few to define a circle.
 */
export const fitCircle = (points: Point[]): CircleFit | null => {
  const n = points.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;

  let suu = 0;
  let suv = 0;
  let svv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const p of points) {
    const u = p.x - mx;
    const v = p.y - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const b1 = (suuu + suvv) / 2;
  const b2 = (svvv + svuu) / 2;
  const uc = (b1 * svv - b2 * suv) / det;
  const vc = (b2 * suu - b1 * suv) / det;
  const center = pt(uc + mx, vc + my);
  const radius = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  let error = 0;
  for (const p of points) error = Math.max(error, Math.abs(dist(p, center) - radius));
  return { center, radius, error };
};

/** Total turning of the stroke in degrees, signed: positive = counter-clockwise. */
const signedSweep = (points: Point[], center: Point): number => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = angleOf(center, points[i - 1]!);
    const b = angleOf(center, points[i]!);
    let step = b - a;
    if (step > 180) step -= 360;
    if (step < -180) step += 360;
    total += step;
  }
  return total;
};

/**
 * Cleans a raw freehand stroke and picks the geometry that describes it best.
 * Falls back to a simplified polyline whenever no primitive fits.
 */
export const cleanStroke = (
  raw: Point[],
  options: CleanOptions = DEFAULT_CLEAN,
  closed = false,
): Geometry | null => {
  if (raw.length < 2) return null;
  const smoothed = smoothPolyline(raw, options.smoothing);
  const points = simplifyPath(smoothed, options.tolerance);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (points.length < 2) return null;

  if (!options.fitShapes) return { kind: "path", points, closed };

  const span = dist(first, last);
  const straightError = straightness(smoothed);
  // A stroke that never strays far from the line between its ends is a line.
  if (straightError <= Math.max(options.tolerance, span * 0.02)) {
    return { kind: "line", a: first, b: last };
  }

  const fit = fitCircle(smoothed);
  if (fit && fit.error <= Math.max(options.tolerance * 1.5, fit.radius * 0.05)) {
    const sweep = signedSweep(smoothed, fit.center);
    // Barely any turn: the circle is just a bowed straight line.
    if (Math.abs(sweep) <= 25) return { kind: "line", a: first, b: last };
    // A full loop back to the start is a circle.
    if (Math.abs(sweep) > 350) {
      return { kind: "circle", center: fit.center, radius: fit.radius };
    }
    // ArcGeometry always sweeps counter-clockwise from start to end.
    const startAngle = angleOf(fit.center, sweep >= 0 ? first : last);
    const endAngle = angleOf(fit.center, sweep >= 0 ? last : first);
    return {
      kind: "arc",
      center: fit.center,
      radius: fit.radius,
      startAngle: normalizeAngle(startAngle),
      endAngle: normalizeAngle(endAngle),
    };
  }

  return { kind: "path", points, closed };
};
