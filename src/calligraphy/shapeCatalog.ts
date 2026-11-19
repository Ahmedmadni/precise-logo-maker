import type { LetteringItem } from "./model";
import { safePath } from "./model";
import { parseOutline } from "./pathEditor";
import { outlineBounds } from "./catalogGeometry";

/**
 * Original, editable SVG marks inspired by the visual vocabulary of Arabic
 * calligraphy. These are newly drawn geometric examples, not exact tracings
 * or licensed originals from the reference images or any commercial font.
 */
export type ShapeCategory = "harakat" | "dots" | "kashida" | "strokes" | "drops" | "ornaments";
export type LibraryView = ShapeCategory | "all" | "favorites" | "mine";
export interface CatalogShape {
  id: string;
  category: ShapeCategory;
  label: string;
  path: string;
  keywords: string;
  size: number;
}
export const CATEGORY_LABELS: readonly { id: LibraryView; label: string }[] = [
  {
    "id": "all",
    "label": "الكل"
  },
  {
    "id": "harakat",
    "label": "الحركات"
  },
  {
    "id": "dots",
    "label": "النقاط"
  },
  {
    "id": "kashida",
    "label": "الكشائد"
  },
  {
    "id": "strokes",
    "label": "المقاطع"
  },
  {
    "id": "drops",
    "label": "القطرات"
  },
  {
    "id": "ornaments",
    "label": "الزخارف"
  },
  {
    "id": "favorites",
    "label": "المفضلة"
  },
  {
    "id": "mine",
    "label": "مكتبتي"
  }
] as {id:LibraryView;label:string}[];
export const SHAPE_CATALOG: readonly CatalogShape[] = [
  {
    "id": "fatha-flow",
    "category": "harakat",
    "label": "فتحة منحنية",
    "path": "M8 62 C25 55 49 31 90 24 L92 31 C64 38 43 61 11 68 Z",
    "keywords": "فتحة منحنية harakat",
    "size": 90
  },
  {
    "id": "fatha-slim",
    "category": "harakat",
    "label": "فتحة رفيعة طويلة",
    "path": "M4 65 C27 58 61 27 96 22 L96 28 C66 35 31 65 6 71 Z",
    "keywords": "فتحة رفيعة طويلة harakat",
    "size": 90
  },
  {
    "id": "fatha-hook",
    "category": "harakat",
    "label": "فتحة بذيل",
    "path": "M5 69 C24 63 63 30 91 30 Q96 27 94 16 Q90 25 86 26 C48 28 31 63 5 69 Z",
    "keywords": "فتحة بذيل harakat",
    "size": 90
  },
  {
    "id": "kasra-sweep",
    "category": "harakat",
    "label": "كسرة ممتدة",
    "path": "M8 75 C31 73 63 50 93 40 L94 47 C62 61 35 82 8 82 Z",
    "keywords": "كسرة ممتدة harakat",
    "size": 90
  },
  {
    "id": "damma-script",
    "category": "harakat",
    "label": "ضمة خطاطية",
    "path": "M38 23 C23 7 5 20 12 37 C19 55 49 43 49 28 C56 46 43 64 22 58 C34 70 59 64 76 48 L82 53 C58 85 20 78 13 54 C-1 35 9 8 31 12 C50 10 56 28 45 40 C38 50 24 47 21 39 C18 30 28 22 38 23 Z",
    "keywords": "ضمة خطاطية harakat",
    "size": 90
  },
  {
    "id": "damma-long",
    "category": "harakat",
    "label": "ضمة مطولة",
    "path": "M12 47 Q0 28 15 20 C31 12 42 27 34 41 C29 50 17 44 19 35 C25 41 34 32 26 29 C14 26 12 43 22 53 C32 65 60 60 87 32 L92 36 C72 73 35 80 17 64 Q9 57 12 47 Z",
    "keywords": "ضمة مطولة harakat",
    "size": 90
  },
  {
    "id": "shadda-wide",
    "category": "harakat",
    "label": "شدة خطاطية",
    "path": "M8 29 L20 27 L22 48 Q30 60 43 43 L45 28 L56 27 L55 47 Q67 57 78 42 L82 22 L94 20 L90 49 Q76 71 52 56 Q31 77 15 60 Z",
    "keywords": "شدة خطاطية harakat",
    "size": 90
  },
  {
    "id": "sukun-ring",
    "category": "harakat",
    "label": "سكون حلقي",
    "path": "M49 17 C74 17 86 36 77 58 C68 81 28 81 20 56 C10 34 27 17 49 17 Z M49 31 C33 31 28 42 33 54 C39 68 61 67 66 51 C70 39 61 31 49 31 Z",
    "keywords": "سكون حلقي harakat",
    "size": 90
  },
  {
    "id": "maddah-curl",
    "category": "harakat",
    "label": "مدة متموجة",
    "path": "M5 65 Q20 40 38 43 Q58 57 80 31 L94 24 L94 34 Q65 71 38 57 Q20 51 7 73 Z",
    "keywords": "مدة متموجة harakat",
    "size": 90
  },
  {
    "id": "hamza-stroke",
    "category": "harakat",
    "label": "همزة مزخرفة",
    "path": "M70 17 Q43 6 29 25 Q20 39 40 46 Q48 48 56 45 L12 69 L15 79 L87 49 L84 38 Q52 52 43 37 Q36 24 66 27 Z",
    "keywords": "همزة مزخرفة harakat",
    "size": 90
  },
  {
    "id": "tanween-slant",
    "category": "harakat",
    "label": "تنوين مائل",
    "path": "M5 48 C33 41 67 22 92 18 L93 27 C67 31 37 51 8 57 Z M6 68 C35 61 69 42 94 38 L95 47 C68 51 38 72 8 77 Z",
    "keywords": "تنوين مائل harakat",
    "size": 90
  },
  {
    "id": "small-alif-slant",
    "category": "harakat",
    "label": "ألف خنجرية مائلة",
    "path": "M47 6 L61 4 L53 88 L41 91 Z",
    "keywords": "ألف خنجرية مائلة harakat",
    "size": 90
  },
  {
    "id": "dot-diamond",
    "category": "dots",
    "label": "نقطة معينة",
    "path": "M50 18 L75 47 L49 78 L24 49 Z",
    "keywords": "نقطة معينة dots",
    "size": 65
  },
  {
    "id": "dot-slanted",
    "category": "dots",
    "label": "نقطة سن القلم",
    "path": "M20 46 L60 21 L83 51 L43 77 Z",
    "keywords": "نقطة سن القلم dots",
    "size": 65
  },
  {
    "id": "dot-two",
    "category": "dots",
    "label": "نقطتان مائلتان",
    "path": "M12 43 L33 26 L48 46 L27 64 Z M52 50 L73 33 L88 53 L67 71 Z",
    "keywords": "نقطتان مائلتان dots",
    "size": 65
  },
  {
    "id": "dot-three",
    "category": "dots",
    "label": "ثلاث نقاط خطاطية",
    "path": "M37 17 L53 34 L37 52 L21 35 Z M66 38 L83 56 L67 74 L50 56 Z M21 56 L37 74 L21 91 L5 74 Z",
    "keywords": "ثلاث نقاط خطاطية dots",
    "size": 65
  },
  {
    "id": "dot-three-row",
    "category": "dots",
    "label": "ثلاث نقاط أفقية",
    "path": "M8 41 L24 24 L41 42 L25 61 Z M42 41 L58 24 L75 42 L59 61 Z M76 41 L91 24 L99 43 L92 61 Z",
    "keywords": "ثلاث نقاط أفقية dots",
    "size": 65
  },
  {
    "id": "dot-four",
    "category": "dots",
    "label": "أربع نقاط",
    "path": "M17 24 L33 40 L17 56 L1 40 Z M55 24 L71 40 L55 56 L39 40 Z M36 52 L52 68 L36 84 L20 68 Z M74 52 L90 68 L74 84 L58 68 Z",
    "keywords": "أربع نقاط dots",
    "size": 65
  },
  {
    "id": "dot-small",
    "category": "dots",
    "label": "نقطة صغيرة",
    "path": "M49 32 Q61 32 65 45 L50 67 L30 52 Z",
    "keywords": "نقطة صغيرة dots",
    "size": 65
  },
  {
    "id": "dot-pair-vertical",
    "category": "dots",
    "label": "نقطتان رأسيّتان",
    "path": "M49 10 L65 30 L49 49 L33 30 Z M49 51 L65 71 L49 90 L33 71 Z",
    "keywords": "نقطتان رأسيّتان dots",
    "size": 65
  },
  {
    "id": "kashida-light",
    "category": "kashida",
    "label": "كشيدة خفيفة",
    "path": "M5 68 C27 66 57 47 94 43 L94 48 C57 53 31 72 5 73 Z",
    "keywords": "كشيدة خفيفة kashida",
    "size": 130
  },
  {
    "id": "kashida-bold",
    "category": "kashida",
    "label": "كشيدة عريضة",
    "path": "M4 70 C34 67 52 42 96 36 L96 52 C63 57 36 81 4 83 Z",
    "keywords": "كشيدة عريضة kashida",
    "size": 130
  },
  {
    "id": "kashida-rising",
    "category": "kashida",
    "label": "كشيدة صاعدة",
    "path": "M5 82 Q49 72 85 18 L95 13 Q64 75 7 89 Z",
    "keywords": "كشيدة صاعدة kashida",
    "size": 130
  },
  {
    "id": "kashida-falling",
    "category": "kashida",
    "label": "كشيدة هابطة",
    "path": "M10 16 C35 22 61 72 91 75 L94 85 C58 81 29 33 8 28 Z",
    "keywords": "كشيدة هابطة kashida",
    "size": 130
  },
  {
    "id": "kashida-curve",
    "category": "kashida",
    "label": "كشيدة قوسية",
    "path": "M4 68 Q47 12 96 66 L96 77 Q47 26 5 78 Z",
    "keywords": "كشيدة قوسية kashida",
    "size": 130
  },
  {
    "id": "kashida-double",
    "category": "kashida",
    "label": "كشيدة مزدوجة",
    "path": "M5 48 L90 24 L93 30 L8 56 Z M6 73 L92 48 L95 55 L8 81 Z",
    "keywords": "كشيدة مزدوجة kashida",
    "size": 130
  },
  {
    "id": "kashida-triple",
    "category": "kashida",
    "label": "ثلاث شرطات",
    "path": "M7 29 L90 6 L93 14 L10 36 Z M7 53 L90 30 L93 38 L10 60 Z M7 77 L90 54 L93 62 L10 84 Z",
    "keywords": "ثلاث شرطات kashida",
    "size": 130
  },
  {
    "id": "kashida-wave",
    "category": "kashida",
    "label": "كشيدة متموجة",
    "path": "M4 61 Q24 29 45 50 T95 40 L94 52 Q68 75 44 62 Q22 48 5 72 Z",
    "keywords": "كشيدة متموجة kashida",
    "size": 130
  },
  {
    "id": "head-nib",
    "category": "strokes",
    "label": "سن بداية",
    "path": "M18 74 C26 56 46 35 88 21 L93 29 C50 45 38 66 26 81 Z",
    "keywords": "سن بداية strokes",
    "size": 110
  },
  {
    "id": "tail-hook",
    "category": "strokes",
    "label": "ذيل معقوف",
    "path": "M13 10 C18 49 22 74 45 76 Q66 78 84 47 L92 49 Q74 92 43 89 Q10 87 5 14 Z",
    "keywords": "ذيل معقوف strokes",
    "size": 110
  },
  {
    "id": "arc-tail",
    "category": "strokes",
    "label": "قوس خطاطي",
    "path": "M20 88 C2 65 22 28 65 13 Q78 9 88 19 L83 29 Q61 13 37 40 Q17 65 28 81 Z",
    "keywords": "قوس خطاطي strokes",
    "size": 110
  },
  {
    "id": "loop-start",
    "category": "strokes",
    "label": "بداية ملتفة",
    "path": "M14 65 C3 48 18 27 38 24 Q61 23 61 44 Q59 60 45 57 Q31 54 34 41 C43 45 52 45 50 39 C46 30 30 34 24 48 Q15 70 37 77 L33 86 Q22 83 14 65 Z",
    "keywords": "بداية ملتفة strokes",
    "size": 110
  },
  {
    "id": "swan-neck",
    "category": "strokes",
    "label": "رقبة منحنية",
    "path": "M23 88 C13 75 19 60 40 47 Q61 31 55 16 L65 10 Q77 32 51 52 Q28 71 34 85 Z",
    "keywords": "رقبة منحنية strokes",
    "size": 110
  },
  {
    "id": "letter-tail",
    "category": "strokes",
    "label": "ذيل طويل",
    "path": "M9 76 C39 72 68 38 94 20 L96 32 C62 56 42 82 10 88 Z",
    "keywords": "ذيل طويل strokes",
    "size": 110
  },
  {
    "id": "pointed-leaf",
    "category": "strokes",
    "label": "طرف مدبب",
    "path": "M10 78 Q37 48 94 11 Q73 58 13 86 Z",
    "keywords": "طرف مدبب strokes",
    "size": 110
  },
  {
    "id": "curved-tip",
    "category": "strokes",
    "label": "طرف منحني",
    "path": "M9 76 Q40 79 68 61 Q88 47 89 13 L96 17 Q96 76 58 84 Q30 92 10 83 Z",
    "keywords": "طرف منحني strokes",
    "size": 110
  },
  {
    "id": "drop-classic",
    "category": "drops",
    "label": "قطرة رفيعة",
    "path": "M50 5 C54 27 86 43 83 67 C80 86 67 96 50 95 C27 95 16 79 20 60 C25 43 48 22 50 5 Z M50 28 C45 48 31 59 31 69 Q31 84 50 85 Q68 84 70 69 C73 57 55 40 50 28 Z",
    "keywords": "قطرة رفيعة drops",
    "size": 94
  },
  {
    "id": "drop-flame",
    "category": "drops",
    "label": "قطرة لهبية",
    "path": "M44 5 C55 28 79 35 83 62 Q87 87 64 96 Q35 106 21 85 Q9 66 31 43 Q47 27 44 5 Z M50 35 Q52 52 40 64 Q28 80 48 87 Q69 90 71 71 Q73 59 50 35 Z",
    "keywords": "قطرة لهبية drops",
    "size": 94
  },
  {
    "id": "drop-double",
    "category": "drops",
    "label": "قطرة مزدوجة",
    "path": "M36 5 Q44 30 28 47 C6 70 24 94 48 95 Q74 94 73 69 Q71 52 53 35 Q61 57 60 69 Q58 84 45 83 Q32 81 34 67 Q38 55 51 44 C56 30 46 14 36 5 Z",
    "keywords": "قطرة مزدوجة drops",
    "size": 94
  },
  {
    "id": "drop-full",
    "category": "drops",
    "label": "دمعة ممتلئة",
    "path": "M48 3 C65 38 93 55 84 78 Q74 100 50 96 Q26 96 15 79 C5 56 34 26 48 3 Z",
    "keywords": "دمعة ممتلئة drops",
    "size": 94
  },
  {
    "id": "drop-open",
    "category": "drops",
    "label": "قطرة مفتوحة",
    "path": "M40 9 C48 27 72 48 67 67 Q62 84 48 83 Q30 80 28 62 Q23 42 40 9 Z M38 29 Q33 46 38 61 Q40 70 49 70 Q59 67 55 55 Q51 45 38 29 Z",
    "keywords": "قطرة مفتوحة drops",
    "size": 94
  },
  {
    "id": "leaf-swept",
    "category": "ornaments",
    "label": "ورقة ممتدة",
    "path": "M8 83 C20 37 59 8 94 12 Q89 56 13 91 Z M20 78 Q54 38 84 22 L80 31 Q44 52 20 78 Z",
    "keywords": "ورقة ممتدة ornaments",
    "size": 90
  },
  {
    "id": "rosette-small",
    "category": "ornaments",
    "label": "وردة خطاطية",
    "path": "M50 9 Q68 24 50 48 Q32 24 50 9 Z M91 50 Q76 67 51 50 Q76 33 91 50 Z M50 91 Q33 76 50 51 Q67 76 50 91 Z M9 50 Q24 33 49 50 Q24 67 9 50 Z",
    "keywords": "وردة خطاطية ornaments",
    "size": 90
  },
  {
    "id": "crescent-arc",
    "category": "ornaments",
    "label": "قوس زخرفي",
    "path": "M75 12 C43 13 22 38 26 61 C31 88 68 89 86 68 C71 98 24 99 13 69 C3 39 30 7 75 12 Z",
    "keywords": "قوس زخرفي ornaments",
    "size": 90
  },
  {
    "id": "petal-flame",
    "category": "ornaments",
    "label": "بتلة لهبية",
    "path": "M49 9 Q88 52 69 80 C62 95 35 95 27 77 Q17 58 49 9 Z M48 37 C36 57 31 72 45 81 Q62 87 64 70 Q66 56 48 37 Z",
    "keywords": "بتلة لهبية ornaments",
    "size": 90
  }
];

