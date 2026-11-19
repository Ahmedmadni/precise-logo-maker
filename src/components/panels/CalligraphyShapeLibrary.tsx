import { useEffect, useMemo, useState } from "react";
import { Check, Grid2X2, Heart, LayoutList, LibraryBig, Plus, Search } from "lucide-react";
import {
  CATEGORY_LABELS, CATALOG_DRAG_MIME, SHAPE_CATALOG, createCatalogShape, filterCatalog,
  type CatalogShape, type LibraryView,
} from "../../calligraphy/shapeCatalog";
import { useStudio } from "../../store/studioStore";
import { GlyphLibraryPanel } from "./GlyphLibraryPanel";

const FAVORITES_KEY = "logo-studio:shape-catalog:favorites:v1";
const button = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary";
function readFavorites(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && SHAPE_CATALOG.some((s) => s.id === id))
      : [];
  } catch { return []; }
}

/**
 * Indexed offline calligraphic vectors. The thumbnails are the same underlying
 * paths inserted as editable outline items, never bitmap image stickers.
 */
export function CalligraphyShapeLibrary({ onCreated }: { onCreated?: () => void }) {
  const [category, setCategory] = useState<LibraryView>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [message, setMessage] = useState("");
  const doc = useStudio((s) => s.doc);
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const addLettering = useStudio((s) => s.addLettering);
  const filtered = useMemo(
    () => filterCatalog(query, category, favorites),
    [query, category, favorites],
  );
  const existing = (doc.lettering ?? []).find((shape) => shape.id === selectedId);
  const lastColor = existing?.color && /^#[0-9a-fA-F]{6}$/.test(existing.color)
    ? existing.color : "#d1a95e";

  useEffect(() => {
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); }
    catch { /* Device storage may be disabled; this does not block drawing. */ }
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id]);
  };
  const insert = (entry: CatalogShape) => {
    const cx = existing ? existing.x + Math.max(45, existing.size / 2) : doc.artboard.width / 2;
    const cy = existing ? existing.y - Math.max(25, existing.size / 3) : doc.artboard.height / 2;
    const item = createCatalogShape(entry.id, cx, cy, lastColor);
    if (!item) {
      setMessage("تعذرت إضافة الشكل؛ المسار غير صالح.");
      return;
    }
    addLettering(item);
    setMessage("أُضيف " + entry.label + " كمسار فيكتور مستقل قابل للتحرير.");
    onCreated?.();
  };

  return (
    <section dir="rtl" className="space-y-3" aria-label="مكتبة التشكيل العربية">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <LibraryBig className="h-5 w-5 text-primary" aria-hidden /> مكتبة التشكيل والخط
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {SHAPE_CATALOG.length} شكلاً متجهيًا محليًا — حركات ونقاط وكشائد ومقاطع وقطرات
          </p>
        </div>
      </div>

      <label className="relative block">
        <span className="sr-only">ابحث في الأشكال العربية</span>
        <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث: شدة، نقطة، كشيدة، قطرة..."
          className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pe-10 ps-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      </label>

      <nav aria-label="تصنيف الأشكال العربية"
        className="flex max-w-full gap-1.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {CATEGORY_LABELS.map((tab) => (
          <button key={tab.id} type="button" aria-pressed={category === tab.id}
            onClick={() => setCategory(tab.id)}
            className={"min-h-10 shrink-0 rounded-xl border px-3 text-[11px] font-semibold transition-colors " +
              (category === tab.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>
        ))}
      </nav>

      {category === "mine" ? (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            هنا الأشكال التي تحفظها بنفسك بعد تعديل مسارات Bézier.
            يمكن استيراد أو تصدير مكتبتك كملف JSON.
          </p>
          <GlyphLibraryPanel />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {filtered.length} نتيجة
              {category === "favorites" ? " • محفوظة على هذا الجهاز" : ""}
            </p>
            <div className="flex items-center gap-1" role="group" aria-label="طريقة عرض الأشكال">
              <button type="button" aria-label="عرض شبكة" aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={button + (view === "grid" ? " border-primary bg-primary/10 text-primary" : "")}>
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button type="button" aria-label="عرض قائمة" aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={button + (view === "list" ? " border-primary bg-primary/10 text-primary" : "")}>
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
          {filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
              لا توجد عناصر مطابقة. جرّب كلمة أخرى أو افتح تصنيف «الكل».
            </p>
          )}
          <div className={view === "grid" ? "grid grid-cols-2 gap-2 min-[460px]:grid-cols-3" : "flex flex-col gap-2"}>
            {filtered.map((shape) => {
              const favored = favorites.includes(shape.id);
              return (
                <article key={shape.id}
                  className={"group min-w-0 rounded-2xl border border-border bg-background p-2 transition-colors hover:border-primary/50 " +
                    (view === "list" ? "flex items-center gap-3" : "space-y-1.5")}>
                  <button type="button" draggable
                    title="اضغط للإضافة أو اسحب الشكل إلى لوحة الرسم على الكمبيوتر"
                    aria-label={"إضافة " + shape.label + " إلى اللوحة"}
                    onClick={() => insert(shape)}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData(CATALOG_DRAG_MIME, shape.id);
                    }}
                    className={"flex min-w-0 items-center justify-center rounded-xl bg-card focus-visible:outline-2 focus-visible:outline-primary " +
                      (view === "list" ? "h-16 w-20 shrink-0" : "h-[88px] w-full")}>
                    <svg viewBox="-8 -8 116 116" aria-hidden="true" className="h-full w-full max-w-[130px] p-2 text-foreground">
                      <g transform="translate(0 100) scale(1 -1)">
                        <path d={shape.path} fill="currentColor" fillRule="evenodd" />
                      </g>
                    </svg>
                  </button>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
                    <div className="min-w-0">
                      <h4 title={shape.label} className="truncate text-[11px] font-semibold">{shape.label}</h4>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {CATEGORY_LABELS.find((c) => c.id === shape.category)?.label} • Vector
                      </p>
                    </div>
                    <button type="button" aria-label={favored ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                      aria-pressed={favored}
                      title={favored ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                      onClick={() => toggleFavorite(shape.id)}
                      className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border " +
                        (favored ? "text-primary" : "text-muted-foreground")}>
                      {favored ? <Heart className="h-4 w-4" fill="currentColor" /> : <Heart className="h-4 w-4" />}
                    </button>
                  </div>
                  {view === "grid" && (
                    <button type="button" onClick={() => insert(shape)}
                      className="flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-primary/35 text-[11px] font-semibold text-primary hover:bg-primary/10">
                      <Plus className="h-3.5 w-3.5" /> إدراج
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            الإضافة بالنقر تعمل على الجوال والكمبيوتر. يمكن سحب البطاقة إلى موقع محدد على لوحة الكمبيوتر.
            العناصر الجديدة مسارات SVG قابلة لتحرير النقاط، ولا تُربط بحرف تلقائيًا.
          </p>
        </>
      )}
      {message && <p role="status" className="flex items-center gap-2 rounded-xl border border-border p-2 text-[11px]">
        <Check className="h-4 w-4 text-primary" aria-hidden /> {message}
      </p>}
      <p className="text-[11px] leading-5 text-muted-foreground">
        الأشكال الأصلية هنا أمثلة خطاطية مرسومة للمحرر مستوحاة من الصور المرجعية،
        وليست نسخًا حرفية من مكتبات أو خطوط تجارية. لإضافة أشكال مأخوذة من خط مرخّص استخدم «من رسم الخط الأصلي».
      </p>
    </section>
  );
}
