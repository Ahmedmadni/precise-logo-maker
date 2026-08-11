import {
  EPS,
  angleOf,
  arcContainsAngle,
  dist,
  normalize,
  pathSegments,
  pt,
  scale,
  sub,
} from "./math";
import type { ArcGeometry, CircleGeometry, Geometry, LineGeometry, Point } from "./types";

const onSegment = (a: Point, b: Point, p: Point): boolean => {
  const minX = Math.min(a.x, b.x) - 1e-7;
  const maxX = Math.max(a.x, b.x) + 1e-7;
  const minY = Math.min(a.y, b.y) - 1e-7;
  const maxY = Math.max(a.y, b.y) + 1e-7;
  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
};

export const lineLineIntersection = (l1: LineGeometry, l2: LineGeometry): Point[] => {
  const r = sub(l1.b, l1.a);
  const s = sub(l2.b, l2.a);
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < EPS) return [];
  const qp = sub(l2.a, l1.a);
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;
  if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return [];
  return [pt(l1.a.x + r.x * t, l1.a.y + r.y * t)];
};

export const lineCircleIntersection = (
  line: LineGeometry,
  circle: CircleGeometry,
): Point[] => {
  const d = sub(line.b, line.a);
  const f = sub(line.a, circle.center);
  const a = d.x * d.x + d.y * d.y;
  if (a < EPS) return [];
  const b = 2 * (f.x * d.x + f.y * d.y);
  const c = f.x * f.x + f.y * f.y - circle.radius * circle.radius;
  const disc = b * b - 4 * a * c;
  if (disc < -1e-9) return [];
  const sq = Math.sqrt(Math.max(0, disc));
  const ts = disc < 1e-9 ? [-b / (2 * a)] : [(-b - sq) / (2 * a), (-b + sq) / (2 * a)];
  return ts
    .filter((t) => t >= -1e-7 && t <= 1 + 1e-7)
    .map((t) => pt(line.a.x + d.x * t, line.a.y + d.y * t));
};

export const circleCircleIntersection = (
  c1: CircleGeometry,
  c2: CircleGeometry,
): Point[] => {
  const d = dist(c1.center, c2.center);
  if (d < EPS) return [];
  if (d > c1.radius + c2.radius + 1e-9) return [];
  if (d < Math.abs(c1.radius - c2.radius) - 1e-9) return [];
  const a = (c1.radius * c1.radius - c2.radius * c2.radius + d * d) / (2 * d);
  const h2 = c1.radius * c1.radius - a * a;
  const h = Math.sqrt(Math.max(0, h2));
  const dir = normalize(sub(c2.center, c1.center));
  const base = pt(c1.center.x + dir.x * a, c1.center.y + dir.y * a);
  if (h < 1e-7) return [base];
  const perp = pt(-dir.y, dir.x);
  return [
    pt(base.x + perp.x * h, base.y + perp.y * h),
    pt(base.x - perp.x * h, base.y - perp.y * h),
  ];
};

const asCircle = (g: CircleGeometry | ArcGeometry): CircleGeometry => ({
  kind: "circle",
  center: g.center,
  radius: g.radius,
});

const keepOnArc = (g: Geometry, points: Point[]): Point[] => {
  if (g.kind !== "arc") return points;
  return points.filter((p) => arcContainsAngle(g, angleOf(g.center, p)));
};

/** Intersections between any two supported primitives, filtered to real spans. */
export const intersectGeometry = (g1: Geometry, g2: Geometry): Point[] => {
  // Poly-paths are expanded into their segments.
  if (g1.kind === "path" || g2.kind === "path") {
    const expand = (g: Geometry): Geometry[] =>
      g.kind === "path"
        ? pathSegments(g.points, g.closed).map(([a, b]) => ({ kind: "line", a, b }) as Geometry)
        : [g];
    const out: Point[] = [];
    for (const a of expand(g1)) for (const b of expand(g2)) out.push(...intersectGeometry(a, b));
    return out;
  }

  const raw = ((): Point[] => {
    if (g1.kind === "line" && g2.kind === "line") return lineLineIntersection(g1, g2);
    if (g1.kind === "line" && g2.kind !== "line") return lineCircleIntersection(g1, asCircle(g2));
    if (g2.kind === "line" && g1.kind !== "line") return lineCircleIntersection(g2, asCircle(g1));
    if (g1.kind === "line" || g2.kind === "line") return [];
    return circleCircleIntersection(asCircle(g1), asCircle(g2));
  })();

  return keepOnArc(g2, keepOnArc(g1, raw));
};

/** Tangent points on a circle as seen from an external point. */
export const tangentPointsFromPoint = (
  circle: CircleGeometry,
  from: Point,
): Point[] => {
  const d = dist(from, circle.center);
  if (d <= circle.radius + 1e-9) return [];
  const a = (circle.radius * circle.radius) / d;
  const h = Math.sqrt(Math.max(0, circle.radius * circle.radius - a * a));
  const dir = normalize(sub(from, circle.center));
  const perp = pt(-dir.y, dir.x);
  const base = pt(circle.center.x + dir.x * a, circle.center.y + dir.y * a);
  return [
    pt(base.x + perp.x * h, base.y + perp.y * h),
    pt(base.x - perp.x * h, base.y - perp.y * h),
  ];
};

export const offsetAlong = (from: Point, dir: Point, amount: number): Point => {
  const n = normalize(dir);
  return pt(from.x + n.x * amount, from.y + n.y * amount);
};

export const midOfPoints = (points: Point[]): Point =>
  points.length === 0
    ? pt(0, 0)
    : scale(
        points.reduce((acc, p) => pt(acc.x + p.x, acc.y + p.y), pt(0, 0)),
        1 / points.length,
      );
