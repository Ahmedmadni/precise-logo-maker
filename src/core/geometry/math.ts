import type { ArcGeometry, Bounds, Geometry, PathGeometry, Point } from "./types";

export const EPS = 1e-9;

export const deg2rad = (d: number): number => (d * Math.PI) / 180;
export const rad2deg = (r: number): number => (r * 180) / Math.PI;

export const pt = (x: number, y: number): Point => ({ x, y });

export const add = (a: Point, b: Point): Point => pt(a.x + b.x, a.y + b.y);
export const sub = (a: Point, b: Point): Point => pt(a.x - b.x, a.y - b.y);
export const scale = (a: Point, k: number): Point => pt(a.x * k, a.y * k);
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const len = (a: Point): number => Math.hypot(a.x, a.y);
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Point, b: Point): Point => pt((a.x + b.x) / 2, (a.y + b.y) / 2);

export const normalize = (a: Point): Point => {
  const l = len(a);
  return l < EPS ? pt(0, 0) : scale(a, 1 / l);
};

export const rotatePoint = (p: Point, angleDeg: number, origin: Point = pt(0, 0)): Point => {
  const a = deg2rad(angleDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return pt(origin.x + dx * c - dy * s, origin.y + dx * s + dy * c);
};

/** Normalize any angle in degrees into [0, 360). */
export const normalizeAngle = (deg: number): number => ((deg % 360) + 360) % 360;

export const pointOnCircle = (center: Point, radius: number, angleDeg: number): Point => {
  const a = deg2rad(angleDeg);
  return pt(center.x + radius * Math.cos(a), center.y + radius * Math.sin(a));
};

export const angleOf = (center: Point, p: Point): number =>
  normalizeAngle(rad2deg(Math.atan2(p.y - center.y, p.x - center.x)));

/** Sweep from start to end, always measured in the increasing-angle direction. */
export const arcSweep = (arc: ArcGeometry): number => {
  const raw = normalizeAngle(arc.endAngle - arc.startAngle);
  return raw === 0 && arc.endAngle !== arc.startAngle ? 360 : raw;
};

export const arcContainsAngle = (arc: ArcGeometry, angleDeg: number): boolean => {
  const sweep = arcSweep(arc);
  const rel = normalizeAngle(angleDeg - arc.startAngle);
  return rel <= sweep + 1e-7;
};

export const arcStartPoint = (arc: ArcGeometry): Point =>
  pointOnCircle(arc.center, arc.radius, arc.startAngle);

export const arcEndPoint = (arc: ArcGeometry): Point =>
  pointOnCircle(arc.center, arc.radius, arc.endAngle);

export const arcMidPoint = (arc: ArcGeometry): Point =>
  pointOnCircle(arc.center, arc.radius, arc.startAngle + arcSweep(arc) / 2);

/** Closest point on an infinite-free segment (clamped to the segment). */
export const closestPointOnSegment = (a: Point, b: Point, p: Point): Point => {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < EPS) return a;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return add(a, scale(ab, t));
};

export const closestPointOnCircle = (center: Point, radius: number, p: Point): Point => {
  const d = sub(p, center);
  if (len(d) < EPS) return pt(center.x + radius, center.y);
  return add(center, scale(normalize(d), radius));
};

/** Segments of a poly-path (adds the closing segment when `closed`). */
export const pathSegments = (points: Point[], closed: boolean): [Point, Point][] => {
  const out: [Point, Point][] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) out.push([a, b]);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (closed && first && last && points.length > 2) out.push([last, first]);
  return out;
};

/** Sample cubic edges for picking; straight legacy paths remain unchanged. */
export function sampledPathSegments(g: PathGeometry): [Point, Point][] {
  const edges = pathSegments(g.points, g.closed);
  if (!g.cubicSegments) return edges;
  // A two-anchor closed path may have a curved return edge.
  if (g.closed && g.points.length === 2 && g.cubicSegments[1]) {
    edges.push([g.points[1]!, g.points[0]!]);
  }
  return edges.flatMap(([a,b], i): [Point,Point][] => {
    const c = g.cubicSegments?.[i];
    if (!c || ![c.control1?.x, c.control1?.y, c.control2?.x, c.control2?.y].every(Number.isFinite)) return [[a,b]];
    const result: [Point,Point][] = [];
    let previous = a;
    for (let j=1;j<=24;j++) {
      const t=j/24, u=1-t;
      const next=pt(u*u*u*a.x+3*u*u*t*c.control1.x+3*u*t*t*c.control2.x+t*t*t*b.x,
        u*u*u*a.y+3*u*u*t*c.control1.y+3*u*t*t*c.control2.y+t*t*t*b.y);
      result.push([previous,next]); previous=next;
    }
    return result;
  });
}