export const CATALOG_DRAG_MIME = "application/x-logo-studio-calligraphy-shape";

/** Arabic search ignoring optional marks, alef variants and Tatweel. */
export function normalizeCatalogSearch(value: string): string {
  return value.toLowerCase().normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .trim();
}
export function filterCatalog(query: string, category: LibraryView = "all", favoriteIds: readonly string[] = []): CatalogShape[] {
  const term = normalizeCatalogSearch(query);
  return SHAPE_CATALOG.filter((shape) =>
    (category === "all" || category === "mine" || category === "favorites" && favoriteIds.includes(shape.id) || shape.category === category) &&
    (category !== "mine") &&
    (!term || normalizeCatalogSearch(shape.label + " " + shape.keywords).includes(term)));
}

export function findCatalogShape(id: string): CatalogShape | undefined {
  return SHAPE_CATALOG.find((shape) => shape.id === id);
}

/**
 * Insert independent editable SVG glyphs, centered by *real* quadratic and
 * cubic curve bounds (not a nominal 100x100 viewBox). Glyph local Y points up
 * whereas screen coordinates point down; the y offset therefore has opposite
 * sign. Identical contours are used for preview, project and SVG export.
 */
export function createCatalogShape(
  id: string, centerX: number, centerY: number, color = "#d1a95e",
): LetteringItem | null {
  const shape = findCatalogShape(id);
  const bounds = shape ? outlineBounds(shape.path) : null;
  if (!bounds || !Number.isFinite(centerX) || !Number.isFinite(centerY) ||
      Math.abs(centerX) > 100000 || Math.abs(centerY) > 100000 ||
      !/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  if (safePath(shape.path) !== shape.path || !parseOutline(shape.path)) return null;
  const scale = shape.size / 100;
  return {
    id: "catalog-" + crypto.randomUUID(),
    kind: "outline",
    catalogShapeId: shape.id,
    x: centerX - bounds.midX * scale,
    y: centerY + bounds.midY * scale,
    size: shape.size,
    rotation: 0,
    color,
    unitsPerEm: 100,
    pathData: shape.path,
    sourceText: shape.label,
    fillRule: "evenodd",
  };
}
