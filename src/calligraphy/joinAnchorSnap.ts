import type { LetteringItem } from "./model";
import { getJoinAnchor, outlineContours, type JoinSide } from "./contourComposer";
import { selectJoiningContour } from "./joinAnchorGeometry";
import { parseOutline } from "./pathEditor";

type Point = { x: number; y: number };
export interface SnappedJoinAnchor {
  point: Point;
  distance: number;
  contourIndex: number;
}
const interpolate = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
});
const squaredDistance = (a: Point, b: Point) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const finite = (point: Point) =>
  Number.isFinite(point.x) && Number.isFinite(point.y) &&
  Math.max(Math.abs(point.x), Math.abs(point.y)) < 100_000;

/** Project onto a line segment, including Z's closing edge. */
function closestLine(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 <= 1e-12 ? 0 : Math.max(0, Math.min(1,
    ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return interpolate(a, b, t);
}

/** Evaluate a true quadratic or cubic Bézier point in font-local coordinates. */
function curvePoint(points: Point[], t: number): Point {
  let level = points;
  while (level.length > 1) {
    level = level.slice(0, -1).map((p, i) => interpolate(p, level[i + 1]!, t));
  }
  return level[0]!;
}

/**
 * Nearest point on a Bézier, refined on the original continuous curve.
 * Coarse sampling identifies candidate local minima; golden section then
 * refines each bracket. No SVG path conversion or change of outlines.
 */
function closestCurve(p: Point, points: Point[]): Point {
  const count = 32;
  const distances = Array.from({ length: count + 1 }, (_, i) =>
    squaredDistance(curvePoint(points, i / count), p));
  let bestPoint = points[0]!, bestError = distances[0]!;
  const tryPoint = (t: number) => {
    const candidate = curvePoint(points, t);
    const error = squaredDistance(candidate, p);
    if (error < bestError) { bestError = error; bestPoint = candidate; }
  };
  tryPoint(1);
  for (let i = 0; i <= count; i++) {
    if (i > 0 && distances[i]! > distances[i - 1]!) continue;
    if (i < count && distances[i]! > distances[i + 1]!) continue;
    let lo = Math.max(0, (i - 1) / count);
    let hi = Math.min(1, (i + 1) / count);
    const phi = (Math.sqrt(5) - 1) / 2;
    let u = hi - (hi - lo) * phi, v = lo + (hi - lo) * phi;
    let fu = squaredDistance(curvePoint(points, u), p);
    let fv = squaredDistance(curvePoint(points, v), p);
    for (let n = 0; n < 25; n++) {
      if (fu <= fv) {
        hi = v; v = u; fv = fu; u = hi - (hi - lo) * phi;
        fu = squaredDistance(curvePoint(points, u), p);
      } else {
        lo = u; u = v; fu = fv; v = lo + (hi - lo) * phi;
        fv = squaredDistance(curvePoint(points, v), p);
      }
    }
    tryPoint((lo + hi) / 2);
  }
  return bestPoint;
}

/** Snap to a single *chosen* glyph contour, respecting marked head/tail/join.
 * Dots/counters are ignored by the existing semantic selection unless they
 * are the only contours. Returns null for malformed or oversized paths.
 */
export function snapGlyphJoinAnchor(glyph: LetteringItem, side: JoinSide): SnappedJoinAnchor | null {
  if (glyph.kind !== "outline" || !glyph.pathData) return null;
  const desired = getJoinAnchor(glyph, side);
  if (!desired || !finite(desired)) return null;
  const candidate = selectJoiningContour(outlineContours(glyph.pathData), glyph.contourRoles, side);
  if (!candidate) return null;
  const contour = outlineContours(glyph.pathData)[candidate.contourIndex];
  if (!contour) return null;
  const commands = parseOutline(contour.path);
  if (!commands || commands.length > 3000) return null;
  let cursor: Point = { x: 0, y: 0 };
  let origin: Point = { x: 0, y: 0 };
  let best: Point | null = null;
  let bestError = Infinity;
  const accept = (p: Point) => {
    if (!finite(p)) return;
    const error = squaredDistance(p, desired);
    if (error < bestError) { bestError = error; best = p; }
  };
  for (const cmd of commands) {
    const v = cmd.values;
    if (cmd.cmd === "M") {
      cursor = { x: v[0]!, y: v[1]! };
      origin = cursor;
      accept(cursor);
    } else if (cmd.cmd === "L" || cmd.cmd === "Z") {
      const end = cmd.cmd === "Z" ? origin : { x: v[0]!, y: v[1]! };
      accept(closestLine(desired, cursor, end));
      cursor = end;
    } else if (cmd.cmd === "Q" || cmd.cmd === "C") {
      const control1 = { x: v[0]!, y: v[1]! };
      const control2 = cmd.cmd === "C" ? { x: v[2]!, y: v[3]! } : null;
      const end = cmd.cmd === "C" ? { x: v[4]!, y: v[5]! } : { x: v[2]!, y: v[3]! };
      accept(closestCurve(desired, control2
        ? [cursor, control1, control2, end] : [cursor, control1, end]));
      cursor = end;
    }
  }
  if (!best || !Number.isFinite(bestError)) return null;
  const nearest: Point = best;
  return {
    point: { x: Number(nearest.x.toFixed(3)), y: Number(nearest.y.toFixed(3)) },
    distance: Math.sqrt(bestError),
    contourIndex: candidate.contourIndex,
  };
}
