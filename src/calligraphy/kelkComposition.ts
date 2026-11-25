import type { LetteringItem } from "./model";
import { createRibbonLink, buildRibbonPath, isValidRibbon } from "./ribbonJoin";
import { worldJoinAnchor } from "./contourComposer";

export type KelkSlantPresetId = "vertical" | "thuluth" | "ruqaa" | "nastaliq";
export type KelkLayoutStyle = "cascade" | "interlock" | "arch" | "reset";
export type KashidaStyle = "flat" | "arch" | "wave";

export interface KelkSlantPreset {
  id: KelkSlantPresetId;
  label: string;
  skewX: number;
  rotation: number;
}

export const KELK_SLANT_PRESETS: KelkSlantPreset[] = [
  { id: "vertical", label: "عمودي", skewX: 0, rotation: 0 },
  { id: "thuluth", label: "ثلث", skewX: -6, rotation: -2 },
  { id: "ruqaa", label: "رقعة", skewX: -12, rotation: -4 },
  { id: "nastaliq", label: "نستعليق", skewX: -18, rotation: -6 },
];

export type LetteringPatchEntry = { id: string; patch: Partial<LetteringItem> };

const round = (n: number): number => Number(n.toFixed(2));

/** Sort glyphs in Arabic reading order (right-to-left by x coordinate). */
function sortRtl(items: LetteringItem[]): LetteringItem[] {
  return [...items].sort((a, b) => b.x - a.x);
}

/** Apply a Kelk pen-slant preset to one or more lettering items. */
export function applyGroupSlant(
  items: LetteringItem[],
  preset: Pick<KelkSlantPreset, "skewX" | "rotation">,
): LetteringPatchEntry[] {
  return items
    .filter((item) => item.kind === "outline" || item.kind === "text")
    .map((item) => ({
      id: item.id,
      patch: { skewX: preset.skewX, rotation: preset.rotation },
    }));
}

/**
 * Arrange a word/group of glyphs in classic Kelk calligraphy compositions:
 * - cascade: gentle descending diagonal step in RTL order
 * - interlock: alternating elevation with tighter horizontal overlap
 * - arch: parabolic curve with automatic tangent rotation
 * - reset: restore flat baseline and zero rotation/skew
 */
export function composeWordLayout(
  items: LetteringItem[],
  style: KelkLayoutStyle,
  intensity = 1,
): LetteringPatchEntry[] {
  const glyphs = sortRtl(items.filter((i) => i.kind === "outline" || i.kind === "text"));
  if (glyphs.length === 0) return [];
  const k = Math.max(0.25, Math.min(3, Number.isFinite(intensity) ? intensity : 1));
  const avgSize = glyphs.reduce((sum, g) => sum + g.size, 0) / glyphs.length;
  const baseY = glyphs[0]!.y;

  if (style === "reset") {
    return glyphs.map((g) => ({
      id: g.id,
      patch: { y: round(baseY), rotation: 0, skewX: 0, skewY: 0 },
    }));
  }

  if (style === "cascade") {
    const stepY = avgSize * 0.12 * k;
    const pullX = avgSize * 0.04 * k;
    return glyphs.map((g, idx) => ({
      id: g.id,
      patch: {
        x: round(g.x + idx * pullX),
        y: round(baseY + idx * stepY),
        rotation: round(-3 * k),
      },
    }));
  }

  if (style === "interlock") {
    const lift = avgSize * 0.16 * k;
    const centerX = glyphs.reduce((s, g) => s + g.x, 0) / glyphs.length;
    return glyphs.map((g, idx) => {
      const dir = idx % 2 === 0 ? -1 : 1;
      const pulledX = centerX + (g.x - centerX) * Math.max(0.7, 1 - 0.12 * k);
      return {
        id: g.id,
        patch: {
          x: round(pulledX),
          y: round(baseY + dir * lift * 0.5),
          rotation: round(dir * -2.5 * k),
        },
      };
    });
  }

  // arch
  const minX = Math.min(...glyphs.map((g) => g.x));
  const maxX = Math.max(...glyphs.map((g) => g.x));
  const span = Math.max(1, maxX - minX);
  const midX = (minX + maxX) / 2;
  const archHeight = avgSize * 0.35 * k;

  return glyphs.map((g) => {
    const u = (g.x - midX) / (span / 2); // -1 .. 1
    const dy = -archHeight * (1 - u * u);
    const slopeDeg = Math.atan2(2 * archHeight * u, span / 2) * (180 / Math.PI);
    return {
      id: g.id,
      patch: {
        y: round(baseY + dy),
        rotation: round(Math.max(-35, Math.min(35, slopeDeg))),
      },
    };
  });
}

