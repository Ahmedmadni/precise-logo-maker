import {
  angleOf,
  arcEndPoint,
  arcMidPoint,
  arcStartPoint,
  closestPointOnGeometry,
  dist,
  mid,
  pointOnCircle,
} from "../geometry/math";
import { intersectGeometry } from "../geometry/intersections";
import type { Geometry, Point } from "../geometry/types";

export type SnapType =
  | "grid"
  | "intersection"
  | "endpoint"
  | "center"
  | "midpoint"
  | "quadrant"
  | "nearest";

export interface SnapCandidate {
  type: SnapType;
  point: Point;
  label: string;
}

export interface SnapResult extends SnapCandidate {
  distance: number;
}

export type SnapSettings = {
  enabled: boolean;
  types: Record<SnapType, boolean>;
  /** Highest priority first. */
  priority: SnapType[];
};

export const DEFAULT_SNAP_PRIORITY: SnapType[] = [
  "intersection",
  "endpoint",
  "center",
  "midpoint",
  "quadrant",
  "grid",
  "nearest",
];

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,
  types: {
    grid: true,
    intersection: true,
    endpoint: true,
    center: true,
    midpoint: true,
    quadrant: true,
    nearest: true,
  },
  priority: DEFAULT_SNAP_PRIORITY,
};

export const SNAP_LABEL: Record<SnapType, string> = {
  grid: "Grid",
  intersection: "Intersection",
  endpoint: "Endpoint",
  center: "Center",
  midpoint: "Midpoint",
  quadrant: "Quadrant",
  nearest: "On geometry",
};

export interface SnapInput {
  /** Cursor position in world coordinates. */
  cursor: Point;
  /** Snap tolerance expressed in world units (derived from a screen-pixel radius). */
  tolerance: number;
  gridPoints: Point[];
  /** Geometry contributed by grids — used for intersections. */
  gridGeometry: Geometry[];
  /** Geometry of real vector objects. */
  objectGeometry: Geometry[];
  settings: SnapSettings;
}

const featurePoints = (g: Geometry): SnapCandidate[] => {
  switch (g.kind) {
    case "line":
      return [
        { type: "endpoint", point: g.a, label: SNAP_LABEL.endpoint },
        { type: "endpoint", point: g.b, label: SNAP_LABEL.endpoint },
        { type: "midpoint", point: mid(g.a, g.b), label: SNAP_LABEL.midpoint },
      ];
    case "circle":
      return [
        { type: "center", point: g.center, label: SNAP_LABEL.center },
        ...[0, 90, 180, 270].map<SnapCandidate>((a) => ({
          type: "quadrant",
          point: pointOnCircle(g.center, g.radius, a),
          label: SNAP_LABEL.quadrant,
        })),
      ];
    case "arc":
      return [
        { type: "center", point: g.center, label: SNAP_LABEL.center },
        { type: "endpoint", point: arcStartPoint(g), label: SNAP_LABEL.endpoint },
        { type: "endpoint", point: arcEndPoint(g), label: SNAP_LABEL.endpoint },
        { type: "midpoint", point: arcMidPoint(g), label: SNAP_LABEL.midpoint },
      ];
  }
};

const near = (a: Point, b: Point, tol: number): boolean => dist(a, b) <= tol;

export const collectSnapCandidates = (input: SnapInput): SnapCandidate[] => {
  const { cursor, tolerance, settings } = input;
  const out: SnapCandidate[] = [];
  const push = (c: SnapCandidate) => {
    if (!settings.types[c.type]) return;
    if (!near(cursor, c.point, tolerance)) return;
    out.push(c);
  };

  for (const p of input.gridPoints) push({ type: "grid", point: p, label: SNAP_LABEL.grid });

  const all = [...input.gridGeometry, ...input.objectGeometry];
  for (const g of input.objectGeometry) featurePoints(g).forEach(push);

  if (settings.types.intersection) {
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const gi = all[i];
        const gj = all[j];
        if (!gi || !gj) continue;
        // Cheap rejection: skip pairs whose closest approach is far from the cursor.
        if (
          dist(closestPointOnGeometry(gi, cursor), cursor) > tolerance ||
          dist(closestPointOnGeometry(gj, cursor), cursor) > tolerance
        ) {
          continue;
        }
        for (const p of intersectGeometry(gi, gj)) {
          push({ type: "intersection", point: p, label: SNAP_LABEL.intersection });
        }
      }
    }
  }

  if (settings.types.nearest) {
    for (const g of input.objectGeometry) {
      push({ type: "nearest", point: closestPointOnGeometry(g, cursor), label: SNAP_LABEL.nearest });
    }
  }

  return out;
};

/** Resolve the best snap using the configured priority, then distance. */
export const resolveSnap = (input: SnapInput): SnapResult | null => {
  if (!input.settings.enabled) return null;
  const candidates = collectSnapCandidates(input);
  if (candidates.length === 0) return null;
  const rank = (t: SnapType): number => {
    const i = input.settings.priority.indexOf(t);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  let best: SnapResult | null = null;
  for (const c of candidates) {
    const result: SnapResult = { ...c, distance: dist(c.point, input.cursor) };
    if (!best) {
      best = result;
      continue;
    }
    const ra = rank(result.type);
    const rb = rank(best.type);
    if (ra < rb || (ra === rb && result.distance < best.distance)) best = result;
  }
  return best;
};

export const snapAngle = (center: Point, p: Point, stepDeg: number): number => {
  const a = angleOf(center, p);
  return Math.round(a / stepDeg) * stepDeg;
};