export const closestPointOnGeometry = (g: Geometry, p: Point): Point => {
  switch (g.kind) {
    case "line":
      return closestPointOnSegment(g.a, g.b, p);
    case "circle":
      return closestPointOnCircle(g.center, g.radius, p);
    case "path": {
      let best: Point = g.points[0] ?? p;
      let bestD = Infinity;
      const edges=[...sampledPathSegments(g),...(g.closed?(g.holes??[]).flatMap(r=>pathSegments(r,true)):[])];
      for (const [a, b] of edges) {
        const q = closestPointOnSegment(a, b, p);
        const d = dist(q, p);
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
      return best;
    }
    case "arc": {
      const onCircle = closestPointOnCircle(g.center, g.radius, p);
      if (arcContainsAngle(g, angleOf(g.center, onCircle))) return onCircle;
      const s = arcStartPoint(g);
      const e = arcEndPoint(g);
      return dist(p, s) <= dist(p, e) ? s : e;
    }
  }
};

export const emptyBounds = (): Bounds => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
});

export const boundsAreValid = (b: Bounds): boolean =>
  Number.isFinite(b.minX) && Number.isFinite(b.maxX) && b.maxX >= b.minX;

export const expandBounds = (b: Bounds, p: Point): Bounds => ({
  minX: Math.min(b.minX, p.x),
  minY: Math.min(b.minY, p.y),
  maxX: Math.max(b.maxX, p.x),
  maxY: Math.max(b.maxY, p.y),
});

export const geometryBounds = (g: Geometry): Bounds => {
  switch (g.kind) {
    case "line":
      return expandBounds(expandBounds(emptyBounds(), g.a), g.b);
    case "path": {
      let b = g.points.reduce<Bounds>(expandBounds, emptyBounds());
      for(const ring of g.holes??[])for(const p of ring)b=expandBounds(b,p);
      // Bound the actual curve using roots of its coordinate derivatives.
      const edgeCount = g.closed && g.points.length > 1 ? g.points.length : Math.max(0, g.points.length - 1);
      for (let i = 0; i < edgeCount; i++) {
        const a = g.points[i]!, d = g.points[(i + 1) % g.points.length]!;
        const c = g.cubicSegments?.[i];
        if (!c || ![c.control1?.x, c.control1?.y, c.control2?.x, c.control2?.y].every(Number.isFinite)) continue;
        const p = c.control1, q = c.control2;
        const roots = (v0: number, v1: number, v2: number, v3: number): number[] => {
          const A = -v0 + 3*v1 - 3*v2 + v3;
          const B = 2*(v0 - 2*v1 + v2);
          const C = v1 - v0;
          const tolerance = Number.EPSILON * Math.max(Math.abs(A), Math.abs(B), Math.abs(C)) * 16;
          if (Math.abs(A) <= tolerance) return Math.abs(B) <= tolerance ? [] : [-C/B];
          const disc = B*B - 4*A*C;
          if (disc < 0) return [];
          const r = -0.5*(B + (B >= 0 ? 1 : -1)*Math.sqrt(disc));
          return r === 0 ? [-B/(2*A)] : [r/A, C/r];
        };
        for (const t of [...roots(a.x,p.x,q.x,d.x), ...roots(a.y,p.y,q.y,d.y)]) {
          if (!(t > 0 && t < 1)) continue;
          const u = 1-t;
          b = expandBounds(b, pt(
            u*u*u*a.x + 3*u*u*t*p.x + 3*u*t*t*q.x + t*t*t*d.x,
            u*u*u*a.y + 3*u*u*t*p.y + 3*u*t*t*q.y + t*t*t*d.y,
          ));
        }
      }
      return b;
    }
    case "circle":
      return {
        minX: g.center.x - g.radius,
        minY: g.center.y - g.radius,
        maxX: g.center.x + g.radius,
        maxY: g.center.y + g.radius,
      };
    case "arc": {
      let b = expandBounds(expandBounds(emptyBounds(), arcStartPoint(g)), arcEndPoint(g));
      for (const a of [0, 90, 180, 270]) {
        if (arcContainsAngle(g, a)) b = expandBounds(b, pointOnCircle(g.center, g.radius, a));
      }
      return b;
    }
  }
};

export const unionBounds = (list: Bounds[]): Bounds =>
  list.reduce<Bounds>(
    (acc, b) => ({
      minX: Math.min(acc.minX, b.minX),
      minY: Math.min(acc.minY, b.minY),
      maxX: Math.max(acc.maxX, b.maxX),
      maxY: Math.max(acc.maxY, b.maxY),
    }),
    emptyBounds(),
  );
