import { useMemo, useRef, useState } from "react";
import { BookmarkPlus, Download, FileUp, LibraryBig, Plus, Search, Trash2 } from "lucide-react";
import {
  canReplaceWithLibraryEntry, parseGlyphLibrary, serializeGlyphLibrary,
  type GlyphLibraryEntry,
} from "../../calligraphy/glyphLibrary";
import { outlineNodes } from "../../calligraphy/pathEditor";
import { useStudio } from "../../store/studioStore";

const button = "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-accent disabled:opacity-40";
const field = "min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm";

function GlyphThumbnail({ entry }: { entry: GlyphLibraryEntry }) {
  const viewBox = useMemo(() => {
    const points = outlineNodes(entry.pathData);
    if (!points.length) return "0 -100 100 100";
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padding = Math.max(10, (maxX - minX + maxY - minY) * 0.04);
    return `${minX - padding} ${-maxY - padding} ${Math.max(20, maxX - minX + 2 * padding)} ${Math.max(20, maxY - minY + 2 * padding)}`;
  }, [entry.pathData]);
  return (
    <svg role="img" aria-label={`معاينة فيكتور: ${entry.name}`}
      viewBox={viewBox} preserveAspectRatio="xMidYMid meet"
      className="h-20 w-full rounded-lg bg-background/80 text-foreground">
      <path d={entry.pathData} transform="scale(1 -1)" fill="currentColor" fillRule="nonzero" />
    </svg>
  );
}

/** Curated project-embedded presets, without remote assets or cloud database.
 * Export/import lets users transfer their own licensed glyph contours between
 * separate design documents and devices. */
