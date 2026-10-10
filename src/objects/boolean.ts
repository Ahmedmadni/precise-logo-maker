import polygonClipping, { type Geom } from "polygon-clipping";
const { union, difference, intersection, xor } = polygonClipping;
import { arcSweep, pointOnCircle } from "../core/geometry/math";
import type { Geometry, PathGeometry, Point } from "../core/geometry/types";

/** Illustrator-style pathfinder operations. */
export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

const CIRCLE_STEPS = 96;

/** Flatten any primitive into a closed ring of points (open shapes get closed). */
export const geometryToRing = (g: Geometry): Point[] => {
  switch (g.kind) {
    case "circle":
      return Array.from({ length: CIRCLE_STEPS }, (_, i) =>
        pointOnCircle(g.center, g.radius, (360 * i) / CIRCLE_STEPS),
      );
    case "arc": {
      const sweep = arcSweep(g);
      const steps = Math.max(8, Math.round((CIRCLE_STEPS * sweep) / 360));
      const pts = Array.from({ length: steps + 1 }, (_, i) =>
        pointOnCircle(g.center, g.radius, g.startAngle + (sweep * i) / steps),
      );
      // A wedge: closing through the centre keeps the arc's enclosed area.
      return [...pts, g.center];
    }
    case "line":
      return [g.a, g.b];
    case "path":
      return g.points;
  }
};

const toPolygon = (g: Geometry): Geom | null => {
  const ring = geometryToRing(g);
  if (ring.length < 3) return null;
  const coords = ring.map((p) => [p.x, p.y] as [number, number]);
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
  return [[coords]];
};

const RUNNERS = { union, subtract: difference, intersect: intersection, exclude: xor } as const;

/**
 * Combines shapes the way a pathfinder does. Every resulting ring (outer or
 * hole) comes back as its own closed path, in draw order.
 */
export const booleanGeometry = (shapes: Geometry[], op: BooleanOp): PathGeometry[] => {
  const polys = shapes.map(toPolygon).filter((p): p is Geom => p !== null);
  const [head, ...rest] = polys;
  if (!head || rest.length === 0) return [];
  let result;
  try {
    result = RUNNERS[op](head, ...rest);
  } catch {
    return [];
  }
  const out: PathGeometry[] = [];
  for (const poly of result) {
    for (const ring of poly) {
      const points = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
      if (points.length >= 3) out.push({ kind: "path", points, closed: true });
    }
  }
  return out;
};
