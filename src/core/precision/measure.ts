import type { Unit } from "../coordinates/units";
import { formatUnit } from "../coordinates/units";
import { angleOf, dist, normalizeAngle, arcSweep } from "../geometry/math";
import type { Geometry, Point } from "../geometry/types";

export interface Measurement {
  a: Point;
  b: Point;
  length: number;
  angle: number;
  dx: number;
  dy: number;
}

export const measure = (a: Point, b: Point): Measurement => ({
  a,
  b,
  length: dist(a, b),
  angle: normalizeAngle(angleOf(a, b)),
  dx: b.x - a.x,
  dy: b.y - a.y,
});

export const formatLength = (px: number, unit: Unit): string => formatUnit(px, unit);

export const formatAngle = (deg: number): string => `${normalizeAngle(deg).toFixed(1)}°`;

/** Short human summary of a geometry used in readouts and the properties panel. */
export const describeGeometry = (g: Geometry, unit: Unit): string => {
  if (g.kind === "line") {
    const m = measure(g.a, g.b);
    return `L ${formatLength(m.length, unit)} · ${formatAngle(m.angle)}`;
  }
  if (g.kind === "circle") {
    return `R ${formatLength(g.radius, unit)} · Ø ${formatLength(g.radius * 2, unit)}`;
  }
  if (g.kind === "path") {
    let total = 0;
    for (let i = 1; i < g.points.length; i += 1) {
      const a = g.points[i - 1];
      const b = g.points[i];
      if (a && b) total += dist(a, b);
    }
    return `${g.points.length} pts · ${formatLength(total, unit)}${g.closed ? " · closed" : ""}`;
  }
  return `R ${formatLength(g.radius, unit)} · ${formatAngle(arcSweep(g))} sweep`;
};

/** Live readout for an in-progress draft. */
export const draftReadout = (g: Geometry, unit: Unit): string => describeGeometry(g, unit);
