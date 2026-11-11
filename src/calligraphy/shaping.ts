import type { FontPreset, LetteringItem } from "./model";
import type { Font } from "fontkit";
import { Buffer } from "buffer";

/** Bundled OFL fonts — no remote CDN and no request to the Lovable backend. */
const FONT_URLS: Partial<Record<FontPreset, () => Promise<string>>> = {
  Amiri: () => import("@fontsource/amiri/files/amiri-arabic-400-normal.woff?url").then((m) => m.default),
  "Aref Ruqaa": () => import("@fontsource/aref-ruqaa/files/aref-ruqaa-arabic-400-normal.woff?url").then((m) => m.default),
  "Scheherazade New": () => import("@fontsource/scheherazade-new/files/scheherazade-new-arabic-400-normal.woff?url").then((m) => m.default),
  Gulzar: () => import("@fontsource/gulzar/files/gulzar-arabic-400-normal.woff?url").then((m) => m.default),
};

const rawFont = new Map<string, Promise<Uint8Array>>();
async function getFont(font: FontPreset, custom?: string): Promise<Uint8Array> {
  const loader = FONT_URLS[font];
  const source = font === "Custom Thuluth" ? custom : loader ? await loader() : undefined;
  if (!source) throw new Error("اختر أحد الخطوط المدمجة أو استورد خط ثلث مرخصا أولا.");
  if (!rawFont.has(source)) {
    rawFont.set(source, fetch(source).then(async (response) => {
      if (!response.ok) throw new Error("تعذر تحميل ملف الخط.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 100 || bytes.byteLength > 3_000_000) throw new Error("حجم ملف الخط غير صالح.");
      return bytes;
    }).catch((error: unknown) => {
      rawFont.delete(source);
      throw error;
    }));
  }
  return rawFont.get(source)!;
}

export interface ComposeOptions {
  phrase: string;
  font: FontPreset;
  size: number;
  x: number;
  y: number;
  color: string;
  customFontData?: string | undefined;
}

/**
 * Shape the ENTIRE Arabic phrase first, then return editable vector glyphs.
 * Shaping at the Unicode-letter level destroys contextual joins and ligatures.
 * All per-glyph paths are saved in the document; subsequent dragging is cheap.
 */
export async function composeArabicOutlines(options: ComposeOptions): Promise<LetteringItem[]> {
  const phrase = options.phrase.normalize("NFC").trim();
  if (!phrase || phrase.length > 120) throw new Error("اكتب عبارة من حرف واحد إلى 120 حرفا.");
  if (!Number.isFinite(options.size) || options.size < 10 || options.size > 600) {
    throw new Error("حجم الخط يجب أن يكون بين 10 و600.");
  }
  const bytes = await getFont(options.font, options.customFontData);
  // Lazy-load the heavier font parser only when the user creates outlines.
  const fontkit = await import("fontkit");
  const font = fontkit.create(Buffer.from(bytes));
  return shapeArabicWithFont(font, { ...options, phrase });
}

/** Pure shaping adapter: testable with a locally bundled font, no fetch/network. */
export function shapeArabicWithFont(font: Font, options: ComposeOptions): LetteringItem[] {
  const phrase = options.phrase.normalize("NFC").trim();
  const run = font.layout(phrase, undefined, "arab", "ARA", "rtl");
  if (!run.glyphs?.length || run.glyphs.length !== run.positions?.length) {
    throw new Error("تعذر تشكيل الحروف بهذا الخط.");
  }
  const units = font.unitsPerEm || 1000;
  const s = options.size / units;
  const totalAdvance = run.positions.reduce((sum, p) => sum + p.xAdvance, 0);
  let cursor = -totalAdvance / 2;
  const groupId = `word-${crypto.randomUUID()}`;
  const output: LetteringItem[] = [];
  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index]!;
    const pos = run.positions[index]!;
    const d = glyph.path.toSVG();
    if (d) {
      output.push({
        id: `glyph-${crypto.randomUUID()}`, kind: "outline",
        x: options.x + (cursor + pos.xOffset) * s,
        y: options.y - pos.yOffset * s,
        size: options.size,
        rotation: 0,
        color: options.color,
        font: options.font,
        groupId, glyphIndex: index, sourceText: phrase,
        pathData: d,
        unitsPerEm: units,
      });
    }
    cursor += pos.xAdvance;
  }
  if (!output.length) throw new Error("لا يحتوي الخط المختار على رسومات لهذه العبارة.");
  return output;
}
