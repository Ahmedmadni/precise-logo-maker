import type { LetteringItem } from "./model";
import { worldJoinAnchor } from "./contourComposer";
import { sampleRibbon, type RibbonLink } from "./ribbonJoin";

export type RibbonHandleId = "start" | "end" | "bend";
export type WorldPoint = { x: number; y: number };
export interface RibbonHandleGeometry {
  start: WorldPoint;
  end: WorldPoint;
  bend: WorldPoint;
  /** The actual ribbon centerline points, for editor-only guide rendering. */
  centerline: WorldPoint[];
  /** Centers of the two caps; the tangent handles are offset from these. */
  startCap: WorldPoint;
  endCap: WorldPoint;
  /** Chord direction between unmodified glyph anchors. */
  chordAngle: number;
  normal: WorldPoint;
  capDistance: number;
  anchorDistance: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const radians = (degrees: number) => degrees * Math.PI / 180;
const wrapDegrees = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;

/**
 * Editable handles are based on the SAME centerline that generates exported
 * SVG. Editing markers are separate presentation only, never part of a .logo
 * or an SVG export. They are not automatic Arabic joining information.
 */
export function ribbonHandleGeometry(
  bridge: LetteringItem, glyphs: LetteringItem[],
): RibbonHandleGeometry | null {
  const spec = bridge.ribbon;
  if (bridge.kind !== "bridge" || !spec) return null;
  const source = glyphs.find((x) => x.id === spec.sourceGlyphId && x.kind === "outline");
  const target = glyphs.find((x) => x.id === spec.targetGlyphId && x.kind === "outline");
  if (!source || !target) return null;
  const a = worldJoinAnchor(source, spec.sourceSide);
  const b = worldJoinAnchor(target, spec.targetSide);
  if (!a || !b) return null;
  const anchorDistance = Math.hypot(b.x - a.x, b.y - a.y);
  const samples = sampleRibbon(bridge, glyphs, 16);
  if (!samples || anchorDistance < 2 || !Number.isFinite(anchorDistance)) return null;
  const chordAngle = Math.atan2(b.y - a.y, b.x - a.x);
  const normal = { x: -Math.sin(chordAngle), y: Math.cos(chordAngle) };
  const startCap = samples[0]!.center;
  const endCap = samples[16]!.center;
  const capDistance = Math.hypot(endCap.x - startCap.x, endCap.y - startCap.y);
  if (capDistance < 1e-6) return null;
  const radius = clamp(anchorDistance * 0.24, 22, 85);
  const handle = (cap: WorldPoint, direction: number, sign: number): WorldPoint => ({
    x: cap.x + Math.cos(chordAngle + radians(direction)) * radius * sign,
    y: cap.y + Math.sin(chordAngle + radians(direction)) * radius * sign,
  });
  return {
    start: handle(startCap, spec.startAngle ?? 0, 1),
    end: handle(endCap, spec.endAngle ?? 0, -1),
    bend: samples[8]!.center,
    centerline: samples.map((point) => point.center),
    startCap, endCap, chordAngle, normal, capDistance, anchorDistance,
  };
}

/** Convert a pointer drag into ONE safe ribbon parameter change. */
export function ribbonHandleDragPatch(
  spec: RibbonLink, geometry: RibbonHandleGeometry,
  handle: RibbonHandleId, pointer: WorldPoint,
): Partial<RibbonLink> | null {
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
  if (handle === "bend") {
    const dx = pointer.x - geometry.bend.x;
    const dy = pointer.y - geometry.bend.y;
    const shift = (dx * geometry.normal.x + dy * geometry.normal.y) / geometry.capDistance;
    return { curvature: Number(clamp(spec.curvature + shift, -0.5, 0.5).toFixed(4)) };
  }
  const cap = handle === "start" ? geometry.startCap : geometry.endCap;
  const x = handle === "start" ? pointer.x - cap.x : cap.x - pointer.x;
  const y = handle === "start" ? pointer.y - cap.y : cap.y - pointer.y;
  if (Math.hypot(x, y) < 2) return null;
  const angle = wrapDegrees((Math.atan2(y, x) - geometry.chordAngle) * 180 / Math.PI);
  const safeAngle = Number(clamp(angle, -70, 70).toFixed(2));
  return handle === "start" ? { startAngle: safeAngle } : { endAngle: safeAngle };
}

/**
 * A short join with a much larger cap is prone to overlapping outline edges.
 * A non-blocking geometric caution, not a calligraphic quality judgment.
 */
export function isRibbonWidthRisk(
  spec: RibbonLink, geometry: RibbonHandleGeometry,
): boolean {
  return Math.max(spec.startWidth, spec.endWidth) > geometry.anchorDistance * 0.7;
}
