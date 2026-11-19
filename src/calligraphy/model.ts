import type { RibbonLink } from "./ribbonJoin";
import { buildRibbonPath } from "./ribbonJoin";

/**
 * Core calligraphy document model. Text is editable for drafts; "outline" stores
 * actual font-shaped vector glyph paths, detached from the source font.
 * Each shaped run keeps a groupId so ligatures can be shaped together and
 * individual glyphs then moved, resized or recolored without breaking joining.
 */
export type HarakaId = "fatha" | "damma" | "kasra" | "shadda" | "sukun" | "tanween-fath" | "tanween-kasr" | "tanween-damm" | "dagger-alif" | "maddah" | "hamza-above" | "hamza-below" | "subscript-alif" | "inverted-damma" | "small-waw" | "small-yeh" | "small-high-seen" | "small-high-meem";
export type OrnamentId = "leaf" | "star8" | "rosette" | "teardrop" | "diamond" | "kashida";
export type FontPreset = "Amiri" | "Aref Ruqaa" | "Scheherazade New" | "Gulzar" | "Noto Naskh Arabic" | "serif" | "Custom Thuluth";

export interface LetteringItem {
  id: string;
  kind: "text" | "haraka" | "outline" | "ornament" | "bridge";
  /** Only false hides an item. Retained in .logo for non-destructive baking. */
  hidden?: boolean;
  /** Baked clipping geometry uses parity-aware compound contours. */
  fillRule?: "evenodd" | "nonzero";
  /** Original source IDs preserved for reversible outline baking. */
  bakedSourceIds?: string[];
  /** Tracks an attached haraka's original glyph while its owner is baked. */
  bakedOriginalAttachment?: { glyphId: string; anchorMode: "auto" | "manual" };
  x: number;
  y: number;
  /** Pixel height (font size for an outline). */
  size: number;
  rotation: number;
  color: string;
  scaleX?: number;
  scaleY?: number;
  /** Shear angles in degrees, limited for predictable Bézier editing. */
  skewX?: number;
  skewY?: number;
  /** An optional stroke that makes the outlined glyph optically heavier. */
  weight?: number;
  /** Offset in artboard pixels relative to the main calligraphy baseline. */
  baselineOffset?: number;
  /** Glyph anchor which this diacritic follows, if any. */
  attachedToGlyphId?: string | undefined;
  anchorMode?: "auto" | "manual";
  stackOrder?: number;
  text?: string;
  font?: FontPreset;
  mark?: HarakaId;
  /** Real vector diacritic contour from a licensed OpenType font, normalized to 100x100. */
  markPathData?: string;
  ornament?: OrnamentId;
  /** Built-in independent catalog symbol, not a contextual OpenType glyph. */
  catalogShapeId?: string;
  /** Permanent outline produced from OpenType shaping; no live font needed. */
  pathData?: string;
  /** Editable, dynamically rendered connection between two other outlined glyphs. */
  ribbon?: RibbonLink;
  unitsPerEm?: number;
  /** One word/run can have several independently editable outlined glyphs. */
  groupId?: string | undefined;
  sourceText?: string;
  /** OpenType variant tag used when this word was shaped (if the font supports it). */
  alternateFeature?: string | undefined;
  /** Concrete font glyph ID, not a Unicode code point. */
  fontGlyphId?: number | undefined;
  /** Manual SVG contour labels. No implicit anatomical identification. */
  contourRoles?: Record<string, "unassigned" | "head" | "body" | "tail" | "join" | "dot" | "counter">;
  /** Local font-unit entry and exit markers, NOT part of printed artwork. */
  joinAnchors?: { entry?: { x: number; y: number }; exit?: { x: number; y: number } };
  glyphIndex?: number;
}

export const FONT_PRESETS: FontPreset[] = ["Amiri", "Aref Ruqaa", "Scheherazade New", "Gulzar", "Custom Thuluth", "Noto Naskh Arabic", "serif"];

