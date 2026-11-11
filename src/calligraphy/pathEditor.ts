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
  const dx = x * s * (item.scaleX ?? 1);
  const dy = -y * s * (item.scaleY ?? 1);
  const angle = item.rotation * Math.PI / 180;
  return {
    x: item.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: item.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

/** Inverse mapping used to drag an anchor/control point accurately. */
export function worldToGlyphPoint(item: LetteringItem, wx: number, wy: number): { x: number; y: number } | null {
  const units = item.unitsPerEm || 1000, s = item.size / units;
  const sx = (item.scaleX ?? 1) * s, sy = (item.scaleY ?? 1) * s;
  if (!sx || !sy) return null;
  const angle = -item.rotation * Math.PI / 180;
  const dx = wx - item.x, dy = wy - item.y;
  return {
    x: (dx * Math.cos(angle) - dy * Math.sin(angle)) / sx,
    y: -(dx * Math.sin(angle) + dy * Math.cos(angle)) / sy,
  };
}
