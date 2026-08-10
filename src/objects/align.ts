import type { Bounds, Point } from "../core/geometry/types";
import { pt } from "../core/geometry/math";

export type AlignMode = "left" | "centerX" | "right" | "top" | "middleY" | "bottom";
export type DistributeAxis = "x" | "y";

const centerOf = (b: Bounds): Point => pt((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);

/**
 * Translation offsets that align each item's bounds to `target`.
 * Pure: index-aligned with the input list.
 */
export const alignOffsets = (
  list: Bounds[],
  mode: AlignMode,
  target: Bounds,
): Point[] => {
  const t = centerOf(target);
  return list.map((b) => {
    switch (mode) {
      case "left":
        return pt(target.minX - b.minX, 0);
      case "right":
        return pt(target.maxX - b.maxX, 0);
      case "centerX":
        return pt(t.x - (b.minX + b.maxX) / 2, 0);
      case "top":
        return pt(0, target.minY - b.minY);
      case "bottom":
        return pt(0, target.maxY - b.maxY);
      case "middleY":
      default:
        return pt(0, t.y - (b.minY + b.maxY) / 2);
    }
  });
};

/**
 * Offsets that spread items so their centers are evenly spaced between the
 * outermost two along `axis`. Needs at least 3 items to do anything.
 */
export const distributeOffsets = (list: Bounds[], axis: DistributeAxis): Point[] => {
  const zero = list.map(() => pt(0, 0));
  if (list.length < 3) return zero;
  const key = (b: Bounds) => (axis === "x" ? centerOf(b).x : centerOf(b).y);
  const order = list.map((b, i) => ({ i, c: key(b) })).sort((a, b) => a.c - b.c);
  const first = order[0];
  const last = order[order.length - 1];
  if (!first || !last) return zero;
  const step = (last.c - first.c) / (order.length - 1);
  const out = zero.slice();
  order.forEach((entry, rank) => {
    const wanted = first.c + step * rank;
    const delta = wanted - entry.c;
    out[entry.i] = axis === "x" ? pt(delta, 0) : pt(0, delta);
  });
  return out;
};