export const FONT_DESCRIPTIONS: Partial<Record<FontPreset, string>> = {
  Amiri: "نسخ كلاسيكي",
  "Aref Ruqaa": "رقعة",
  "Scheherazade New": "نسخ زخرفي",
  Gulzar: "نستعليق / فارسي",
  "Custom Thuluth": "اختَر ملفك المرخص (لا يشترط أن يكون ثلثا)",
};

export const HARAKAT: { id: HarakaId; glyph: string; label: string; path: string }[] = [
  { id: "fatha", glyph: "َ", label: "فتحة", path: "M 8 37 Q 45 27 92 12 L 92 24 Q 53 38 8 48 Z" },
  { id: "kasra", glyph: "ِ", label: "كسرة", path: "M 8 65 Q 45 55 92 40 L 92 52 Q 53 66 8 76 Z" },
  { id: "damma", glyph: "ُ", label: "ضمة", path: "M 18 36 C 0 8 44 0 55 21 C 66 44 36 56 21 43 Q 26 69 78 67 Q 87 66 94 59 C 80 86 24 85 14 57 Q 10 47 18 36 Z" },
  { id: "sukun", glyph: "ْ", label: "سكون", path: "M 51 15 C 75 15 84 36 72 55 C 60 75 27 70 23 48 C 18 29 30 15 51 15 Z M 51 28 C 36 28 32 42 41 53 C 49 62 65 56 66 44 C 67 34 60 28 51 28 Z" },
  { id: "shadda", glyph: "ّ", label: "شدة", path: "M 16 13 L 27 13 L 31 41 Q 38 48 48 40 L 48 19 L 60 19 L 60 41 Q 68 47 77 39 L 80 15 L 93 15 L 88 48 Q 77 66 57 53 Q 38 68 20 52 Z" },
  { id: "tanween-fath", glyph: "ً", label: "تنوين فتح", path: "M 8 27 L 91 9 L 91 20 L 8 39 Z M 8 50 L 91 32 L 91 43 L 8 62 Z" },
  { id: "tanween-kasr", glyph: "ٍ", label: "تنوين كسر", path: "M 8 48 L 91 30 L 91 41 L 8 60 Z M 8 69 L 91 51 L 91 62 L 8 81 Z" },
  { id: "tanween-damm", glyph: "ٌ", label: "تنوين ضم", path: "M 10 29 C 2 10 32 3 41 21 C 51 41 24 48 14 36 Q 19 53 48 49 L 48 58 Q 10 65 10 29 Z M 52 29 C 43 10 76 3 84 21 C 94 41 67 48 56 36 Q 61 53 94 49 L 94 58 Q 52 65 52 29 Z" },
  { id: "dagger-alif", glyph: "ٰ", label: "ألف خنجرية", path: "M45 12 L57 8 L53 82 L42 88 Z" },
  { id: "maddah", glyph: "ٓ", label: "مدّة", path: "M8 50 Q25 18 49 39 Q69 57 92 24 L92 40 Q70 74 46 53 Q25 33 8 66 Z" },
  { id: "hamza-above", glyph: "ٔ", label: "همزة فوق", path: "M72 20 Q40 8 30 34 Q25 48 52 52 L18 66 L22 78 L85 51 L80 41 Q45 51 43 35 Q44 22 69 32 Z" },
  { id: "hamza-below", glyph: "ٕ", label: "همزة تحت", path: "M72 20 Q40 8 30 34 Q25 48 52 52 L18 66 L22 78 L85 51 L80 41 Q45 51 43 35 Q44 22 69 32 Z" },
  { id: "subscript-alif", glyph: "ٖ", label: "ألف صغيرة تحت", path: "M45 12 L57 8 L53 82 L42 88 Z" },
  { id: "inverted-damma", glyph: "ٗ", label: "ضمة مقلوبة", path: "M80 36 C98 8 54 0 43 21 C32 44 62 56 77 43 Q72 69 20 67 L4 59 C18 86 74 85 84 57 Q88 47 80 36 Z" },
  { id: "small-waw", glyph: "ۥ", label: "واو صغيرة", path: "M18 36 C0 8 44 0 55 21 C66 44 36 56 21 43 Q28 72 80 69 L94 59 Q76 94 37 85 Q8 73 18 36 Z" },
  { id: "small-yeh", glyph: "ۦ", label: "ياء صغيرة", path: "M70 18 Q90 28 80 45 L54 58 Q26 76 12 48 L5 55 Q17 94 60 74 L89 56 Q104 32 78 9 Z M35 87 L43 81 L52 89 L44 96 Z M58 87 L66 81 L75 89 L67 96 Z" },
  { id: "small-high-seen", glyph: "ۜ", label: "سين صغيرة فوق", path: "M12 25 L23 25 L25 48 Q35 60 43 46 L44 27 L55 27 L55 48 Q64 58 74 45 L78 20 L89 20 L86 52 Q73 73 51 60 Q32 77 15 58 Z" },
  { id: "small-high-meem", glyph: "ۢ", label: "ميم صغيرة فوق", path: "M48 15 Q77 9 82 38 Q80 65 51 58 L29 49 L18 88 L7 83 L23 36 Q31 17 48 15 Z M47 29 Q35 35 43 44 Q62 55 68 41 Q68 26 47 29 Z" },
];