export function GlyphLibraryPanel() {
  const entries = useStudio((s) => s.doc.glyphLibrary ?? []);
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const selected = useStudio((s) => (s.doc.lettering ?? []).find((g) => g.id === s.selectedLetteringId));
  const add = useStudio((s) => s.saveGlyphVariant);
  const insert = useStudio((s) => s.insertGlyphVariant);
  const apply = useStudio((s) => s.applyGlyphVariant);
  const remove = useStudio((s) => s.removeGlyphVariant);
  const importVariants = useStudio((s) => s.importGlyphVariants);
  const importInput = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const suggestion = selected?.kind === "outline"
    ? `${selected.sourceText ?? "شكل عربي"} — جزء ${(selected.glyphIndex ?? 0) + 1}`
    : "اسم الشكل المحفوظ";
  const filtered = entries.filter((e) => (
    e.name + " " + (e.sourceText ?? "") + " " + (e.sourceFont ?? "")
  ).toLowerCase().includes(query.trim().toLowerCase()));
  const visible = expanded ? filtered : filtered.slice(0, 16);
  const saveCurrent = () => {
    if (!selectedId) return;
    const result = add(selectedId, name.trim() || suggestion);
    setMessage(result.ok ? "تمت إضافة شكل الحرف إلى مكتبة المشروع." :
      result.reason ?? "تعذر حفظ هذا الشكل.");
    if (result.ok) setName("");
  };
  const useEntry = (entryId: string, mode: "insert" | "replace") => {
    const result = mode === "insert" ? insert(entryId) :
      selectedId ? apply(entryId, selectedId) : { ok: false, reason: "حدد جزءًا أولاً." };
    setMessage(result.ok
      ? mode === "insert" ? "تمت إضافة الشكل كعنصر فيكتور مستقل." : "تم استبدال الجزء المحدد، ويمكن التراجع."
      : result.reason ?? "تعذرت العملية.");
  };
  const exportLibrary = () => {
    const payload = serializeGlyphLibrary(entries);
    if (!payload) { setMessage("المكتبة فارغة أو تحتوي على عناصر غير صالحة."); return; }
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "logo-studio-glyph-library.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMessage("تم تجهيز ملف المكتبة. احتفظ به لاستعمال الأشكال في مشروع آخر.");
  };
  const readLibrary = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > 2_000_000) throw new Error("حجم الملف أكبر من الحد المسموح (2 MB).");
      const parsed = parseGlyphLibrary(await file.text());
      if (!parsed) throw new Error("هذا ليس ملف مكتبة Logo Studio صالحًا.");
      const result = importVariants(parsed);
      setMessage(result.ok ? "تم استيراد الأشكال بعد التحقق من سلامة المسارات." :
        result.reason ?? "تعذر الاستيراد.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "تعذر فتح المكتبة.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <section dir="rtl" className="space-y-3 rounded-xl border border-primary/25 bg-background p-3" aria-label="مكتبة الأشكال الخطاطية">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <LibraryBig className="h-4 w-4 text-primary" /> مكتبة مقاطع الفيكتور
        </h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">{entries.length}/80</span>
      </header>
      <p className="text-xs leading-5 text-muted-foreground">
        احفظ الحروف والمقاطع التي شكّلتها يدويًا لإعادة استخدامها. تحفظ المكتبة داخل ملف
        المشروع (.logo)، ويمكن نقلها بين المشاريع بتصدير ملف JSON واستيراده.
        ليست مكتبة خط ثلث أصلية جاهزة.
      </p>
      {selected?.kind === "outline" && !selected.hidden && (
        <div className="space-y-2 rounded-lg border border-border p-2">
          <label className="block space-y-1 text-xs">
            اسم الشكل المختار
            <input className={field} type="text" maxLength={80}
              value={name} placeholder={suggestion} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="button" onClick={saveCurrent}
            className={button + " w-full border-primary/40 bg-primary/10 text-primary"}>
            <BookmarkPlus className="h-4 w-4" /> حفظ الجزء الحالي في المكتبة
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!entries.length} className={button} onClick={exportLibrary}>
          <Download className="h-4 w-4" /> تصدير المكتبة
        </button>
        <button type="button" disabled={importing} className={button}
          onClick={() => importInput.current?.click()}>
          <FileUp className="h-4 w-4" /> استيراد مكتبة
        </button>
        <input type="file" ref={importInput} accept=".json,application/json" className="hidden"
          onChange={(e) => {
            void readLibrary(e.target.files?.[0]);
            e.target.value = "";
          }} />
      </div>
      {entries.length > 0 && (
        <label className="relative block">
          <span className="sr-only">البحث داخل مكتبة الحروف</span>
          <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            className={field + " pe-9"} placeholder="ابحث باسم المقطع أو الكلمة..." />
        </label>
      )}
      {entries.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          لا توجد أشكال محفوظة. حدد حرفًا فيكتور من اللوحة واحفظه، أو استورد مكتبة من ملف سابق.
        </p>
      )}
      {entries.length > 0 && filtered.length === 0 && <p className="text-xs text-muted-foreground">
        لا توجد أشكال مطابقة للبحث.
      </p>}
      {visible.length > 0 && <div className="grid grid-cols-2 gap-2">
        {visible.map((entry) => {
          const compatible = canReplaceWithLibraryEntry(selected, entry);
          return (
            <article key={entry.id} className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-2">
              <GlyphThumbnail entry={entry} />
              <h4 className="truncate text-xs font-semibold" title={entry.name}>{entry.name}</h4>
              <p className="truncate text-[10px] text-muted-foreground" title={entry.sourceText}>
                {entry.sourceText ?? "عنصر مستقل"}{entry.glyphIndex === undefined ? "" : ` · مقطع ${entry.glyphIndex + 1}`}
              </p>
              <button type="button" className={button + " w-full"} onClick={() => useEntry(entry.id, "insert")}>
                <Plus className="h-3.5 w-3.5" /> إضافة مستقل
              </button>
              <button type="button" disabled={!compatible}
                title={compatible ? "استبدال الموضع نفسه من الكلمة المطابقة" : "يتطلب تطابق الكلمة ورقم المقطع"}
                className={button + " w-full border-primary/40 text-primary"}
                onClick={() => useEntry(entry.id, "replace")}>
                استبدال الجزء
              </button>
              <button type="button" className="flex min-h-10 w-full items-center justify-center gap-1 text-xs text-destructive"
                title="يمكن التراجع عن الحذف من سجل التعديلات"
                onClick={() => {
                  remove(entry.id);
                  setMessage("حُذف الشكل من المكتبة. يمكن التراجع عن التغيير.");
                }}>
                <Trash2 className="h-3.5 w-3.5" /> حذف
              </button>
            </article>
          );
        })}
      </div>}
      {!expanded && filtered.length > 16 && <button type="button"
        className={button + " w-full"} onClick={() => setExpanded(true)}>
        عرض باقي الأشكال ({filtered.length - 16})
      </button>}
      {expanded && filtered.length > 16 && <button type="button"
        className={button + " w-full"} onClick={() => setExpanded(false)}>
        عرض عدد أقل
      </button>}
      {message && <p role="status" className="rounded-lg border border-border bg-card p-2 text-xs leading-5">
        {message}
      </p>}
      <p className="text-[11px] leading-5 text-muted-foreground">
        استبدال المقطع متاح فقط لنفس الكلمة والموضع، حفاظًا على ترتيب الأجزاء المتصلة.
        الأشكال المستوردة يجب أن تكون من تصميمك أو لديك حق استخدامها؛ المكتبة لا تتضمن خطوطًا أو صورًا مملوكة للغير.
      </p>
    </section>
  );
}