/** Pull glyphs closer together (negative deltaPx) or spread apart (positive deltaPx) around group center. */
export function adjustGroupOverlap(items: LetteringItem[], deltaPx: number): LetteringPatchEntry[] {
  const glyphs = sortRtl(items.filter((i) => i.kind === "outline" || i.kind === "text"));
  if (glyphs.length < 2 || !Number.isFinite(deltaPx) || deltaPx === 0) return [];
  const midIdx = (glyphs.length - 1) / 2;
  return glyphs.map((g, idx) => {
    // In RTL order, idx 0 is rightmost (+x), last idx is leftmost (-x).
    const offset = (midIdx - idx) * deltaPx;
    return { id: g.id, patch: { x: round(g.x + offset) } };
  });
}

/**
 * Build a closed, editable calligraphic kashida outline in 1000-unit font space
 * (baseline near y = 0, upward is +y in font coordinates).
 */
export function buildKashidaOutline(options: {
  length: number;
  arch: number;
  thickness: number;
  style: KashidaStyle;
}): string | null {
  const length = Math.max(120, Math.min(2400, options.length));
  const thickness = Math.max(24, Math.min(220, options.thickness));
  const arch = Math.max(-320, Math.min(320, options.arch));
  if (!Number.isFinite(length) || !Number.isFinite(thickness) || !Number.isFinite(arch)) return null;

  const half = length / 2;
  const t = thickness;
  const taper = Math.max(12, t * 0.45);

  if (options.style === "flat") {
    return `M ${round(-half)} ${round(taper)} L ${round(half)} ${round(taper)} L ${round(half)} 0 L ${round(-half)} 0 Z`;
  }

  if (options.style === "arch") {
    const cY = arch;
    return [
      `M ${round(-half)} ${round(taper)}`,
      `Q 0 ${round(cY + t)} ${round(half)} ${round(taper)}`,
      `L ${round(half)} 0`,
      `Q 0 ${round(cY)} ${round(-half)} 0`,
      "Z",
    ].join(" ");
  }

  // wave (S-curve calligraphic kashida)
  const q = length / 4;
  const a = arch === 0 ? 90 : arch;
  return [
    `M ${round(-half)} ${round(taper)}`,
    `C ${round(-q)} ${round(a + t)} ${round(q)} ${round(-a + t)} ${round(half)} ${round(taper)}`,
    `L ${round(half)} 0`,
    `C ${round(q)} ${round(-a)} ${round(-q)} ${round(a)} ${round(-half)} 0`,
    "Z",
  ].join(" ");
}

/** Create a ready-to-insert LetteringItem for a calligraphic kashida next to the selected glyph. */
export function createKashidaItem(
  anchor: LetteringItem,
  options: { length: number; arch: number; thickness: number; style: KashidaStyle },
): LetteringItem | null {
  const pathData = buildKashidaOutline(options);
  if (!pathData) return null;
  return {
    id: `kashida-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "outline",
    x: round(anchor.x - anchor.size * 0.35),
    y: anchor.y,
    size: anchor.size,
    rotation: anchor.rotation,
    color: anchor.color,
    skewX: anchor.skewX ?? 0,
    skewY: anchor.skewY ?? 0,
    pathData,
    unitsPerEm: 1000,
    ...(anchor.groupId ? { groupId: anchor.groupId } : {}),
    sourceText: "ـ",
  };
}

/** Connected alternative to the independent decorative outline.
 * The user chooses the target explicitly; the ribbon follows both glyphs.
 * Length follows anchor separation, not the decorative outline length slider.
 */
export function createConnectedKashida(
  source: LetteringItem,
  target: LetteringItem,
  options: { arch: number; thickness: number; style: KashidaStyle },
): LetteringItem | null {
  if (source.hidden || target.hidden || !Number.isFinite(options.arch) ||
      !Number.isFinite(options.thickness)) return null;
  const item = createRibbonLink(source, target);
  if (!item?.ribbon) return null;
  const start = worldJoinAnchor(source, "exit"), end = worldJoinAnchor(target, "entry");
  if (!start || !end) return null;
  const distance = Math.hypot(end.x-start.x, end.y-start.y);
  if (!Number.isFinite(distance) || distance < 2) return null;
  const width = Math.max(0.8, Math.min(150, options.thickness * (source.size + target.size) / 2000));
  const overlap = Math.min(60, distance * 0.1, width * 0.5);
  const curvature = options.style === "arch" ? Math.max(-0.5, Math.min(0.5, options.arch / 640)) : 0;
  // Wave is represented by opposite relative displacement of the tangent
  // handles (equal tangent angles at opposite ends of the chord).
  const angle = options.style === "wave" ? Math.max(-45, Math.min(45, options.arch / 5)) : 0;
  const ribbon = { ...item.ribbon, startWidth: width, endWidth: width,
    startOverlap: overlap, endOverlap: overlap, curvature,
    startAngle: angle, endAngle: angle, nibContrast: 0 };
  const result = { ...item, ribbon, sourceText: "ـ" };
  return isValidRibbon(ribbon) && buildRibbonPath(result, [source,target]) ? result : null;
}
