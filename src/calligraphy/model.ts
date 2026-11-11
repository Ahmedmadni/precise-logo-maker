/**
 * Editable Arabic lettering is stored separately from geometric construction primitives.
 * SVG text stays selectable/editable; glyph outlines require a separate shaping engine.
 */
export type HarakaId = "fatha" | "damma" | "kasra" | "shadda" | "sukun" | "tanween-fath" | "tanween-kasr" | "tanween-damm";
export type FontPreset = "Amiri" | "Noto Naskh Arabic" | "serif" | "Custom Thuluth";

export interface LetteringItem {
  id: string;
  kind: "text" | "haraka";
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
  text?: string;
  font?: FontPreset;
  mark?: HarakaId;
}

export const FONT_PRESETS: FontPreset[] = ["Amiri", "Noto Naskh Arabic", "serif", "Custom Thuluth"];

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

export const isHaraka = (value: unknown): value is HarakaId =>
  typeof value === "string" && HARAKAT.some((mark) => mark.id === value);

export const createLettering = (x: number, y: number): LetteringItem => ({
  id: `letter-${crypto.randomUUID()}`,
  kind: "text",
  x, y,
  size: 92,
  rotation: 0,
  color: "#e8eaf0",
  text: "اسم العلامة",
  font: "Amiri",
});

export const createHaraka = (mark: HarakaId, x: number, y: number): LetteringItem => ({
  id: `mark-${crypto.randomUUID()}`,
  kind: "haraka",
  x, y,
  size: 32,
  rotation: 0,
  color: "#e8eaf0",
  mark,
});

export const fontFamily = (font: FontPreset | undefined): string => {
  switch (font) {
    case "Custom Thuluth": return '"Custom Thuluth", "Amiri", "Noto Naskh Arabic", serif';
    case "Noto Naskh Arabic": return '"Noto Naskh Arabic", serif';
    case "serif": return "serif";
    default: return '"Amiri", "Noto Naskh Arabic", serif';
  }
};

export const xmlEscape = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const letteringSvg = (item: LetteringItem): string => {
  const x = Number.isFinite(item.x) ? item.x : 0;
  const y = Number.isFinite(item.y) ? item.y : 0;
  const size = Number.isFinite(item.size) ? Math.max(1, Math.min(1000, item.size)) : 48;
  const angle = Number.isFinite(item.rotation) ? item.rotation : 0;
  const color = /^#[\da-fA-F]{3,8}$/.test(item.color) ? item.color : "#e8eaf0";
  const attrs = `transform="translate(${x} ${y}) rotate(${angle})" fill="${color}"`;
  if (item.kind === "haraka") {
    const mark = HARAKAT.find((m) => m.id === item.mark);
    if (!mark) return "";
    return `  <g ${attrs}><path d="${mark.path}" transform="translate(${-size / 2} ${-size / 2}) scale(${size / 100})" fill-rule="evenodd" /></g>`;
  }
  const content = xmlEscape((item.text ?? "").slice(0, 300));
  const family = xmlEscape(fontFamily(item.font));
  return `  <g ${attrs}><text x="0" y="0" font-size="${size}" font-family="${family}" direction="rtl" unicode-bidi="plaintext" text-anchor="middle">${content}</text></g>`;
};
