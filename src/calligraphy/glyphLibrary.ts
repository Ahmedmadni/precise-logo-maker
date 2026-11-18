import type { LetteringItem } from "./model";
import { safePath } from "./model";
import { parseOutline } from "./pathEditor";

export interface GlyphLibraryEntry {
  id: string;
  name: string;
  pathData: string;
  unitsPerEm: number;
  sourceText?: string;
  glyphIndex?: number;
  sourceFont?: string;
  savedSize: number;
  createdAt: string;
}

export const GLYPH_LIBRARY_FORMAT = "logo-studio-calligraphy-library";
export const GLYPH_LIBRARY_VERSION = 1;
export const GLYPH_LIBRARY_LIMIT = 80;
const MAX_PATH_BYTES = 150_000;
const MAX_LIBRARY_BYTES = 1_800_000;
const MAX_IMPORTED_BYTES = 2_000_000;

function isValidOutlinePath(path: unknown): path is string {
  if (typeof path !== "string" || path.length < 10 ||
      path.length > MAX_PATH_BYTES || safePath(path) !== path) return false;
  const commands = parseOutline(path);
  return !!commands && commands.length >= 3 && commands.length <= 10000 &&
    commands[0]?.cmd === "M" && commands.some((command) => command.cmd === "Z");
}

export function validateGlyphLibraryEntry(value: unknown): value is GlyphLibraryEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const e = value as Partial<GlyphLibraryEntry>;
  return typeof e.id === "string" && e.id.length > 0 && e.id.length <= 100 &&
    typeof e.name === "string" && e.name.trim().length > 0 && e.name.length <= 80 &&
    isValidOutlinePath(e.pathData) &&
    Number.isFinite(e.unitsPerEm) && Number.isInteger(e.unitsPerEm) &&
    e.unitsPerEm! >= 100 && e.unitsPerEm! <= 10000 &&
    Number.isFinite(e.savedSize) && e.savedSize! >= 10 && e.savedSize! <= 1000 &&
    typeof e.createdAt === "string" && e.createdAt.length <= 40 &&
    (e.sourceText === undefined || (typeof e.sourceText === "string" && e.sourceText.length <= 120)) &&
    (e.sourceFont === undefined || (typeof e.sourceFont === "string" && e.sourceFont.length <= 90)) &&
    (e.glyphIndex === undefined || (Number.isInteger(e.glyphIndex) &&
      e.glyphIndex >= 0 && e.glyphIndex < 500));
}

export function makeGlyphLibraryEntry(item: LetteringItem, name: string): GlyphLibraryEntry | null {
  const label = name.trim();
  if (item.kind !== "outline" || !isValidOutlinePath(item.pathData) ||
      label.length < 1 || label.length > 80 || item.hidden ||
      !Number.isFinite(item.unitsPerEm) || !Number.isFinite(item.size)) return null;
  const entry: GlyphLibraryEntry = {
    id: `saved-glyph-${crypto.randomUUID()}`,
    name: label,
    pathData: item.pathData!,
    unitsPerEm: item.unitsPerEm!,
    savedSize: item.size,
    createdAt: new Date().toISOString(),
    ...(item.sourceText ? { sourceText: item.sourceText.slice(0, 120) } : {}),
    ...(item.font ? { sourceFont: item.font } : {}),
    ...(item.glyphIndex !== undefined ? { glyphIndex: item.glyphIndex } : {}),
  };
  return validateGlyphLibraryEntry(entry) ? entry : null;
}

/** Deduplicate by actual outline and shaping context; cap document size so a
 * giant user library cannot freeze WebView project autosave. */
export function combineGlyphLibrary(
  existing: GlyphLibraryEntry[], incoming: GlyphLibraryEntry[],
): GlyphLibraryEntry[] | null {
  const result = [...existing];
  const key = (item: GlyphLibraryEntry) =>
    [item.pathData, item.unitsPerEm, item.sourceText ?? "", item.glyphIndex ?? ""].join("|");
  const seen = new Set(result.map(key));
  if (!existing.every(validateGlyphLibraryEntry)) return null;
  for (const entry of incoming) {
    if (!validateGlyphLibraryEntry(entry)) return null;
    if (seen.has(key(entry))) continue;
    if (result.length >= GLYPH_LIBRARY_LIMIT) return null;
    result.push(entry);
    seen.add(key(entry));
  }
  const serializedLength = JSON.stringify(result).length;
  return serializedLength <= MAX_LIBRARY_BYTES ? result : null;
}

/** Deliberately protect contextual joins. A stored outline can replace a
 * selected word-slot only if both word text and OpenType glyph index match.
 * All other artwork can still use the same library shape as an independent
 * new element, never as a silent replacement of a neighboring glyph. */
export function canReplaceWithLibraryEntry(
  selected: LetteringItem | undefined, entry: GlyphLibraryEntry,
): boolean {
  return !!selected && selected.kind === "outline" && !selected.hidden &&
    !!selected.sourceText && selected.sourceText === entry.sourceText &&
    selected.glyphIndex !== undefined && selected.glyphIndex === entry.glyphIndex &&
    !!selected.groupId;
}

export function makeStandaloneLibraryGlyph(
  entry: GlyphLibraryEntry, x: number, y: number,
  size = entry.savedSize, color = "#d1a95e",
): LetteringItem | null {
  if (!validateGlyphLibraryEntry(entry) || !Number.isFinite(x) || !Number.isFinite(y) ||
      !Number.isFinite(size) || size < 10 || size > 1000 ||
      !/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return {
    id: `custom-glyph-${crypto.randomUUID()}`,
    kind: "outline",
    x, y, size, color, rotation: 0,
    pathData: entry.pathData, unitsPerEm: entry.unitsPerEm,
    sourceText: entry.sourceText ?? entry.name,
    alternateFeature: "user-library",
  };
}

export function serializeGlyphLibrary(entries: GlyphLibraryEntry[]): string | null {
  if (!combineGlyphLibrary([], entries)) return null;
  return JSON.stringify({
    format: GLYPH_LIBRARY_FORMAT, version: GLYPH_LIBRARY_VERSION,
    entries,
  }, null, 2);
}

/** Strict portable file import. No SVG scripts, event handlers, bitmaps or font
 * binaries can pass because only numeric M/L/Q/C outlines are accepted. */
export function parseGlyphLibrary(raw: string): GlyphLibraryEntry[] | null {
  if (raw.length > MAX_IMPORTED_BYTES) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const file = data as { format?: unknown; version?: unknown; entries?: unknown };
    if (file.format !== GLYPH_LIBRARY_FORMAT || file.version !== GLYPH_LIBRARY_VERSION ||
        !Array.isArray(file.entries) || file.entries.length > GLYPH_LIBRARY_LIMIT ||
        !file.entries.every(validateGlyphLibraryEntry)) return null;
    return combineGlyphLibrary([], file.entries) ? file.entries as GlyphLibraryEntry[] : null;
  } catch { return null; }
}
