import type { LetteringItem } from "./model";

/**
 * SVG outline node editor. Fontkit supplies M/L/Q/C glyph outlines. We parse
 * path commands rather than trying to change the Unicode text, so edits survive
 * SVG export and do not require the original font.
 */
export interface PathNode { id: number; x: number; y: number; role: "anchor" | "control"; }
type Segment =
  | { cmd: "M" | "L"; values: number[] }
  | { cmd: "Q" | "C"; values: number[] }
  | { cmd: "Z"; values: number[] };
const PARAMS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, S: 4, T: 2, Z: 0 };
const tokens = (d: string): string[] =>
  d.match(/[MmLlHhVvQqCcSsTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
const f = (n: number) => Number(n.toFixed(3)).toString();

export function parseOutline(d: string): Segment[] | null {
  if (!d || d.length > 500_000) return null;
  const ts = tokens(d);
  const result: Segment[] = [];
  let pos = 0, current = "M", x = 0, y = 0, sx = 0, sy = 0;
  let prev: Segment | null = null;
  let safety = 0;
  while (pos < ts.length && safety++ < 100_000) {
    const token = ts[pos]!;
    if (/^[a-zA-Z]$/.test(token)) {
      if (token.toUpperCase() === "A") return null; // Font glyph outlines have no elliptical arcs.
      current = token;
      pos += 1;
    }
    const type = current.toUpperCase();
    if (!(type in PARAMS)) return null;
    if (type === "Z") {
      const seg: Segment = { cmd: "Z", values: [] };
      result.push(seg); prev = seg; x = sx; y = sy;
      current = "M"; // avoid infinite loop on invalid numbers after Z
      continue;
    }
    const size = PARAMS[type]!;
    if (pos + size > ts.length) return null;
    const raw = ts.slice(pos, pos + size).map(Number);
    if (raw.some((n) => !Number.isFinite(n))) return null;
    pos += size;
    const rel = current === current.toLowerCase();
    let vals: number[] = [];
    let outType: Segment["cmd"] = type as Segment["cmd"];
    switch (type) {
      case "M":
        vals = [raw[0]! + (rel ? x : 0), raw[1]! + (rel ? y : 0)];
        sx = vals[0]!; sy = vals[1]!;
        x = sx; y = sy; outType = "M";
        current = rel ? "l" : "L";
        break;
      case "L":
        vals = [raw[0]! + (rel ? x : 0), raw[1]! + (rel ? y : 0)];
        x = vals[0]!; y = vals[1]!; break;
      case "H":
        x = raw[0]! + (rel ? x : 0);
        vals = [x, y]; outType = "L"; break;
      case "V":
        y = raw[0]! + (rel ? y : 0);
        vals = [x, y]; outType = "L"; break;
      case "Q":
        vals = raw.map((n, i) => n + (rel ? i % 2 ? y : x : 0));
        x = vals[2]!; y = vals[3]!; break;
      case "C":
        vals = raw.map((n, i) => n + (rel ? i % 2 ? y : x : 0));
        x = vals[4]!; y = vals[5]!; break;
      case "S": {
        let cx = x, cy = y;
        if (prev?.cmd === "C") {
          cx = 2 * x - prev.values[2]!;
          cy = 2 * y - prev.values[3]!;
        }
        const [a, b, endX, endY] = raw.map((n, i) => n + (rel ? i % 2 ? y : x : 0));
        vals = [cx, cy, a!, b!, endX!, endY!]; x = endX!; y = endY!; outType = "C"; break;
      }
      case "T": {
        let cx = x, cy = y;
        if (prev?.cmd === "Q") {
          cx = 2 * x - prev.values[0]!;
          cy = 2 * y - prev.values[1]!;
        }
        const endX = raw[0]! + (rel ? x : 0), endY = raw[1]! + (rel ? y : 0);
        vals = [cx, cy, endX, endY]; x = endX; y = endY; outType = "Q"; break;
      }
    }
    const seg: Segment = { cmd: outType as "M" | "L" | "Q" | "C", values: vals };
    result.push(seg); prev = seg;
  }
  return safety <= 100_000 ? result : null;
}

export function outlineNodes(d: string): PathNode[] {
  const segments = parseOutline(d);
  if (!segments) return [];
  const result: PathNode[] = [];
  let id = 0;
  for (const seg of segments) {
    for (let i = 0; i < seg.values.length; i += 2) {
      result.push({
        id: id++,
        x: seg.values[i]!,
        y: seg.values[i + 1]!,
        role: seg.cmd === "Q" && i === 0 || seg.cmd === "C" && i < 4 ? "control" : "anchor",
      });
    }
  }
  return result;
}

export function editOutlineNode(d: string, nodeId: number, x: number, y: number): string | null {
  const segments = parseOutline(d);
  if (!segments || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  let index = 0, edited = false;
  for (const seg of segments) {
    for (let i = 0; i < seg.values.length; i += 2) {
      if (index++ === nodeId) {
        seg.values[i] = x;
        seg.values[i + 1] = y;
        edited = true;
      }
    }
  }
  if (!edited) return null;
  return segments.map((seg) => seg.cmd + (seg.values.length ? seg.values.map(f).join(" ") : "")).join(" ");
}

/** Convert a font-outline point into the studio's SVG world coordinates. */
export function glyphPointToWorld(item: LetteringItem, x: number, y: number): { x: number; y: number } {
  const units = item.unitsPerEm || 1000, s = item.size / units;
  const sx = x * s * (item.scaleX ?? 1);
  const sy = -y * s * (item.scaleY ?? 1);
  const skewY = Math.tan(Math.max(-60, Math.min(60, item.skewY ?? 0)) * Math.PI / 180);
  const skewX = Math.tan(Math.max(-60, Math.min(60, item.skewX ?? 0)) * Math.PI / 180);
  const py = sy + skewY * sx;
  const px = sx + skewX * py;
  const angle = item.rotation * Math.PI / 180;
  return {
    x: item.x + px * Math.cos(angle) - py * Math.sin(angle),
    y: item.y + px * Math.sin(angle) + py * Math.cos(angle),
  };
}

/** Inverse mapping used to drag an anchor/control point accurately. */
export function worldToGlyphPoint(item: LetteringItem, wx: number, wy: number): { x: number; y: number } | null {
  const units = item.unitsPerEm || 1000, s = item.size / units;
  const sx = (item.scaleX ?? 1) * s, sy = (item.scaleY ?? 1) * s;
  if (!sx || !sy) return null;
  const angle = -item.rotation * Math.PI / 180;
  const dx = wx - item.x, dy = wy - item.y;
  const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);
  const skewX = Math.tan(Math.max(-60, Math.min(60, item.skewX ?? 0)) * Math.PI / 180);
  const skewY = Math.tan(Math.max(-60, Math.min(60, item.skewY ?? 0)) * Math.PI / 180);
  const originalX = rotatedX - skewX * rotatedY;
  const originalY = rotatedY - skewY * originalX;
  return { x: originalX / sx, y: -originalY / sy };
}


/** A contour is one M...Z sequence; other marks and dots are separate. */
function nodeLocation(segments: NonNullable<ReturnType<typeof parseOutline>>, nodeId: number) {
  if (!Number.isInteger(nodeId) || nodeId < 0) return null;
  let offset = 0;
  for (let index = 0; index < segments.length; index++) {
    const count = segments[index]!.values.length / 2;
    if (nodeId < offset + count) return { index, pair: nodeId - offset };
    offset += count;
  }
  return null;
}

function closedContour(segments: NonNullable<ReturnType<typeof parseOutline>>, index: number) {
  let start = index;
  while (start > 0 && segments[start]!.cmd !== "M") start--;
  if (segments[start]?.cmd !== "M") return null;
  let end = start + 1;
  while (end < segments.length && segments[end]!.cmd !== "M" && segments[end]!.cmd !== "Z") end++;
  if (segments[end]?.cmd !== "Z" || end <= start + 1) return null;
  const first = segments[start]!;
  const lastIndex = end - 1;
  const last = segments[lastIndex]!;
  const lastX = last.values.at(-2);
  const lastY = last.values.at(-1);
  // A trailing Z alone may be a straight closing edge. Only a coincident
  // explicit end point represents the *same* anchor at the seam.
  const coincident = lastX !== undefined && lastY !== undefined &&
    Math.hypot(lastX - first.values[0]!, lastY - first.values[1]!) < 0.001;
  return { start, lastIndex, coincident };
}

function serializeOutline(segments: NonNullable<ReturnType<typeof parseOutline>>) {
  const value = segments.map((s) => s.cmd + (s.values.length ? s.values.map(f).join(" ") : "")).join(" ");
  return value.length <= 500_000 ? value : null;
}

/**
 * Preserve the tangent handles attached to the edited anchor and, when a
 * closed contour duplicates its first point at the end, preserve that seam.
 * Nothing in another contour may move (dots and detached strokes are safe).
 * Independent control-handle editing and free-anchor mode are unchanged.
 */
export function moveOutlineNodeWithHandles(
  d: string, nodeId: number, x: number, y: number, preserveHandles = true,
): string | null {
  if (!Number.isInteger(nodeId) || nodeId < 0 || !Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > 100_000 || Math.abs(y) > 100_000) return null;
  if (!preserveHandles) return editOutlineNode(d, nodeId, x, y);
  const segments = parseOutline(d);
  if (!segments) return null;
  const location = nodeLocation(segments, nodeId);
  if (!location) return null;
  const { index, pair } = location;
  const segment = segments[index]!;
  const closed = closedContour(segments, index);
  const control = segment.cmd === "C" && pair < 2 || segment.cmd === "Q" && pair === 0;
  if (control) return editOutlineNode(d, nodeId, x, y);
  const offset = pair * 2;
  const dx = x - segment.values[offset]!;
  const dy = y - segment.values[offset + 1]!;
  const movePair = (target: typeof segment, at: number) => {
    target.values[at] = target.values[at]! + dx;
    target.values[at + 1] = target.values[at + 1]! + dy;
  };
  segment.values[offset] = x;
  segment.values[offset + 1] = y;

  // Incoming control belongs to a curve ending at this anchor.
  if (segment.cmd === "C") movePair(segment, 2);
  if (segment.cmd === "Q") movePair(segment, 0);

  // Outgoing control belongs to the next curve, and never a new subpath.
  const next = segments[index + 1];
  if (next?.cmd === "C" || next?.cmd === "Q") movePair(next, 0);

  if (closed?.coincident) {
    if (index === closed.start) {
      // Moving M of an explicitly coincident closed path also moves the final
      // duplicate endpoint and its incoming handle, avoiding a seam/crack.
      const last = segments[closed.lastIndex]!;
      movePair(last, last.values.length - 2);
      if (last.cmd === "C") movePair(last, 2);
      if (last.cmd === "Q") movePair(last, 0);
    } else if (index === closed.lastIndex) {
      // Moving the duplicate end also moves M and the first outgoing handle.
      const first = segments[closed.start]!;
      movePair(first, 0);
      const firstCurve = segments[closed.start + 1];
      if (firstCurve?.cmd === "C" || firstCurve?.cmd === "Q") movePair(firstCurve, 0);
    }
  }
  return serializeOutline(segments);
}

/**
 * Match the tangent of a curve entering an anchor to the curve leaving it.
 * Handles may be connected through a genuinely coincident closed seam, but
 * NEVER across an M, Z, or a straight closing line.
 */
export function smoothOutlineAnchor(d: string, anchorId: number): string | null {
  const segments = parseOutline(d);
  if (!segments) return null;
  const location = nodeLocation(segments, anchorId);
  if (!location) return null;
  const { index, pair } = location;
  const segment = segments[index]!;
  const isAnchor = segment.cmd === "M" || segment.cmd === "L" ||
    segment.cmd === "C" && pair === 2 || segment.cmd === "Q" && pair === 1;
  if (!isAnchor) return null;

  const anchor = { x: segment.values[pair * 2]!, y: segment.values[pair * 2 + 1]! };
  let incoming = segment;
  let next = segments[index + 1];
  const contour = closedContour(segments, index);
  if (segment.cmd === "M") {
    if (!contour?.coincident || index !== contour.start) return null;
    incoming = segments[contour.lastIndex]!;
    next = segments[index + 1];
  } else if (contour?.coincident && index === contour.lastIndex) {
    // The final explicit curve endpoint is the same anchor as M.
    next = segments[contour.start + 1];
  }
  if (incoming.cmd !== "C" && incoming.cmd !== "Q") return null;
  if (next?.cmd !== "C" && next?.cmd !== "Q") return null;
  const handleIndex = incoming.cmd === "C" ? 2 : 0;
  const ix = incoming.values[handleIndex]!, iy = incoming.values[handleIndex + 1]!;
  const ox = next.values[0]!, oy = next.values[1]!;
  const inLen = Math.hypot(anchor.x - ix, anchor.y - iy);
  const outLen = Math.hypot(ox - anchor.x, oy - anchor.y);
  if (inLen < 0.0001 || outLen < 0.0001) return null;
  next.values[0] = anchor.x + (anchor.x - ix) / inLen * outLen;
  next.values[1] = anchor.y + (anchor.y - iy) / inLen * outLen;
  return serializeOutline(segments);
}
