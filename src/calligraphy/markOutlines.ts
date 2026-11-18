import { Buffer } from "buffer";
import type { FontPreset, HarakaId } from "./model";
import { HARAKAT, safePath } from "./model";
import { parseOutline } from "./pathEditor";
import { loadFontBytes } from "./shaping";

/** Normalize one genuine font-drawn diacritic into the same 100×100 viewport
 * as the legacy editor marks. Existing marks remain unchanged. Handles and
 * control points are transformed together, preserving holes and curvature.
 * This never claims to manufacture a Thuluth-style glyph. */
export function normalizeMarkPath(svg: string): string | null {
  const segments = parseOutline(svg);
  if (!segments?.length) return null;
  const points = segments.flatMap((segment) => {
    const value = segment.values;
    const coords: { x: number; y: number }[] = [];
    for (let i = 0; i < value.length; i += 2) {
      coords.push({ x: value[i]!, y: value[i + 1]! });
    }
    return coords;
  });
  if (!points.length) return null;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const w = maxX - minX, h = maxY - minY;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0.001 || h < 0.001) return null;
  const scale = 88 / Math.max(w, h);
  const shiftX = (100 - w * scale) / 2;
  const shiftY = (100 - h * scale) / 2;
  const normalized = segments.map((segment) => {
    if (segment.cmd === "Z") return "Z";
    const transformed = segment.values.map((value, i) => {
      const mapped = i % 2 === 0
        ? shiftX + (value - minX) * scale
        : shiftY + (maxY - value) * scale;
      return Number(mapped.toFixed(4)).toString();
    });
    return segment.cmd + transformed.join(" ");
  }).join(" ");
  return safePath(normalized) || null;
}

/** Read a proper diacritic outline from the selected licensed OpenType font.
 * This is preferable to reusing a generic ornament-shaped accent; source
 * designers decide the exact contour, while the studio keeps manual placement. */
export async function markPathFromTypeface(
  mark: HarakaId, fontName: FontPreset, customFontData?: string,
): Promise<string> {
  const entry = HARAKAT.find((item) => item.id === mark);
  const codepoint = entry?.glyph.codePointAt(0);
  if (codepoint === undefined) throw new Error("الحركة المطلوبة غير معروفة.");
  const data = await loadFontBytes(fontName, customFontData);
  const kit = await import("fontkit");
  const face = kit.create(Buffer.from(data));
  if (!face.hasGlyphForCodePoint(codepoint)) {
    throw new Error("الخط المختار لا يدعم هذه الحركة. اختر خطًا آخر أو الرسم اليدوي المبسط.");
  }
  const glyph = face.glyphForCodePoint(codepoint);
  const shape = normalizeMarkPath(glyph.path.toSVG());
  if (!shape) throw new Error("تعذر قراءة حدود الحركة من الخط. اختر نمط الرسم اليدوي المبسط.");
  return shape;
}
