import { angleOf, normalizeAngle, pointOnCircle, pt, rotatePoint } from "../core/geometry/math";
import type { Geometry, Point } from "../core/geometry/types";

/** Apply a point map to every defining point of a primitive. */
const mapPoints = (g: Geometry, fn: (p: Point) => Point): Geometry => {
  if (g.kind === "line") return { ...g, a: fn(g.a), b: fn(g.b) };
  return { ...g, center: fn(g.center) };
};

export const translateGeometry = (g: Geometry, dx: number, dy: number): Geometry =>
  mapPoints(g, (p) => pt(p.x + dx, p.y + dy));

export const rotateGeometry = (g: Geometry, angleDeg: number, origin: Point): Geometry => {
  const rotated = mapPoints(g, (p) => rotatePoint(p, angleDeg, origin));
  if (rotated.kind === "arc") {
    return {
      ...rotated,
      startAngle: normalizeAngle(rotated.startAngle + angleDeg),
      endAngle: normalizeAngle(rotated.endAngle + angleDeg),
    };
  }
  return rotated;
};

export const scaleGeometry = (g: Geometry, factor: number, origin: Point): Geometry => {
  const scaled = mapPoints(g, (p) =>
    pt(origin.x + (p.x - origin.x) * factor, origin.y + (p.y - origin.y) * factor),
  );
  if (scaled.kind === "circle" || scaled.kind === "arc") {
    return { ...scaled, radius: Math.abs(scaled.radius * factor) };
  }
  return scaled;
};

/** Mirror across a vertical (axis "x" flips horizontally) or horizontal line through `origin`. */
export const mirrorGeometry = (g: Geometry, axis: "x" | "y", origin: Point): Geometry => {
  const flip = (p: Point): Point =>
    axis === "x" ? pt(2 * origin.x - p.x, p.y) : pt(p.x, 2 * origin.y - p.y);
  const mirrored = mapPoints(g, flip);
  if (mirrored.kind === "arc") {
    const start = pointOnCircle(g.center, g.radius, g.startAngle);
    const end = pointOnCircle(g.center, g.radius, g.endAngle);
    return {
      ...mirrored,
      startAngle: normalizeAngle(angleOf(mirrored.center, flip(end))),
      endAngle: normalizeAngle(angleOf(mirrored.center, flip(start))),
    };
  }
  return mirrored;
};
