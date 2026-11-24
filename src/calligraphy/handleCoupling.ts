import { editOutlineNode, parseOutline } from "./pathEditor";

/** Session-only constraint applied while dragging a cubic Bézier control. */
export type ControlLinkMode = "free" | "smooth" | "symmetric";

type Segments = NonNullable<ReturnType<typeof parseOutline>>;
type Ref = { segment: number; pair: number };
const finite = (n: number) => Number.isFinite(n) && Math.abs(n) <= 100_000;
const pt = (s: Segments[number], at: number) =>
  ({ x: s.values[at]!, y: s.values[at + 1]! });
const dist = (a: {x:number;y:number}, b: {x:number;y:number}) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** A coupled cubic pair may meet at an ordinary anchor or at an explicitly
 * coincident M...C...Z seam. Never connect across separate contours or a
 * closing Z that merely draws a straight line. */
export function linkedCubicControl(d: string, nodeId: number):
  { control: Ref; opposite: Ref; anchor: { x: number; y: number } } | null {
  if (!Number.isSafeInteger(nodeId) || nodeId < 0) return null;
  const segments = parseOutline(d);
  if (!segments) return null;
  let index = -1, pair = -1, offset = 0;
  for (let i = 0; i < segments.length; i++) {
    const count = segments[i]!.values.length / 2;
    if (nodeId < offset + count) {
      index = i; pair = nodeId - offset; break;
    }
    offset += count;
  }
  if (index < 0 || segments[index]?.cmd !== "C" || (pair !== 0 && pair !== 1))
    return null;
  let start = index;
  while (start >= 0 && segments[start]!.cmd !== "M") start--;
  if (start < 0) return null;
  let end = start + 1;
  while (end < segments.length && segments[end]!.cmd !== "Z" &&
    segments[end]!.cmd !== "M") end++;
  const first = segments[start]!;
  const last = segments[end - 1];
  const seam = segments[end]?.cmd === "Z" && last?.cmd === "C" &&
    dist(pt(first, 0), pt(last, last.values.length - 2)) < 0.001;
  const control = { segment: index, pair };
  let opposite: Ref | null = null;
  let anchor: {x:number;y:number} | null = null;
  const segment = segments[index]!;
  if (pair === 0) {
    const previous = segments[index - 1];
    if (previous?.cmd === "C") {
      opposite = { segment: index - 1, pair: 1 };
      anchor = pt(previous, 4);
    } else if (index === start + 1 && previous?.cmd === "M" && seam) {
      opposite = { segment: end - 1, pair: 1 };
      anchor = pt(previous, 0);
    }
  } else {
    const following = segments[index + 1];
    if (following?.cmd === "C") {
      opposite = { segment: index + 1, pair: 0 };
      anchor = pt(segment, 4);
    } else if (index === end - 1 && following?.cmd === "Z" && seam &&
      segments[start + 1]?.cmd === "C") {
      opposite = { segment: start + 1, pair: 0 };
      anchor = pt(segment, 4);
    }
  }
  if (!opposite || !anchor || !segments[opposite.segment] ||
      (opposite.segment === control.segment && opposite.pair === control.pair)) return null;
  return { control, opposite, anchor };
}

const format = (n: number) => Number(n.toFixed(3)).toString();

/** Link tangent directions dynamically rather than performing a one-time
 * smooth/symmetric operation. Smooth retains opposite handle's old length;
 * symmetric mirrors the freshly dragged handle and matches its new length.
 * Invalid/no-pair requests return null so callers can use free dragging.
 */
export function moveLinkedCubicControl(
  d: string, nodeId: number, x: number, y: number, mode: ControlLinkMode,
): string | null {
  if (!finite(x) || !finite(y)) return null;
  if (mode === "free") return editOutlineNode(d, nodeId, x, y);
  if (mode !== "smooth" && mode !== "symmetric") return null;
  const linked = linkedCubicControl(d, nodeId);
  if (!linked) return null;
  const segments = parseOutline(d);
  if (!segments) return null;
  const { control, opposite, anchor } = linked;
  const handle = segments[control.segment]!;
  const other = segments[opposite.segment]!;
  const old = pt(other, opposite.pair * 2);
  const dx = x - anchor.x, dy = y - anchor.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-5) return null; // a zero-length tangent has no direction
  const originalLength = dist(anchor, old);
  const radius = mode === "symmetric" ? length : originalLength;
  const pairX = anchor.x - dx / length * radius;
  const pairY = anchor.y - dy / length * radius;
  if (!finite(pairX) || !finite(pairY)) return null;
  handle.values[control.pair * 2] = x;
  handle.values[control.pair * 2 + 1] = y;
  other.values[opposite.pair * 2] = pairX;
  other.values[opposite.pair * 2 + 1] = pairY;
  if (segments.some(seg => seg.values.some(n => !finite(n)))) return null;
  const serialized = segments.map(seg =>
    seg.cmd + (seg.values.length ? seg.values.map(format).join(" ") : "")).join(" ");
  return serialized.length <= 500_000 ? serialized : null;
}
