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


/**
 * Move one outline node without arbitrarily destroying the curve tangents.
 *
 * When a true anchor is moved, shift its incoming and outgoing Bézier control
 * points by the same delta. Preserve the entire remaining glyph, including
 * disconnected contours/dots and the opposite handles on adjacent curves.
 * Control handles themselves always remain directly editable on their own.
 *
 * The option is deliberately reversible via the existing document Undo.
 */
export function moveOutlineNodeWithHandles(
  d: string, nodeId: number, x: number, y: number, preserveHandles = true,
): string | null {
  if (!Number.isInteger(nodeId) || nodeId < 0 || !Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > 100_000 || Math.abs(y) > 100_000) return null;
  if (!preserveHandles) return editOutlineNode(d, nodeId, x, y);
  const segments = parseOutline(d);
  if (!segments) return null;

  let startId = 0;
  let segmentIndex = -1;
  let localPair = -1;
  for (let i = 0; i < segments.length; i++) {
    const pairs = segments[i]!.values.length / 2;
    if (nodeId >= startId && nodeId < startId + pairs) {
      segmentIndex = i;
      localPair = nodeId - startId;
      break;
    }
    startId += pairs;
  }
  if (segmentIndex < 0) return null;
  const segment = segments[segmentIndex]!;
  const offset = localPair * 2;
  const isControl = segment.cmd === "C" && localPair < 2 ||
    segment.cmd === "Q" && localPair === 0;
  if (isControl) return editOutlineNode(d, nodeId, x, y);

  const dx = x - segment.values[offset]!;
  const dy = y - segment.values[offset + 1]!;
  const shiftControl = (values: number[], index: number) => {
    values[index] = values[index]! + dx;
    values[index + 1] = values[index + 1]! + dy;
  };
  segment.values[offset] = x;
  segment.values[offset + 1] = y;

  // Incoming handle belongs to the curve whose endpoint is this anchor.
  if (segment.cmd === "C") shiftControl(segment.values, 2);
  if (segment.cmd === "Q") shiftControl(segment.values, 0);

  // Outgoing handle belongs to the next segment, but *never* a new subpath.
  const next = segments[segmentIndex + 1];
  if (next?.cmd === "C" || next?.cmd === "Q") shiftControl(next.values, 0);

  const result = segments.map((s) => s.cmd + (s.values.length ? s.values.map(f).join(" ") : "")).join(" ");
  return result.length <= 500_000 ? result : null;
}

/**
 * Align the outgoing Bézier handle with the incoming handle at an anchor.
 * This adjusts the actual SVG control point; it is not a visual filter.
 */
export function smoothOutlineAnchor(d: string, anchorId: number): string | null {
  const nodes = outlineNodes(d);
  const anchor = nodes.find((n) => n.id === anchorId);
  const incoming = nodes.find((n) => n.id === anchorId - 1);
  const outgoing = nodes.find((n) => n.id === anchorId + 1);
  if (!anchor || anchor.role !== "anchor" || incoming?.role !== "control" ||
      outgoing?.role !== "control") return null;
  const dx = anchor.x - incoming.x;
  const dy = anchor.y - incoming.y;
  const incomingLength = Math.hypot(dx, dy);
  const outgoingLength = Math.hypot(outgoing.x - anchor.x, outgoing.y - anchor.y);
  if (incomingLength < 0.0001 || outgoingLength < 0.0001) return null;
  return editOutlineNode(d, anchorId + 1,
    anchor.x + dx / incomingLength * outgoingLength,
    anchor.y + dy / incomingLength * outgoingLength);
}
