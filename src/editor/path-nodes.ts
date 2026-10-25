import type { PathGeometry } from "../core/geometry/types";

/** Insert a midpoint after a node, including the closing edge of a closed path. */
export function insertPathNode(path: PathGeometry, index: number): PathGeometry {
  const a = path.points[index];
  const b = path.points[index + 1] ?? (path.closed ? path.points[0] : undefined);
  if (!Number.isInteger(index) || !a || !b) return path;
  const points = [...path.points];
  points.splice(index + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return { ...path, points };
}

export function deletePathNode(path: PathGeometry, index: number): PathGeometry {
  if (!Number.isInteger(index) || !path.points[index] || path.points.length <= (path.closed ? 3 : 2)) return path;
  return { ...path, points: path.points.filter((_, i) => i !== index) };
}