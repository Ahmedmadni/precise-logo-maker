import { outlineNodes, parseOutline, smoothOutlineAnchor } from "./pathEditor";

/**
 * Topology-safe editing of independent Arabic glyph contours.
 * Insert uses de Casteljau at a chosen segment without changing the curve.
 * Delete is deliberately restricted to redundant line-join anchors; deleting
 * a curved anchor needs a controlled approximation and is not yet provided.
 */
type OutlineSegments = NonNullable<ReturnType<typeof parseOutline>>;
export type NodeEditMode = "corner" | "smooth" | "symmetric";
export interface NodeEditResult { path: string; selectedNodeId: number }

const finite = (v: number) => Number.isFinite(v) && Math.abs(v) <= 100_000;
const point = (values: number[], offset = 0) => ({ x: values[offset]!, y: values[offset + 1]! });
const endPoint = (seg: OutlineSegments[number]) =>
  point(seg.values, seg.values.length - 2);
const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const flatten = (...coords: { x: number; y: number }[]) =>
  coords.flatMap((p) => [p.x, p.y]);
const f = (n: number) => Number(n.toFixed(3)).toString();
const serialize = (segments: OutlineSegments): string | null => {
  if (segments.some((seg) => seg.values.some((x) => !finite(x)))) return null;
  const out = segments.map((seg) =>
    seg.cmd + (seg.values.length ? seg.values.map(f).join(" ") : "")).join(" ");
  return out.length <= 500_000 ? out : null;
};

const locate = (segments: OutlineSegments, id: number) => {
  if (!Number.isSafeInteger(id) || id < 0) return null;
  let offset = 0;
  for (let index = 0; index < segments.length; index++) {
    const count = segments[index]!.values.length / 2;
    if (id < offset + count) return { index, pair: id - offset, offset };
    offset += count;
  }
  return null;
};
const contour = (segments: OutlineSegments, index: number) => {
  let start = index;
  while (start > 0 && segments[start]!.cmd !== "M") start--;
  if (segments[start]?.cmd !== "M") return null;
  let end = start + 1;
  while (end < segments.length && segments[end]!.cmd !== "M" && segments[end]!.cmd !== "Z") end++;
  const closed = segments[end]?.cmd === "Z";
  const last = segments[end - 1];
  if (!last) return null;
  const a = point(segments[start]!.values);
  const b = endPoint(last);
  return { start, end, closed, coincident: closed && Math.hypot(a.x - b.x, a.y - b.y) < 0.001 };
};
const isAnchor = (cmd: string, pair: number) =>
  cmd === "M" || cmd === "L" || cmd === "Q" && pair === 1 || cmd === "C" && pair === 2;

/** Split the incoming segment of a selected L/Q/C anchor, returning the new node. */
export function insertOutlineAnchor(d: string, selectedNodeId: number, t = 0.5): NodeEditResult | null {
  if (!Number.isFinite(t) || t < 0.05 || t > 0.95) return null;
  const segments = parseOutline(d);
  if (!segments || segments.length >= 20_000) return null;
  const where = locate(segments, selectedNodeId);
  if (!where) return null;
  const { index, pair, offset } = where;
  const current = segments[index]!;
  if (!["L", "Q", "C"].includes(current.cmd) || !isAnchor(current.cmd, pair))
    return null;
  const prior = segments[index - 1];
  if (!prior || prior.cmd === "Z") return null;
  const p0 = endPoint(prior);
  let first: OutlineSegments[number];
  let second: OutlineSegments[number];
  let insertedNodeId: number;
  if (current.cmd === "L") {
    const p1 = endPoint(current);
    const mid = lerp(p0, p1, t);
    first = { cmd: "L", values: flatten(mid) };
    second = { cmd: "L", values: flatten(p1) };
    insertedNodeId = offset;
  } else if (current.cmd === "Q") {
    const p1 = point(current.values), p2 = point(current.values, 2);
    const a = lerp(p0, p1, t), b = lerp(p1, p2, t), middle = lerp(a, b, t);
    first = { cmd: "Q", values: flatten(a, middle) };
    second = { cmd: "Q", values: flatten(b, p2) };
    insertedNodeId = offset + 1;
  } else if (current.cmd === "C") {
    const p1 = point(current.values), p2 = point(current.values, 2), p3 = point(current.values, 4);
    const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
    const ab = lerp(a, b, t), bc = lerp(b, c, t), middle = lerp(ab, bc, t);
    first = { cmd: "C", values: flatten(a, ab, middle) };
    second = { cmd: "C", values: flatten(bc, c, p3) };
    insertedNodeId = offset + 2;
  } else return null;
  segments.splice(index, 1, first, second);
  const serialized = serialize(segments);
  return serialized ? { path: serialized, selectedNodeId: insertedNodeId } : null;
}

