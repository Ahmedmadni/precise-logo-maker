import { HARAKAT, ORNAMENTS, type LetteringItem } from "../../calligraphy/model";

export type LayerCategory = "all" | "words" | "marks" | "ornaments" | "shapes";

const harakaLabels = new Map(HARAKAT.map((entry) => [entry.id, entry.label]));
const ornamentLabels = new Map(ORNAMENTS.map((entry) => [entry.id, entry.label]));

/** Searching Arabic words with or without tashkeel should give the same result. */
export function normalizeLayerSearch(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/\s+/g, " ").trim();
}

export function matchesLayerSearch(query: string, ...terms: (string | null | undefined)[]): boolean {
  const normalized = normalizeLayerSearch(query);
  if (!normalized) return true;
  return terms.some((term) => normalizeLayerSearch(term ?? "").includes(normalized));
}

export function letteringLayerLabel(item: LetteringItem): string {
  if (item.kind === "haraka") return harakaLabels.get(item.mark ?? "fatha") ?? "حركة تشكيل";
  if (item.kind === "ornament") return ornamentLabels.get(item.ornament ?? "leaf") ?? "زخرفة";
  if (item.kind === "bridge") return "وصلة منحنية بين الحروف";
  if (item.kind === "text") return item.text || "نص";
  return item.sourceText || "حرف فيكتور";
}

export function layerCategoryForItem(item: LetteringItem): Exclude<LayerCategory,"all" | "words" | "shapes"> | "words" {
  if (item.kind === "haraka") return "marks";
  if (item.kind === "ornament" || item.kind === "bridge") return "ornaments";
  return "words";
}

export function matchesLayerCategory(
  requested: LayerCategory, actual: Exclude<LayerCategory, "all">,
): boolean {
  return requested === "all" || requested === actual;
}
