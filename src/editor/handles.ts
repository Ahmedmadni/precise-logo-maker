import { angleOf, dist, pointOnCircle, pt } from "../core/geometry/math";
import type { Geometry, Point } from "../core/geometry/types";
import { translateGeometry } from "../objects/transform";

export type HandleRole = "anchor" | "radius" | "center";

export interface Handle {
  /** Stable id within a single geometry. */
  id: string;
  point: Point;
  role: HandleRole;
  label: string;
}

/** Editable control points of a primitive, in world units. */
export const handlesOf = (g: Geometry): Handle[] => {
  if (g.kind === "line") {
    return [
      { id: "a", point: g.a, role: "anchor", label: "Start" },
      { id: "b", point: g.b, role: "anchor", label: "End" },
    ];
  }
  if (g.kind === "circle") {
    return [
      { id: "center", point: g.center, role: "center", label: "Center" },
      {
        id: "radius",
        point: pointOnCircle(g.center, g.radius, 0),
        role: "radius",
        label: "Radius",
      },
    ];
  }
  if (g.kind === "path") {
    return g.points.map((p, i) => ({
      id: `p${i}`,
      point: p,
      role: "anchor" as const,
      label: `Point ${i + 1}`,
    }));
  }
  return [
    { id: "center", point: g.center, role: "center", label: "Center" },
    {
      id: "start",
      point: pointOnCircle(g.center, g.radius, g.startAngle),
      role: "anchor",
      label: "Start angle",
    },
    {
      id: "end",
      point: pointOnCircle(g.center, g.radius, g.endAngle),
      role: "anchor",
      label: "End angle",
    },
  ];
};

export interface HandleConstraint {
  /** Angular increment in degrees used when the angle is locked. */
  angleStep: number;
  /** Distance quantisation step in world units (0 = off). */
  lengthStep: number;
}

const quantize = (v: number, step: number): number =>
  step > 0 ? Math.round(v / step) * step : v;

/**
 * Shift-style constraint for a handle drag.
 * - circle radius: keeps the handle on its axis and quantises the radius
 * - arc start/end: locks the angle to `angleStep` and keeps the radius fixed
 * - line / path points: locks the direction from the neighbouring point
 * - center handles: quantises the translation to `lengthStep`
 */
export const constrainHandle = (
  g: Geometry,
  id: string,
  p: Point,
  c: HandleConstraint,
): Point => {
  const lockFrom = (anchor: Point, keepRadius?: number): Point => {
    const radius = keepRadius ?? Math.max(quantize(dist(anchor, p), c.lengthStep), 1e-6);
    const angle = c.angleStep > 0 ? quantize(angleOf(anchor, p), c.angleStep) : angleOf(anchor, p);
    return pointOnCircle(anchor, radius, angle);
  };

  if (g.kind === "line") {
    if (id === "a") return lockFrom(g.b);
    if (id === "b") return lockFrom(g.a);
    return p;
  }
  if (g.kind === "path") {
    const index = Number(id.slice(1));
    const anchor = g.points[index - 1] ?? g.points[index + 1];
    return anchor ? lockFrom(anchor) : p;
  }
  if (id === "center") {
    return pt(
      g.center.x + quantize(p.x - g.center.x, c.lengthStep),
      g.center.y + quantize(p.y - g.center.y, c.lengthStep),
    );
  }
  if (g.kind === "circle") {
    // Radius handle stays on the 0° axis; only the radius changes.
    return pointOnCircle(g.center, Math.max(quantize(dist(g.center, p), c.lengthStep), 1e-6), 0);
  }
  // Arc start/end: lock the angle, keep the existing radius.
  return lockFrom(g.center, g.radius);
};

/** Move one handle to `p`, returning the resulting geometry (pure). */
export const applyHandle = (g: Geometry, id: string, p: Point): Geometry => {
  if (g.kind === "line") {
    if (id === "a") return { ...g, a: p };
    if (id === "b") return { ...g, b: p };
    return g;
  }
  if (g.kind === "path") {
    const index = Number(id.slice(1));
    if (!Number.isInteger(index) || index < 0 || index >= g.points.length) return g;
    return { ...g, points: g.points.map((q, i) => (i === index ? p : q)) };
  }
  if (id === "center") {
    return translateGeometry(g, p.x - g.center.x, p.y - g.center.y);
  }
  if (g.kind === "circle") {
    if (id === "radius") return { ...g, radius: Math.max(dist(g.center, p), 1e-6) };
    return g;
  }
  const radius = Math.max(dist(g.center, p), 1e-6);
  if (id === "start") return { ...g, radius, startAngle: angleOf(g.center, p) };
  if (id === "end") return { ...g, radius, endAngle: angleOf(g.center, p) };
  return g;
};

/** Closest handle within `tolerance` world units, or null. */
export const pickHandle = (
  g: Geometry,
  cursor: Point,
  tolerance: number,
): Handle | null => {
  let best: { h: Handle; d: number } | null = null;
  for (const h of handlesOf(g)) {
    const d = dist(h.point, cursor);
    if (d <= tolerance && (!best || d < best.d)) best = { h, d };
  }
  return best?.h ?? null;
};

export const handleCenter = (g: Geometry): Point => {
  if (g.kind === "line") return pt((g.a.x + g.b.x) / 2, (g.a.y + g.b.y) / 2);
  if (g.kind === "path") {
    const n = g.points.length || 1;
    const sum = g.points.reduce((acc, p) => pt(acc.x + p.x, acc.y + p.y), pt(0, 0));
    return pt(sum.x / n, sum.y / n);
  }
  return g.center;
};
