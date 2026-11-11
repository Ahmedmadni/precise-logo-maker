/**
 * Core calligraphy document model. Text is editable for drafts; "outline" stores
 * actual font-shaped vector glyph paths, detached from the source font.
 * Each shaped run keeps a groupId so ligatures can be shaped together and
 * individual glyphs then moved, resized or recolored without breaking joining.
 */
export type HarakaId = "fatha" | "damma" | "kasra" | "shadda" | "sukun" | "tanween-fath" | "tanween-kasr" | "tanween-damm";
export type OrnamentId = "leaf" | "star8" | "rosette" | "teardrop" | "diamond" | "kashida";
export type FontPreset = "Amiri" | "Aref Ruqaa" | "Scheherazade New" | "Gulzar" | "Noto Naskh Arabic" | "serif" | "Custom Thuluth";

export interface LetteringItem {
  id: string;
  kind: "text" | "haraka" | "outline" | "ornament";
  x: number;
  y: number;
  /** Pixel height (font size for an outline). */
  size: number;
  rotation: number;
  color: string;
  scaleX?: number;
  scaleY?: number;
  /** An optional stroke that makes the outlined glyph optically heavier. */
  weight?: number;
  text?: string;
  font?: FontPreset;
  mark?: HarakaId;
  ornament?: OrnamentId;
  /** Permanent outline produced from OpenType shaping; no live font needed. */
  pathData?: string;
  unitsPerEm?: number;
  /** One word/run can have several independently editable outlined glyphs. */
  groupId?: string;
  sourceText?: string;
  glyphIndex?: number;
}

export const FONT_PRESETS: FontPreset[] = ["Amiri", "Aref Ruqaa", "Scheherazade New", "Gulzar", "Custom Thuluth", "Noto Naskh Arabic", "serif"];

export const FONT_DESCRIPTIONS: Partial<Record<FontPreset, string>> = {
  Amiri: "نسخ كلاسيكي",
  "Aref Ruqaa": "رقعة",
  "Scheherazade New": "نسخ زخرفي",
  Gulzar: "نستعليق / فارسي",
  "Custom Thuluth": "خط ثلث مستورد من جهازك",
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
  return `translate(${x} ${y}) rotate(${angle}) scale(${sx} ${sy})`;
};

export const letteringSvg = (item: LetteringItem): string => {
  const size = Number.isFinite(item.size) ? Math.max(1, Math.min(1000, item.size)) : 48;
  const attrs = `transform="${letteringTransform(item)}" fill="${safeColor(item.color)}"`;
  const outlineWidth = Number.isFinite(item.weight) ? Math.max(0, Math.min(10, item.weight ?? 0)) : 0;
  if (item.kind === "outline") {
    const d = safePath(item.pathData);
    if (!d) return "";
    const units = Number.isFinite(item.unitsPerEm) && (item.unitsPerEm ?? 0) > 0 ? item.unitsPerEm! : 1000;
    const s = size / units;
    return `  <g ${attrs}><path d="${d}" transform="scale(${s} ${-s})" stroke="${safeColor(item.color)}" stroke-width="${outlineWidth ? outlineWidth / s : 0}" stroke-linejoin="round" /></g>`;
  }
  if (item.kind === "haraka" || item.kind === "ornament") {
    const shape = item.kind === "haraka"
      ? HARAKAT.find((m) => m.id === item.mark)
      : ORNAMENTS.find((m) => m.id === item.ornament);
    if (!shape) return "";
    return `  <g ${attrs}><path d="${shape.path}" transform="translate(${-size / 2} ${-size / 2}) scale(${size / 100})" fill-rule="evenodd" /></g>`;
  }
  const family = xmlEscape(fontFamily(item.font));
  return `  <g ${attrs}><text x="0" y="0" font-size="${size}" font-family="${family}" direction="rtl" unicode-bidi="plaintext" text-anchor="middle">${xmlEscape((item.text ?? "").slice(0, 300))}</text></g>`;
};