/** Original SVG paths, deliberately simple and editable: not third-party assets. */
export const ORNAMENTS: { id: OrnamentId; label: string; path: string }[] = [
  { id: "leaf", label: "ورقة", path: "M 9 87 Q 5 17 88 6 Q 96 80 9 87 Z M 13 85 Q 40 49 88 6 M 38 56 L 37 27 M 58 36 L 80 41" },
  { id: "star8", label: "نجمة ثمانية", path: "M 50 2 L 61 28 L 85 15 L 72 39 L 98 50 L 72 61 L 85 85 L 61 72 L 50 98 L 39 72 L 15 85 L 28 61 L 2 50 L 28 39 L 15 15 L 39 28 Z" },
  { id: "rosette", label: "وردة هندسية", path: "M 50 5 C 67 20 67 30 50 50 C 33 30 33 20 50 5 Z M 95 50 C 80 67 70 67 50 50 C 70 33 80 33 95 50 Z M 50 95 C 33 80 33 70 50 50 C 67 70 67 80 50 95 Z M 5 50 C 20 33 30 33 50 50 C 30 67 20 67 5 50 Z M 50 16 L 84 50 L 50 84 L 16 50 Z" },
  { id: "teardrop", label: "دمعة", path: "M 50 3 C 72 30 90 52 84 72 C 79 92 60 98 50 98 C 25 98 12 82 16 63 C 19 46 40 17 50 3 Z" },
  { id: "diamond", label: "معين", path: "M 50 2 L 98 50 L 50 98 L 2 50 Z M 50 20 L 80 50 L 50 80 L 20 50 Z" },
  { id: "kashida", label: "امتداد زخرفي", path: "M 0 52 C 35 40 65 40 100 52 L 100 61 C 66 49 34 49 0 61 Z" },
];

export const isHaraka = (v: unknown): v is HarakaId => typeof v === "string" && HARAKAT.some((m) => m.id === v);
export const isOrnament = (v: unknown): v is OrnamentId => typeof v === "string" && ORNAMENTS.some((m) => m.id === v);
const uid = (): string => crypto.randomUUID();

export const createLettering = (x: number, y: number): LetteringItem => ({
  id: `letter-${uid()}`, kind: "text", x, y, size: 92, rotation: 0,
  color: "#e8eaf0", text: "اسم العلامة", font: "Amiri",
});
export const createHaraka = (mark: HarakaId, x: number, y: number): LetteringItem => ({
  id: `mark-${uid()}`, kind: "haraka", mark, x, y, size: 32, rotation: 0, color: "#e8eaf0",
});
export const createOrnament = (ornament: OrnamentId, x: number, y: number): LetteringItem => ({
  id: `ornament-${uid()}`, kind: "ornament", ornament, x, y, size: 75, rotation: 0, color: "#d1a95e",
});

