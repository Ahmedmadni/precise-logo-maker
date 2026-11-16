import { useState } from "react";
import { ChevronDown, ChevronLeft, Circle, Layers3, MousePointer2, PenLine, Search, Sparkles, Type, X } from "lucide-react";
import { useStudio } from "../../store/studioStore";
import {
  letteringLayerLabel, layerCategoryForItem, matchesLayerCategory, matchesLayerSearch,
  type LayerCategory,
} from "./layerCatalog";

const row = "flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-start text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary";
const filters: { id: LayerCategory; title: string }[] = [
  { id: "all", title: "الكل" },
  { id: "words", title: "الكلمات" },
  { id: "marks", title: "الحركات" },
  { id: "ornaments", title: "الزخارف" },
  { id: "shapes", title: "الأشكال" },
];

export function StudioLayersPanel() {
  const doc = useStudio((s) => s.doc);
  const glyphId = useStudio((s) => s.selectedLetteringId);
  const selection = useStudio((s) => s.selection);
  const selectGlyph = useStudio((s) => s.selectLettering);
  const selectShapes = useStudio((s) => s.setSelection);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LayerCategory>("all");
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const letters = doc.lettering ?? [];
  const byId = new Map(letters.map((item) => [item.id, item]));
  const groups = new Map<string, typeof letters>();
  const standalone = letters.filter((item) => !item.groupId);
  for (const glyph of letters) {
    if (!glyph.groupId) continue;
    const group = groups.get(glyph.groupId) ?? [];
    group.push(glyph);
    groups.set(glyph.groupId, group);
  }
  const linkedWord = (itemId?: string): string | undefined => {
    const owner = byId.get(itemId ?? "");
    return owner?.sourceText;
  };

  const visibleGroups = [...groups].filter(([, glyphs]) =>
    matchesLayerCategory(category, "words") &&
    glyphs.some((g) => matchesLayerSearch(query, g.sourceText, letteringLayerLabel(g))));
  const visibleStandalone = standalone.filter((item) =>
    matchesLayerCategory(category, layerCategoryForItem(item)) &&
    matchesLayerSearch(query, letteringLayerLabel(item), item.sourceText, linkedWord(item.attachedToGlyphId)));
  const visibleShapes = doc.objects.filter((item) =>
    matchesLayerCategory(category, "shapes") &&
    matchesLayerSearch(query, item.name, "شكل هندسي"));
  const visibleCount = visibleGroups.length + visibleStandalone.length + visibleShapes.length;
  const totalCount = groups.size + standalone.length + doc.objects.length;
  const isFiltering = query.trim().length > 0 || category !== "all";

  const selectLetter = (id: string) => {
    selectGlyph(id);
    setSection("edit");
  };
  const selectObject = (id: string) => {
    selectShapes([id]);
    setSection("edit");
  };

  return (
    <div className="space-y-4 pb-5" dir="rtl">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">عناصر التصميم</h3>
        <p className="text-xs leading-5 text-muted-foreground">ابحث عن الكلمة أو الحركة أو الشكل، ثم اختر العنصر لتعديله.</p>
        <p className="text-[11px] text-muted-foreground">عدد العناصر والمجموعات: {totalCount}</p>
      </header>

      {totalCount > 0 && <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن كلمة أو حركة أو زخرفة..."
            aria-label="البحث في عناصر التصميم"
            className="min-h-12 w-full rounded-xl border border-border bg-background pe-10 ps-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
        <nav aria-label="تصفية عناصر التصميم" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {filters.map(({ id, title }) => (
            <button type="button" key={id} aria-pressed={category === id} onClick={() => setCategory(id)}
              className={`min-h-11 shrink-0 rounded-lg border px-3 text-xs font-semibold transition-colors ${category === id ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>
              {title}
            </button>
          ))}
        </nav>
        <p aria-live="polite" className="text-xs text-muted-foreground">النتائج: {visibleCount}</p>
      </div>}

      {totalCount === 0 && <div className="rounded-xl border border-dashed border-primary/30 p-4 text-center">
        <Layers3 className="mx-auto mb-2 h-7 w-7 text-primary" />
        <p className="text-sm font-semibold">مساحة التصميم فارغة</p>
        <p className="mt-1 text-xs text-muted-foreground">ابدأ بإضافة كلمة أو ارسم شكلا هندسيا.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className={row + " justify-center"} onClick={() => setSection("text")}><Type className="h-4 w-4" />كتابة</button>
          <button type="button" className={row + " justify-center"} onClick={() => setSection("draw")}><PenLine className="h-4 w-4" />رسم</button>
        </div>
      </div>}

      {totalCount > 0 && visibleCount === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center">
        <Search className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold">لا توجد عناصر مطابقة</p>
        <p className="mt-1 text-xs text-muted-foreground">غيّر كلمة البحث أو اعرض جميع العناصر.</p>
        {isFiltering && <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold">
          <X className="h-4 w-4" />إزالة الفلاتر
        </button>}
      </div>}

      {visibleGroups.length > 0 && <section className="space-y-2">
        <h4 className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>الكلمات المركبة</span><span>{visibleGroups.length}</span>
        </h4>
        {visibleGroups.map(([groupId, glyphs]) => {
          const isSelected = glyphs.some((g) => g.id === glyphId);
          const expanded = query.trim().length > 0 || (opened[groupId] ?? isSelected);
          return <section key={groupId} className="rounded-xl border border-border bg-card">
            <button type="button" onClick={() => setOpened((s) => ({ ...s, [groupId]: !expanded }))}
              aria-expanded={expanded} aria-label={`عرض أجزاء كلمة ${glyphs[0]?.sourceText ?? "عربية"}`}
              className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-start">
              <span className="flex min-w-0 items-center gap-2">
                <Type className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-semibold">{glyphs[0]?.sourceText ?? "كلمة عربية"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                {glyphs.length} أشكال
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </span>
            </button>
            {expanded && <div className="space-y-1 border-t border-border p-2">
              {glyphs.map((item, i) => (
                <button key={item.id} type="button" aria-current={glyphId === item.id ? "true" : undefined}
                  className={row + (glyphId === item.id ? " border-primary/70 bg-primary/10" : "")}
                  onClick={() => selectLetter(item.id)}>
                  <MousePointer2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex-1 text-start">شكل حرفي {item.glyphIndex !== undefined ? item.glyphIndex + 1 : i + 1}</span>
                  <span className="text-[11px] text-muted-foreground">تعديل</span>
                </button>
              ))}
            </div>}
          </section>;
        })}
      </section>}

      {visibleStandalone.length > 0 && <section className="space-y-2">
        <h4 className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>الحركات والزخارف والعناصر المستقلة</span><span>{visibleStandalone.length}</span>
        </h4>
        {visibleStandalone.map((item) => {
          const owner = linkedWord(item.attachedToGlyphId);
          return <button type="button" key={item.id} aria-current={glyphId === item.id ? "true" : undefined}
            className={row + (glyphId === item.id ? " border-primary/70 bg-primary/10" : "")}
            onClick={() => selectLetter(item.id)}>
            {item.kind === "ornament" || item.kind === "haraka"
              ? <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              : <Type className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate">{letteringLayerLabel(item)}</span>
              {owner && <span className="block truncate text-[11px] text-muted-foreground">مرتبطة بكلمة {owner}</span>}
            </span>
            <span className="text-[11px] text-muted-foreground">تعديل</span>
          </button>;
        })}
      </section>}

      {visibleShapes.length > 0 && <section className="space-y-2">
        <h4 className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>الأشكال الهندسية</span><span>{visibleShapes.length}</span>
        </h4>
        {visibleShapes.map((item) => (
          <button type="button" key={item.id} aria-current={selection.includes(item.id) ? "true" : undefined}
            className={row + (selection.includes(item.id) ? " border-primary/70 bg-primary/10" : "")}
            onClick={() => selectObject(item.id)}>
            <Circle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-start">{item.name || "شكل هندسي"}</span>
            <span className="text-[11px] text-muted-foreground">تعديل</span>
          </button>
        ))}
      </section>}
    </div>
  );
}