/**
 * Remove only an intermediate straight-line anchor. For curved segments we
 * reject rather than silently replace carefully constructed Arabic contours.
 * A closed outline must keep at least three distinct anchor vertices.
 */
export function removeOutlineAnchor(d: string, selectedNodeId: number): NodeEditResult | null {
  const segments = parseOutline(d);
  if (!segments) return null;
  const where = locate(segments, selectedNodeId);
  if (!where) return null;
  const { index, pair, offset } = where;
  if (segments[index]?.cmd !== "L" || pair !== 0) return null;
  const shape = contour(segments, index);
  if (!shape) return null;
  const before = segments[index - 1], after = segments[index + 1];
  if (!before || !after || (before.cmd !== "M" && before.cmd !== "L") ||
      after.cmd !== "L") return null;
  if (shape.coincident && index === shape.end - 1) return null;
  let vertexCount = 0;
  for (let i = shape.start; i < shape.end; i++) {
    if (["M", "L", "Q", "C"].includes(segments[i]!.cmd)) vertexCount++;
  }
  if (shape.closed && shape.coincident) vertexCount--;
  if (vertexCount <= (shape.closed ? 3 : 2)) return null;
  segments.splice(index, 1);
  const serialized = serialize(segments);
  return serialized ? { path: serialized, selectedNodeId: Math.max(0, offset - 1) } : null;
}

/** Change the tangent behavior without affecting disconnected Arabic marks. */
export function changeOutlineAnchor(d: string, selectedNodeId: number, mode: NodeEditMode): NodeEditResult | null {
  if (mode === "smooth") {
    const result = smoothOutlineAnchor(d, selectedNodeId);
    return result ? { path: result, selectedNodeId } : null;
  }
  if (mode !== "corner" && mode !== "symmetric") return null;
  const segments = parseOutline(d);
  if (!segments) return null;
  const where = locate(segments, selectedNodeId);
  if (!where) return null;
  const { index, pair } = where, seg = segments[index]!;
  if (!isAnchor(seg.cmd, pair)) return null;
  const shape = contour(segments, index);
  if (!shape) return null;
  const anchor = point(seg.values, pair * 2);
  let incoming = seg;
  let next = segments[index + 1];
  if (index === shape.start) {
    if (!shape.coincident) return null;
    incoming = segments[shape.end - 1]!;
    next = segments[index + 1];
  } else if (shape.coincident && index === shape.end - 1) {
    next = segments[shape.start + 1];
  }
  const incomingControlIndex = incoming.cmd === "C" ? 2 : incoming.cmd === "Q" ? 0 : -1;
  if (incomingControlIndex < 0 || (next?.cmd !== "C" && next?.cmd !== "Q")) return null;
  if (mode === "corner") {
    incoming.values.splice(incomingControlIndex, 2, anchor.x, anchor.y);
    next.values.splice(0, 2, anchor.x, anchor.y);
  } else {
    const incomingHandle = point(incoming.values, incomingControlIndex);
    const magnitude = Math.hypot(anchor.x - incomingHandle.x, anchor.y - incomingHandle.y);
    if (magnitude < 0.0001) return null;
    // Equal-length, collinear handles on opposite sides of the selected anchor.
    next.values.splice(0, 2, 2 * anchor.x - incomingHandle.x, 2 * anchor.y - incomingHandle.y);
  }
  const serialized = serialize(segments);
  return serialized ? { path: serialized, selectedNodeId } : null;
}

/** Commands availability follows topology rather than relying on numeric IDs. */
export function outlineNodeActions(d: string, id: number) {
  const segments = parseOutline(d);
  if (!segments) return { insert: false, remove: false, corner: false, smooth: false, symmetric: false };
  const where = locate(segments, id);
  if (!where) return { insert: false, remove: false, corner: false, smooth: false, symmetric: false };
  const seg = segments[where.index]!;
  const anchor = isAnchor(seg.cmd, where.pair);
  const editable = anchor && !!contour(segments, where.index);
  const curve = editable && (seg.cmd === "C" || seg.cmd === "Q" ||
    seg.cmd === "M" && !!contour(segments, where.index)?.coincident);
  return {
    insert: editable && ["L", "Q", "C"].includes(seg.cmd),
    remove: editable && !!removeOutlineAnchor(d, id),
    corner: curve && !!changeOutlineAnchor(d, id, "corner"),
    smooth: curve && !!smoothOutlineAnchor(d, id),
    symmetric: curve && !!changeOutlineAnchor(d, id, "symmetric"),
  };
}

/** Stable outline node counter after edits; the renderer limits visible nodes. */
export function outlineNodeCount(d: string) { return outlineNodes(d).length; }