export const fontFamily = (font: FontPreset | undefined): string => {
  switch (font) {
    case "Custom Thuluth": return '"Custom Thuluth", "Amiri", serif';
    case "Aref Ruqaa": return '"Aref Ruqaa", serif';
    case "Scheherazade New": return '"Scheherazade New", serif';
    case "Gulzar": return '"Gulzar", serif';
    case "Noto Naskh Arabic": return '"Noto Naskh Arabic", serif';
    case "serif": return "serif";
    default: return '"Amiri", serif';
  }
};
export const xmlEscape = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const safeColor = (value: string | undefined): string =>
  typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : "#e8eaf0";
export const safePath = (path: string | undefined): string =>
  typeof path === "string" && path.length <= 500_000 &&
  /^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-Ee\s]+$/.test(path) ? path : "";

export const letteringTransform = (item: LetteringItem): string => {
  const x = Number.isFinite(item.x) ? item.x : 0;
  const y = Number.isFinite(item.y) ? item.y : 0;
  const angle = Number.isFinite(item.rotation) ? item.rotation : 0;
  const sx = Number.isFinite(item.scaleX) ? Math.max(-20, Math.min(20, item.scaleX ?? 1)) : 1;
  const sy = Number.isFinite(item.scaleY) ? Math.max(-20, Math.min(20, item.scaleY ?? 1)) : 1;
  const skewX = Number.isFinite(item.skewX) ? Math.max(-60, Math.min(60, item.skewX ?? 0)) : 0;
  const skewY = Number.isFinite(item.skewY) ? Math.max(-60, Math.min(60, item.skewY ?? 0)) : 0;
  return `translate(${x} ${y}) rotate(${angle}) skewX(${skewX}) skewY(${skewY}) scale(${sx} ${sy})`;
};

export const letteringSvg = (item: LetteringItem, allItems: LetteringItem[] = []): string => {
  if (item.hidden) return "";
  if (item.kind === "bridge") {
    const path = safePath(buildRibbonPath(item, allItems) ?? undefined);
    return path ? `  <path d="${path}" fill="${safeColor(item.color)}" />` : "";
  }
  const size = Number.isFinite(item.size) ? Math.max(1, Math.min(1000, item.size)) : 48;
  const attrs = `transform="${letteringTransform(item)}" fill="${safeColor(item.color)}"`;
  const outlineWidth = Number.isFinite(item.weight) ? Math.max(0, Math.min(20, item.weight ?? 0)) : 0;
  if (item.kind === "outline") {
    const d = safePath(item.pathData);
    if (!d) return "";
    const units = Number.isFinite(item.unitsPerEm) && (item.unitsPerEm ?? 0) > 0 ? item.unitsPerEm! : 1000;
    const s = size / units;
    return `  <g ${attrs}><path d="${d}" transform="scale(${s} ${-s})" fill-rule="${item.fillRule === "evenodd" ? "evenodd" : "nonzero"}" stroke="${safeColor(item.color)}" stroke-width="${outlineWidth ? outlineWidth / s : 0}" stroke-linejoin="round" /></g>`;
  }
  if (item.kind === "haraka" || item.kind === "ornament") {
    const shape = item.kind === "haraka"
      ? HARAKAT.find((m) => m.id === item.mark)
      : ORNAMENTS.find((m) => m.id === item.ornament);
    if (!shape) return "";
    const path = item.kind === "haraka" ? safePath(item.markPathData) || shape.path : shape.path;
    return `  <g ${attrs}><path d="${path}" transform="translate(${-size / 2} ${-size / 2}) scale(${size / 100})" fill-rule="evenodd" /></g>`;
  }
  const family = xmlEscape(fontFamily(item.font));
  return `  <g ${attrs}><text x="0" y="0" font-size="${size}" font-family="${family}" direction="rtl" unicode-bidi="plaintext" text-anchor="middle">${xmlEscape((item.text ?? "").slice(0, 300))}</text></g>`;
};
