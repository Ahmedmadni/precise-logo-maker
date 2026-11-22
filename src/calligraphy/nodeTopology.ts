import { outlineNodes, parseOutline, smoothOutlineAnchor } from "./pathEditor";

/**
 * Topology-safe editing of independent Arabic glyph contours.
 * Insert uses de Casteljau at a chosen segment without changing the curve.
 * Deletion uses geometric deviation checks; curved anchors are removed only
 * when two same-degree segments can be merged within the chosen tolerance.
 */
type OutlineSegments = NonNullable<ReturnType<typeof parseOutline>>;
export type NodeEditMode = "corner" | "smooth" | "symmetric";
export interface NodeEditResult { path: string; selectedNodeId: number; maxDeviation?: number }

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


/** Numerically verify a prospective Q/Q or C/C merge at matching parameters.
 * The original pair is evaluated over [0,split] and [split,1]. Endpoint
 * tangents give candidate handles, then sampled maximum displacement guards
 * against distorted Arabic calligraphy; untouched contours remain byte-stable.
 */
const separation = (a: {x:number;y:number}, b: {x:number;y:number}) =>
  Math.hypot(a.x-b.x, a.y-b.y);
function curvePosition(start: {x:number;y:number}, seg: OutlineSegments[number], t: number) {
  if (seg.cmd === "L") return lerp(start, point(seg.values), t);
  if (seg.cmd !== "Q" && seg.cmd !== "C") return start;
  const end = endPoint(seg), u = 1-t;
  if (seg.cmd === "Q") {
    const p = point(seg.values);
    return {x: u*u*start.x+2*u*t*p.x+t*t*end.x,
      y: u*u*start.y+2*u*t*p.y+t*t*end.y};
  }
  const p = point(seg.values), q = point(seg.values,2);
  return {x:u*u*u*start.x+3*u*u*t*p.x+3*u*t*t*q.x+t*t*t*end.x,
    y:u*u*u*start.y+3*u*u*t*p.y+3*u*t*t*q.y+t*t*t*end.y};
}
function mergeCurves(
  start: {x:number;y:number}, first: OutlineSegments[number],
  second: OutlineSegments[number], tolerance: number,
): { segment: OutlineSegments[number]; error: number } | null {
  if ((first.cmd !== "C" && first.cmd !== "Q") || first.cmd !== second.cmd) return null;
  const middle=endPoint(first), end=endPoint(second);
  const h0=first.cmd==="C"?point(first.values,2):point(first.values);
  const h1=point(second.values);
  // Removing a visibly sharp cusp destroys the letter's nib structure.
  const vin={x:middle.x-h0.x,y:middle.y-h0.y};
  const vout={x:h1.x-middle.x,y:h1.y-middle.y};
  const a=Math.hypot(vin.x,vin.y), b=Math.hypot(vout.x,vout.y);
  if (a<1e-6 || b<1e-6 ||
      (vin.x*vout.x+vin.y*vout.y)/(a*b) < 0.92) return null;
  let best: { segment: OutlineSegments[number]; error: number } | null=null;
  // Common de Casteljau subdivisions are recovered exactly at t=.5.
  // Other smooth joins can be approximated if residuals are sufficiently low.
  for (let i=2;i<=38;i++) {
    const split=i/40; // 0.05 ... 0.95
    const ctrlStart=point(first.values);
    const ctrlEnd=first.cmd==="C"?point(second.values,2):point(second.values);
    const p1={x:start.x+(ctrlStart.x-start.x)/split,
      y:start.y+(ctrlStart.y-start.y)/split};
    const p2={x:end.x+(ctrlEnd.x-end.x)/(1-split),
      y:end.y+(ctrlEnd.y-end.y)/(1-split)};
    const merged: OutlineSegments[number] = first.cmd==="C"
      ? {cmd:"C",values:flatten(p1,p2,end)}
      : {cmd:"Q",values:flatten(
        {x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2},end)};
    if (merged.values.some(v=>!finite(v))) continue;
    let error=0;
    for (let j=0;j<=16;j++) {
      const u=j/16;
      const originalLeft=curvePosition(start,first,u);
      const newLeft=curvePosition(start,merged,u*split);
      const originalRight=curvePosition(middle,second,u);
      const newRight=curvePosition(start,merged,split+(1-split)*u);
      error=Math.max(error,separation(originalLeft,newLeft),separation(originalRight,newRight));
      if (error>tolerance && best && error>best.error) break;
    }
    if (!best || error<best.error) best={segment:merged,error};
  }
  return best && best.error<=tolerance ? best : null;
}

