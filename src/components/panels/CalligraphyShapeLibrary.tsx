import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Grid2X2, Heart, LayoutList, LibraryBig, Plus, Search, X } from "lucide-react";
import {
  CATEGORY_LABELS, CATALOG_DRAG_MIME, SHAPE_CATALOG, createCatalogShape, filterCatalog,
  type CatalogShape, type LibraryView,
} from "../../calligraphy/shapeCatalog";
import { useStudio } from "../../store/studioStore";
import { outlinePreviewViewBox } from "../../calligraphy/catalogGeometry";
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

/** The preview and final item use the identical vector path and winding. */
function ShapePreview({ shape, large = false }: { shape: CatalogShape; large?: boolean }) {
  return (
    <svg role="img" aria-label={"المعاينة المتجهية للشكل: " + shape.label}
      viewBox={outlinePreviewViewBox(shape.path)}
      preserveAspectRatio="xMidYMid meet"
      className={(large ? "h-40 max-h-[28dvh] sm:h-52" : "h-full") + " w-full text-foreground"}>
      <g transform="scale(1 -1)">
        <path d={shape.path} fill="currentColor" fillRule="evenodd" />
      </g>
    </svg>
  );
}

/**
 * Indexed offline calligraphic vectors. The thumbnails are the same underlying
 * paths inserted as editable outline items, never bitmap image stickers.
 */
export function CalligraphyShapeLibrary({ onCreated }: { onCreated?: (() => void) | undefined }) {
  const [category, setCategory] = useState<LibraryView>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [stayInLibrary, setStayInLibrary] = useState(true);
  const [insertSize, setInsertSize] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [message, setMessage] = useState("");
  const doc = useStudio((s) => s.doc);
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const addLettering = useStudio((s) => s.addLettering);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const filtered = useMemo(
    () => filterCatalog(query, category, favorites),
    [query, category, favorites],
  );
  const existing = (doc.lettering ?? []).find((shape) => shape.id === selectedId);
  const previewShape = SHAPE_CATALOG.find((shape) => shape.id === previewId) ?? null;
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
    addLettering(insertSize === null ? item : { ...item, size: insertSize });
    setMessage("أُضيف " + entry.label + " كمسار فيكتور مستقل قابل للتحرير.");
    if (stayInLibrary) setSection("ornaments");
    else { setSection("edit"); onCreated?.(); }
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
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPreviewId(null); }}
          placeholder="ابحث: شدة، نقطة، كشيدة، قطرة..."
          className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pe-10 ps-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      </label>

      <nav aria-label="تصنيف الأشكال العربية"
        className="flex max-w-full gap-1.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {CATEGORY_LABELS.map((tab) => (
          <button key={tab.id} type="button" aria-pressed={category === tab.id}
            onClick={() => { setCategory(tab.id); setPreviewId(null); }}
            className={"min-h-10 shrink-0 rounded-xl border px-3 text-[11px] font-semibold transition-colors " +
              (category === tab.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>
        ))}
      </nav>

      {category !== "mine" && (
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-xs">
          <span className="min-w-0 leading-5">
            إبقاء المكتبة مفتوحة لإضافة عدة أشكال
          </span>
          <input type="checkbox" checked={stayInLibrary}
            onChange={(event) => setStayInLibrary(event.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
        </label>
      )}
      {category !== "mine" && <label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border px-3 text-xs">
        حجم الشكل عند الإدراج
        <select className="min-h-10 rounded-lg border border-border bg-background px-2" value={insertSize ?? ""} onChange={(e) => setInsertSize(e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">الحجم الأصلي</option>
          {[25, 50, 75, 100, 150, 200, 300].map((size) => <option key={size} value={size}>{size} px</option>)}
        </select>
      </label>}
      {previewShape && category !== "mine" && (
        <div className="space-y-2 rounded-2xl border border-primary/40 bg-card p-3"
          aria-label={"معاينة مكبرة: " + previewShape.label}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-xs font-bold">{previewShape.label}</h4>
              <p className="text-[11px] text-muted-foreground">تفاصيل الشكل قبل الإدراج</p>
            </div>
            <button type="button" onClick={() => setPreviewId(null)}
              aria-label="إغلاق المعاينة المكبرة"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-border bg-background p-4">
            <ShapePreview shape={previewShape} large />
          </div>
          <button type="button" onClick={() => insert(previewShape)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" aria-hidden /> إدراج {previewShape.label}
          </button>
        </div>
      )}
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
          <div className={view === "grid"
            ? "grid grid-cols-2 gap-2 min-[460px]:grid-cols-3"
            : "flex flex-col gap-2"}>
            {filtered.map((shape) => {
              const favored = favorites.includes(shape.id);
              return (
                <article key={shape.id}
                  className={"min-w-0 rounded-2xl border border-border bg-background p-2 transition-colors hover:border-primary/50 " +
                    (view === "list" ? "flex items-center gap-2.5" : "flex flex-col gap-2")}>
                  <button type="button" draggable
                    title="اضغط لإدراج الشكل أو اسحبه إلى لوحة الرسم على الكمبيوتر"
                    aria-label={"إضافة " + shape.label + " إلى اللوحة"}
                    onClick={() => insert(shape)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData(CATALOG_DRAG_MIME, shape.id);
                    }}
                    className={"flex min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-transparent bg-card focus-visible:outline-2 focus-visible:outline-primary " +
                      (view === "list" ? "h-[88px] w-20" : "h-24 w-full")}>
                    <div className="flex h-full w-full max-w-[148px] items-center justify-center p-2">
                      <ShapePreview shape={shape} />
                    </div>
                  </button>
                  <div className={"min-w-0 flex-1 space-y-2 " + (view === "list" ? "self-stretch" : "")}>
                    <div className="min-h-10 space-y-0.5">
                      <h4 title={shape.label} className="line-clamp-2 text-[11px] font-semibold leading-5">
                        {shape.label}
                      </h4>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {CATEGORY_LABELS.find((item) => item.id === shape.category)?.label} · SVG
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-1" role="group"
                      aria-label={"أوامر " + shape.label}>
                      <button type="button" title={"إدراج " + shape.label}
                        aria-label={"إدراج " + shape.label}
                        onClick={() => insert(shape)}
                        className="flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary">
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                      <button type="button" title={"معاينة " + shape.label}
                        aria-label={"معاينة مكبرة " + shape.label}
                        aria-pressed={previewId === shape.id}
                        onClick={() => setPreviewId(previewId === shape.id ? null : shape.id)}
                        className={"flex min-h-11 min-w-0 items-center justify-center rounded-xl border focus-visible:outline-2 focus-visible:outline-primary " +
                          (previewId === shape.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                        <Eye className="h-4 w-4" aria-hidden />
                      </button>
                      <button type="button"
                        aria-label={favored ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                        aria-pressed={favored}
                        title={favored ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                        onClick={() => toggleFavorite(shape.id)}
                        className={"flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-border focus-visible:outline-2 focus-visible:outline-primary " +
                          (favored ? "text-primary" : "text-muted-foreground")}>
                        <Heart className="h-4 w-4" fill={favored ? "currentColor" : "none"} aria-hidden />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            الإضافة بالنقر تعمل على الجوال والكمبيوتر. اضغط على أيقونة العين لمعاينة الشكل مكبرًا، أو اسحب البطاقة إلى لوحة الكمبيوتر.
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
