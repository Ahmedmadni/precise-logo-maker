import type { LetteringItem } from "./model";
import { safePath } from "./model";
import { parseOutline } from "./pathEditor";

export interface GlyphLibraryAppearance {
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  weight: number;
  color: string;
}

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
  /** Preserve compound-path counters in baked or imported Arabic outlines. */
  fillRule?: "evenodd" | "nonzero";
  /** Preserve manually chosen entry/exit points for later stroke joining. */
  joinAnchors?: LetteringItem["joinAnchors"];
  /** Preserve user-assigned contour roles for the path editor. */
  contourRoles?: LetteringItem["contourRoles"];
  /** Preserve optical adjustments for standalone reuse, never impose them
   * on an existing glyph position in a connected Arabic word. */
  appearance?: GlyphLibraryAppearance;
}

export const GLYPH_LIBRARY_FORMAT = "logo-studio-calligraphy-library";
export const GLYPH_LIBRARY_VERSION = 1;
export const GLYPH_LIBRARY_LIMIT = 80;
const MAX_PATH_BYTES = 150_000;
const MAX_LIBRARY_BYTES = 1_800_000;
const MAX_IMPORTED_BYTES = 2_000_000;

const validAppearance = (value: unknown): value is GlyphLibraryAppearance => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const a = value as Partial<GlyphLibraryAppearance>;
  return typeof a.rotation === "number" && Math.abs(a.rotation) <= 360 &&
    typeof a.scaleX === "number" && Math.abs(a.scaleX) <= 20 &&
    typeof a.scaleY === "number" && Math.abs(a.scaleY) <= 20 &&
    typeof a.skewX === "number" && Math.abs(a.skewX) <= 60 &&
    typeof a.skewY === "number" && Math.abs(a.skewY) <= 60 &&
    typeof a.weight === "number" && a.weight >= 0 && a.weight <= 20 &&
    typeof a.color === "string" && /^#[0-9a-fA-F]{6}$/.test(a.color);
};

const validPoint = (point: unknown): boolean => {
  if (!point || typeof point !== "object" || Array.isArray(point)) return false;
  const p = point as { x?: unknown; y?: unknown };
  return typeof p.x === "number" && Number.isFinite(p.x) && Math.abs(p.x) <= 100000 &&
    typeof p.y === "number" && Number.isFinite(p.y) && Math.abs(p.y) <= 100000;
};
const validJoinAnchors = (v: unknown): boolean => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const anchors = v as { entry?: unknown; exit?: unknown };
  return (anchors.entry === undefined || validPoint(anchors.entry)) &&
    (anchors.exit === undefined || validPoint(anchors.exit));
};
const validContourRoles = (v: unknown): boolean => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const allowed = new Set(["unassigned", "head", "body", "tail", "join", "dot", "counter"]);
  const entries = Object.entries(v);
  return entries.length <= 300 && entries.every(([key, role]) =>
    /^\\d{1,4}$/.test(key) && allowed.has(role as string));
};

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
      e.glyphIndex >= 0 && e.glyphIndex < 500)) &&
    (e.appearance === undefined || validAppearance(e.appearance)) &&
    (e.fillRule === undefined || e.fillRule === "nonzero" || e.fillRule === "evenodd") &&
    (e.joinAnchors === undefined || validJoinAnchors(e.joinAnchors)) &&
    (e.contourRoles === undefined || validContourRoles(e.contourRoles));
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
    appearance: {
      rotation: item.rotation,
      scaleX: item.scaleX ?? 1,
      scaleY: item.scaleY ?? 1,
      skewX: item.skewX ?? 0,
      skewY: item.skewY ?? 0,
      weight: item.weight ?? 0,
      color: item.color,
    },
    ...(item.fillRule ? { fillRule: item.fillRule } : {}),
    ...(item.joinAnchors ? { joinAnchors: {
      ...(item.joinAnchors.entry ? { entry: { ...item.joinAnchors.entry } } : {}),
      ...(item.joinAnchors.exit ? { exit: { ...item.joinAnchors.exit } } : {}),
    } } : {}),
    ...(item.contourRoles ? { contourRoles: { ...item.contourRoles } } : {}),
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
  if (existing.length > GLYPH_LIBRARY_LIMIT || incoming.length > GLYPH_LIBRARY_LIMIT) return null;
  const result = [...existing];
  const usedIds = new Set(existing.map((item) => item.id));
  const key = (item: GlyphLibraryEntry) =>
    [item.pathData, item.unitsPerEm, item.sourceText ?? "", item.glyphIndex ?? ""].join("|");
  const seen = new Set(result.map(key));
  if (!existing.every(validateGlyphLibraryEntry)) return null;
  for (const entry of incoming) {
    if (!validateGlyphLibraryEntry(entry)) return null;
    if (seen.has(key(entry))) continue;
    if (result.length >= GLYPH_LIBRARY_LIMIT) return null;
    const finalEntry = usedIds.has(entry.id) ? {
      ...entry, id: `saved-glyph-${crypto.randomUUID()}`,
    } : entry;
    result.push(finalEntry);
    usedIds.add(finalEntry.id);
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
    selected.unitsPerEm === entry.unitsPerEm &&
    (entry.sourceFont === undefined || selected.font === entry.sourceFont) &&
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
    x, y, size, color: entry.appearance?.color ?? color,
    rotation: entry.appearance?.rotation ?? 0,
    scaleX: entry.appearance?.scaleX ?? 1,
    scaleY: entry.appearance?.scaleY ?? 1,
    skewX: entry.appearance?.skewX ?? 0,
    skewY: entry.appearance?.skewY ?? 0,
    weight: entry.appearance?.weight ?? 0,
    pathData: entry.pathData, unitsPerEm: entry.unitsPerEm,
    fillRule: entry.fillRule ?? "nonzero",
    ...(entry.joinAnchors ? { joinAnchors: {
      ...(entry.joinAnchors.entry ? { entry: { ...entry.joinAnchors.entry } } : {}),
      ...(entry.joinAnchors.exit ? { exit: { ...entry.joinAnchors.exit } } : {}),
    } } : {}),
    ...(entry.contourRoles ? { contourRoles: { ...entry.contourRoles } } : {}),
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