/** Remove a redundant intermediate anchor only if the resulting outline's
 * maximum measured displacement is within tolerance, in native glyph units.
 * Never remove closed seams, line/curve junctions, sharp cusps or contours
 * too small to keep their valid outline topology.
 */
export function removeOutlineAnchor(
  d: string, selectedNodeId: number, maxError = 0.5,
): NodeEditResult | null {
  if (!Number.isFinite(maxError) || maxError<0 || maxError>5) return null;
  const segments=parseOutline(d);
  if (!segments) return null;
  const where=locate(segments,selectedNodeId);
  if (!where) return null;
  const {index,pair,offset}=where;
  const incoming=segments[index]!, outgoing=segments[index+1];
  if (!isAnchor(incoming.cmd,pair) || !outgoing || outgoing.cmd==="M" ||
      outgoing.cmd==="Z" || incoming.cmd==="M") return null;
  const shape=contour(segments,index);
  if (!shape || (shape.coincident && index===shape.end-1)) return null;
  let vertexCount=0;
  for(let i=shape.start;i<shape.end;i++)
    if(["M","L","Q","C"].includes(segments[i]!.cmd)) vertexCount++;
  if (shape.closed && shape.coincident) vertexCount--;
  if (vertexCount<= (shape.closed?3:2)) return null;
  const prev=segments[index-1];
  if (!prev || prev.cmd==="Z") return null;
  const start=endPoint(prev), middle=endPoint(incoming), end=endPoint(outgoing);
  let deviation=0;
  let replacement: OutlineSegments[number] | null=null;
  if (incoming.cmd==="L" && outgoing.cmd==="L") {
    // Only collinear-ish joins with the vertex between the endpoints may go:
    // deleting an actual sharp corner is not a "safe" simplification.
    const vx=end.x-start.x, vy=end.y-start.y, length2=vx*vx+vy*vy;
    if(length2<=1e-9) return null;
    const projection=((middle.x-start.x)*vx+(middle.y-start.y)*vy)/length2;
    if(projection<=0 || projection>=1) return null;
    const closest={x:start.x+projection*vx,y:start.y+projection*vy};
    deviation=separation(middle,closest);
    if(deviation>maxError) return null;
    replacement={cmd:"L",values:flatten(end)};
  } else if ((incoming.cmd==="Q"&&outgoing.cmd==="Q") ||
             (incoming.cmd==="C"&&outgoing.cmd==="C")) {
    const match=mergeCurves(start,incoming,outgoing,maxError);
    if (!match) return null;
    deviation=match.error;
    replacement=match.segment;
  } else return null;
  segments.splice(index,2,replacement);
  const path=serialize(segments);
  if (!path) return null;
  // Curve replacement's last anchor is the selected survivor. For lines,
  // return the original preceding anchor.
  return {path,selectedNodeId:incoming.cmd==="C"?offset+2:
    incoming.cmd==="Q"?offset+1:Math.max(0,offset-1),maxDeviation:deviation};
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
export function outlineNodeActions(d: string, id: number, maxError = 0.5) {
  const segments = parseOutline(d);
  if (!segments) return { insert: false, remove: false, removeDeviation: null, corner: false, smooth: false, symmetric: false };
  const where = locate(segments, id);
  if (!where) return { insert: false, remove: false, removeDeviation: null, corner: false, smooth: false, symmetric: false };
  const seg = segments[where.index]!;
  const anchor = isAnchor(seg.cmd, where.pair);
  const editable = anchor && !!contour(segments, where.index);
  const curve = editable && (seg.cmd === "C" || seg.cmd === "Q" ||
    seg.cmd === "M" && !!contour(segments, where.index)?.coincident);
  const removal=editable ? removeOutlineAnchor(d,id,maxError) : null;
  return {
    insert: editable && ["L", "Q", "C"].includes(seg.cmd),
    remove: !!removal,
    removeDeviation: removal?.maxDeviation ?? null,
    corner: curve && !!changeOutlineAnchor(d, id, "corner"),
    smooth: curve && !!smoothOutlineAnchor(d, id),
    symmetric: curve && !!changeOutlineAnchor(d, id, "symmetric"),
  };
}

/** Stable outline node counter after edits; the renderer limits visible nodes. */
export function outlineNodeCount(d: string) { return outlineNodes(d).length; }
