import { panBy, zoomAt, type ViewTransform } from "../../core/coordinates/view";
import type { Point } from "../../core/geometry/types";

/** A finger resting on the screen must not interrupt an in-progress stylus stroke. */
export const shouldIgnorePalmContact = (activePointerType: string | null, incomingType: string) =>
  activePointerType === "pen" && incomingType === "touch";

export interface PinchSnapshot {
  distance: number;
  midpoint: Point;
  view: ViewTransform;
}

export function touchPair(
  points: Map<number, Point>,
  viewportOrigin: Point,
): { distance: number; midpoint: Point } | null {
  const pair = [...points.values()].slice(0, 2);
  const [a, b] = pair;
  if (!a || !b) return null;
  return {
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    midpoint: {
      x: (a.x + b.x) / 2 - viewportOrigin.x,
      y: (a.y + b.y) / 2 - viewportOrigin.y,
    },
  };
}

/** Keep the original world point under the fingers even on a rotated canvas. */
export function pinchView(snapshot: PinchSnapshot, current: {
  distance: number; midpoint: Point;
}): ViewTransform {
  const targetZoom = snapshot.view.zoom * current.distance / snapshot.distance;
  const anchored = zoomAt(snapshot.view, snapshot.midpoint, targetZoom);
  return panBy(anchored,
    current.midpoint.x - snapshot.midpoint.x,
    current.midpoint.y - snapshot.midpoint.y);
}
