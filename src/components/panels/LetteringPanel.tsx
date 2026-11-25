import { useEffect, useMemo, useRef, useState } from "react";
import { Buffer } from "buffer";
import { Layers, LoaderCircle, RotateCcw, Sparkles, Type, WandSparkles, Shapes, PenTool, ChevronDown, ChevronLeft, Search, EyeOff } from "lucide-react";
import {
  FONT_DESCRIPTIONS, HARAKAT, ORNAMENTS, createHaraka, createOrnament,
  type FontPreset, type LetteringItem,
} from "../../calligraphy/model";
import { composeArabicOutlines } from "../../calligraphy/shaping";
import { markPathFromTypeface } from "../../calligraphy/markOutlines";
import { letteringGroupBounds } from "../../calligraphy/morph";
import { LetteringGlyph } from "../canvas/LetteringGlyph";
import { GlyphLibraryPanel } from "./GlyphLibraryPanel";
import { CalligraphyShapeLibrary } from "./CalligraphyShapeLibrary";
import { useStudio } from "../../store/studioStore";
import { placeAttachedHaraka } from "../../calligraphy/harakaAnchoring";
import { insertAtSelection, removeArabicMarks } from "../../calligraphy/textEditing";
import { Button } from "../ui/button";
/* Letter controls are deliberately located in the separate Edit workspace. */

const field = "w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground hover:bg-accent active:scale-[.98] disabled:opacity-40";
const FONTS: FontPreset[] = ["Amiri", "Aref Ruqaa", "Scheherazade New", "Gulzar", "Custom Thuluth"];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Mode = "words" | "marks" | "layers";

export function LetteringPanel({ section, onCreated }: {
  section?: "words" | "marks" | "layers";
  onCreated?: (() => void) | undefined;
} = {}) {
  const doc = useStudio((s) => s.doc);
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const select = useStudio((s) => s.selectLettering);
  const insert = useStudio((s) => s.addLettering);
  const insertBatch = useStudio((s) => s.addLetteringBatch);
  const replaceGroup = useStudio((s) => s.replaceLetteringGroup);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const storedMode = useStudio((s) => s.letteringMode) as Mode;
  const setStoredMode = useStudio((s) => s.setLetteringMode);
  const setWorkspaceSection = useStudio((s) => s.setWorkspaceSection);
  const mode = section ?? storedMode;
  const setMode = (next: Mode) => {
    setStoredMode(next);
    if (section) setWorkspaceSection(next === "words" ? "text" : next === "marks" ? "ornaments" : "layers");
  };
  const [phrase, setPhrase] = useState("المدني");
  const [markCategory, setMarkCategory] = useState<"catalog" | "harakat" | "decorations">("harakat");
  const [markSource, setMarkSource] = useState<"typeface" | "simple">("typeface");
  const [markLoading, setMarkLoading] = useState(false);
  const [font, setFont] = useState<FontPreset>("Amiri");
  const [fontSize, setFontSize] = useState(180);
  const [ink, setInk] = useState("#d1a95e");
  const [busy, setBusy] = useState(false);
  const [previewGlyphs, setPreviewGlyphs] = useState<LetteringItem[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [editRun, setEditRun] = useState<string | null>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const caret = useRef({ start: 0, end: 0 });
  const [markSearch, setMarkSearch] = useState("");
  const [decorationSearch,setDecorationSearch]=useState("");
  const [layerSearch,setLayerSearch]=useState("");
  const [expandedGroup,setExpandedGroup]=useState<string|null>(null);
  const [showHiddenLayers,setShowHiddenLayers]=useState(false);
  const layerKind=(item:LetteringItem)=>item.kind==="outline"?(item.catalogShapeId?"شكل خطاطي":"حرف متجهي"):item.kind==="haraka"?"حركة تشكيل":item.kind==="ornament"?"زخرفة":item.kind==="bridge"?"وصلة":"نص";
  const normalizeSearch=(value:string)=>removeArabicMarks(value).replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").toLocaleLowerCase().trim();
  const matchesSearch=(value:string,query:string)=>normalizeSearch(value).includes(normalizeSearch(query));
  const writeSymbol = (symbol: string) => {
    const result = insertAtSelection(phrase, caret.current.start, caret.current.end, symbol);
    if (result.text.length > 120) return;
    setPhrase(result.text);
    caret.current = { start: result.caret, end: result.caret };
    requestAnimationFrame(() => {
      textInput.current?.focus();
      textInput.current?.setSelectionRange(result.caret, result.caret);
    });
  };

  const previewBounds = useMemo(() => letteringGroupBounds(previewGlyphs), [previewGlyphs]);
  useEffect(() => {
    if (mode !== "words") return;
    let cancelled = false;
    if (!phrase.trim()) {
      setPreviewGlyphs([]);
      setPreviewError("");
      setPreviewBusy(false);
      return;
    }
    setPreviewBusy(true);
    setPreviewError("");
    const delay = setTimeout(() => {
      void composeArabicOutlines({
        phrase, font, size: fontSize, color: ink,
        x: 0, y: 0, customFontData: doc.customThuluthFont,
      }).then((glyphs) => {
        if (!cancelled) { setPreviewGlyphs(glyphs); setPreviewBusy(false); }
      }).catch((reason: unknown) => {
        if (!cancelled) {
          setPreviewGlyphs([]);
          setPreviewBusy(false);
          setPreviewError(reason instanceof Error ? reason.message : "تعذرت معاينة الخط.");
        }
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(delay); };
  }, [mode, phrase, font, fontSize, ink, doc.customThuluthFont]);

  const items = doc.lettering ?? [];
  const selected = items.find((entry) => entry.id === selectedId);
  const attachedTarget = selected?.kind === "outline" ? selected : selected?.kind === "haraka" && selected.attachedToGlyphId ? items.find((item) => item.id === selected.attachedToGlyphId && item.kind === "outline") : undefined;
  const filteredHarakat = HARAKAT.filter(mark => matchesSearch(mark.label,markSearch) || (!!markSearch.trim() && mark.glyph.includes(markSearch.trim())));
  const filteredDecorations=ORNAMENTS.filter(shape=>matchesSearch(shape.label,decorationSearch));
  const grouped = new Map<string, LetteringItem[]>();
  for (const item of items) if (item.groupId) {
    const existing = grouped.get(item.groupId) ?? [];
    existing.push(item);
    grouped.set(item.groupId, existing);
  }

  const visibleGroups=[...grouped].filter(([,glyphs])=>glyphs.some(g=>(showHiddenLayers||!g.hidden)&&matchesSearch(`${g.sourceText??""} ${layerKind(g)}`,layerSearch)));
  const independent=items.filter(item=>!item.groupId&&(showHiddenLayers||!item.hidden)&&matchesSearch(`${item.text??""} ${item.sourceText??""} ${layerKind(item)}`,layerSearch));
  useEffect(() => {
    if (selected?.kind === "outline" && selected.groupId && selected.sourceText) {
      setPhrase(selected.sourceText);
      setFont(selected.font ?? "Amiri");
      setFontSize(selected.size);
      setInk(selected.color);
    }
  }, [selected?.groupId]); // Keep the form stable while editing a selected word.

  const compose = async () => {
    setError("");
    setBusy(true);
    try {
      const rendered = await composeArabicOutlines({
        phrase, font, size: fontSize, color: ink,
        x: doc.artboard.width / 2, y: doc.artboard.height / 2,
        customFontData: doc.customThuluthFont,
      });
      if (editRun) replaceGroup(editRun, rendered);
      else insertBatch(rendered);
      setEditRun(null);
      setWorkspaceSection("edit");
      onCreated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء مسارات الخط.");
    } finally {
      setBusy(false);
    }
  };

  const uploadFont = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name) || file.size > 1_500_000) {
      setError("اختر خطا مرخصا بصيغة TTF / OTF / WOFF أقل من 1.5 ميجابايت.");
      return;
    }
    try {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("تعذر قراءة ملف الخط."));
        reader.readAsDataURL(file);
      });
      const fontkit = await import("fontkit");
      const decoded = new Uint8Array(await file.arrayBuffer());
      const parsed = fontkit.create(Buffer.from(decoded));
      if (!parsed.hasGlyphForCodePoint(0x627)) throw new Error("الخط لا يحتوي على حروف عربية قابلة للتشكيل.");
      useStudio.getState().setCustomThuluthFont(data);
      setFont("Custom Thuluth");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر استيراد الخط.");
    }
  };

  const createMark = async (mark: (typeof HARAKAT)[number]) => {
    setError("");
    const target = selected?.kind === "outline" ? selected :
      selected?.kind === "haraka" && selected.attachedToGlyphId
        ? items.find((item) => item.id === selected.attachedToGlyphId && item.kind === "outline")
        : undefined;
    let markPathData: string | undefined;
    if (markSource === "typeface") {
      setMarkLoading(true);
      try {
        markPathData = await markPathFromTypeface(mark.id, target?.font ?? font, doc.customThuluthFont);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "تعذر تحميل الحركة من الخط المختار.");
        setMarkLoading(false);
        return;
      }
      setMarkLoading(false);
    }
    const item = target
      ? placeAttachedHaraka(mark.id, target, items)
      : createHaraka(mark.id, doc.artboard.width / 2, doc.artboard.height / 2 - 65);
    insert(markPathData ? { ...item, markPathData } : item);
    setWorkspaceSection("edit");
    onCreated?.();
  };
  const createDecoration = (ornament: (typeof ORNAMENTS)[number]) => {
    const x = selected?.x ?? doc.artboard.width / 2;
    const y = selected?.y ?? doc.artboard.height / 2;
    insert(createOrnament(ornament.id, x, y));
    setWorkspaceSection("edit");
    onCreated?.();
  };

  return (
    <div className="space-y-4 pb-6 text-sm" dir="rtl">
      {!section && <div className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1" role="tablist" aria-label="أدوات الخط">
        {([
          ["words", "الكلمات", Type],
          ["marks", "التشكيل والزخارف", Sparkles],
          ["layers", "الحروف والطبقات", Layers],
        ] as const).map(([tab, label, Icon]) => (
          <button type="button" key={tab} role="tab" aria-selected={mode === tab}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-lg px-1 text-[11px] ${mode === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setMode(tab)}>
            <Icon className="h-4 w-4 shrink-0" />{label}
          </button>
        ))}
      </div>}

      {mode === "words" && (
        <section className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold">النص المراد تشكيله</span>
            <textarea ref={textInput} dir="rtl" className={field + " min-h-24 resize-y"} maxLength={120} value={phrase}
              onSelect={(e) => { caret.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
              onChange={(e) => setPhrase(e.target.value)} placeholder="اكتب الكلمة أو العبارة العربية هنا" />
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">تشكيل النص</span>
              <span className="text-xs text-muted-foreground">{phrase.length}/120</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {HARAKAT.map((mark) => <Button key={mark.id} variant="outline" size="icon" className="h-11 w-full"
                title={mark.label} aria-label={`كتابة ${mark.label}`} onMouseDown={(e) => e.preventDefault()}
                onClick={() => writeSymbol(mark.glyph)}>
                <svg viewBox="0 0 100 100" className="size-6" aria-hidden="true"><path d={mark.path} fill="currentColor" fillRule="evenodd" /></svg>
              </Button>)}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button variant="outline" size="sm" aria-label="كتابة تطويل" title="تطويل" onMouseDown={(e) => e.preventDefault()} onClick={() => writeSymbol("ـ")}><span className="text-lg">ـ</span></Button>
              <Button variant="outline" size="sm" onClick={() => setPhrase(removeArabicMarks(phrase))}>إزالة تشكيل النص</Button>
              {selected?.kind === "outline" && selected.groupId && <Button variant="outline" size="sm"
                onClick={() => setEditRun(selected.groupId ?? null)}>تحرير الكلمة المحددة</Button>}
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold">الخط المستخدم في تكوين الحروف</span>
            <select className={field} value={font} onChange={(e) => setFont(e.target.value as FontPreset)}>
              {FONTS.map((value) => <option key={value} value={value}>
                {value === "Custom Thuluth" ? "خط عربي مستورد" : value} — {FONT_DESCRIPTIONS[value]}
              </option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1"><span className="text-xs">حجم الخط</span>
              <input className={field} type="number" min={10} max={600} value={fontSize}
                onChange={(e) => setFontSize(clamp(Number(e.target.value) || 10, 10, 600))} />
            </label>
            <label className="block space-y-1"><span className="text-xs">لون الحبر</span>
              <input className="h-11 w-full cursor-pointer rounded-lg border border-border bg-background p-1" type="color"
                value={ink} onChange={(e) => setInk(e.target.value)} />
            </label>
          </div>
          <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-xl border border-border bg-background p-3 text-center">
            {previewBusy ? <span className="text-xs text-muted-foreground">جار تشكيل مسارات الخط الفعلية...</span>
              : previewError ? <span role="alert" className="text-xs leading-6 text-destructive">{previewError}</span>
              : previewBounds && previewGlyphs.length ? (
                <svg role="img" aria-label="معاينة مسارات الحروف الفعلية التي ستضاف للتصميم"
                  viewBox={`${previewBounds.x - 15} ${previewBounds.y - 15} ${Math.max(60, previewBounds.width + 30)} ${Math.max(60, previewBounds.height + 30)}`}
                  preserveAspectRatio="xMidYMid meet" className="h-36 w-full">
                  {previewGlyphs.map((glyph) => (
                    <LetteringGlyph item={glyph} selected={false} key={glyph.id} />
                  ))}
                </svg>
              ) : <span className="text-xs text-muted-foreground">أدخل كلمة لمعاينة مساراتها.</span>}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            المعاينة الآن من مسارات الخط التي ستضاف فعليًا، لا من خط CSS بديل.
            الخطوط المدمجة الحالية ليست مكتبة ثلث خطاطية متخصصة.
            للحصول على أسلوب ثلث مميز يجب استخدام ملف خط احترافي مرخّص يدعم بدائل الحروف.
          </p>
          <button type="button" disabled={busy || !phrase.trim()} onClick={() => void compose()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <WandSparkles className="h-5 w-5" />}
            {editRun ? "تحديث حروف الكلمة المحددة" : "إضافة الكلمة كحروف قابلة للتعديل"}
          </button>
          {editRun && <button className={button + " w-full"} onClick={() => setEditRun(null)} type="button">إلغاء استبدال الكلمة</button>}
          <p className="text-xs leading-5 text-muted-foreground">بعد إضافة الكلمة اضغط على أي حرف، ثم اختر «تعديل» للتحكم في حجمه، ومكانه، ونقاطه.</p>
          <input ref={fontInput} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => {
            void uploadFont(e.target.files?.[0]); e.target.value = "";
          }} />
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold">خط خاص أو إعدادات متقدمة</summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              استورد خطًا عربيًا مرخصًا بصيغة TTF أو OTF أو WOFF.
              الاستيراد لا يحول أي خط تلقائيًا إلى خط ثلث، ولا ينشئ بدائل خطاطية غير موجودة داخل الملف.
              لتعديل تفاصيل الحروف لاحقًا استخدم «تعديل».
            </p>
            <button className={button + " mt-3 w-full"} type="button" onClick={() => fontInput.current?.click()}>
              استيراد ملف خط (TTF / OTF / WOFF)
            </button>
          </details>
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold">
              مكتبة أشكالي الخطاطية المحفوظة
            </summary>
            <div className="mt-3"><GlyphLibraryPanel /></div>
          </details>
        </section>
      )}

      {mode === "marks" && (
        <section className="space-y-4">
          <nav className="grid grid-cols-3 gap-1.5" aria-label="نوع العنصر المراد إضافته">
            {([
              ["catalog", "الأشكال", Shapes],
              ["harakat", "التشكيل", PenTool],
              ["decorations", "الزخارف", Sparkles],
            ] as const).map(([category, label, Icon]) => (
              <button type="button" key={category} onClick={() => setMarkCategory(category)}
                aria-pressed={markCategory === category}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1 text-[11px] font-semibold ${markCategory === category ? "border-primary bg-primary/15 text-primary" : "border-border bg-background"}`}>
                <Icon className="h-4 w-4" aria-hidden="true"/>{label}
              </button>
            ))}
          </nav>
          {markCategory === "catalog" && <CalligraphyShapeLibrary onCreated={onCreated} />}
          {markCategory === "harakat" && <div>
            <h3 className="mb-2 font-semibold">اختر حركة لإضافتها</h3>
            <div role="status" className="mb-3 rounded-lg border border-border bg-background p-3 text-xs leading-5">
              {attachedTarget ? "سيتم ربط الحركة بالحرف المحدد تلقائيًا، ويمكن تعديل ارتباطها لاحقًا." : "لم يتم تحديد حرف. ستُضاف الحركة مستقلة في منتصف اللوحة؛ حدد حرفًا أولًا لربطها به."}
            </div>
            <input className={field + " mb-3"} type="search" aria-label="البحث في التشكيل" placeholder="ابحث عن حركة أو علامة" value={markSearch} onChange={(e) => setMarkSearch(e.target.value)} />
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={markSource === "typeface"}
                onClick={() => setMarkSource("typeface")}
                className={`min-h-12 rounded-lg border px-2 text-xs font-semibold ${markSource === "typeface"
                  ? "border-primary bg-primary/15 text-primary" : "border-border bg-background"}`}>
                من رسم الخط الأصلي
              </button>
              <button type="button" aria-pressed={markSource === "simple"}
                onClick={() => setMarkSource("simple")}
                className={`min-h-12 rounded-lg border px-2 text-xs font-semibold ${markSource === "simple"
                  ? "border-primary bg-primary/15 text-primary" : "border-border bg-background"}`}>
                أشكال مبسطة
              </button>
            </div>
            <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
              الخيار الأول يستخرج حدود الحركة الفعلية من الخط المحدد للحرف؛
              وإذا لم يكن حرف محددًا يستخدم الخط المختار في قسم الكتابة.
              الرموز داخل الأزرار أمثلة فقط؛ تظهر الحركة الفعلية بعد الإضافة على اللوحة.
            </p>
            <p className="mb-2 text-xs leading-5 text-muted-foreground">
              حدد حرفا أولا لربط الحركة به تلقائيا. ويمكن تغيير موضعها أو فك الارتباط من «تعديل».
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filteredHarakat.map((mark) => (
                <Button variant="outline" key={mark.id} className="h-auto min-h-20 min-w-0 flex-col gap-1 whitespace-normal px-1"
                  type="button" disabled={markLoading} title={mark.label} onClick={() => void createMark(mark)}>
                  <svg viewBox="0 0 100 100" className="h-8 w-10" aria-hidden="true">
                    <path d={mark.path} fill="currentColor" fillRule="evenodd" />
                  </svg><span className="text-xs font-medium">{mark.label}</span>
                </Button>
              ))}
            </div>
            {filteredHarakat.length === 0 && <p className="text-xs text-muted-foreground">لا توجد نتائج.</p>}
          </div>}
          {markCategory === "decorations" && <div>
            <h3 className="mb-2 text-xs font-semibold">الزخارف والامتدادات ({filteredDecorations.length})</h3>
            <input className={field+" mb-2"} type="search" aria-label="البحث في الزخارف" placeholder="ابحث عن زخرفة" value={decorationSearch} onChange={e=>setDecorationSearch(e.target.value)}/>
            <div className="grid grid-cols-3 gap-1.5">
              {filteredDecorations.map((shape) => (
                <button key={shape.id} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary"
                  type="button" onClick={() => createDecoration(shape)}>
                  <svg viewBox="0 0 100 100" className="h-9 w-10" aria-hidden="true">
                    <path d={shape.path} fill="currentColor" stroke="currentColor" strokeWidth="1" fillRule="evenodd" />
                  </svg><span className="text-[11px]">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>}
          {markCategory==="decorations"&&filteredDecorations.length===0&&<p className="text-xs text-muted-foreground">لا توجد زخارف مطابقة.</p>}
          <p className="text-xs leading-5 text-muted-foreground">بعد الإضافة حدّد الحركة أو الزخرفة ثم افتح «تعديل» للتحكم في مكانها وحجمها ولونها.</p>
        </section>
      )}

      {mode === "layers" && (
        <section className="space-y-3">
          <div className="relative">
            <Search className="absolute start-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true"/>
            <input type="search" className={field+" ps-9"} aria-label="البحث في عناصر التصميم" placeholder="ابحث عن كلمة أو نوع عنصر" value={layerSearch} onChange={e=>setLayerSearch(e.target.value)}/>
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-2 text-xs">
            <input type="checkbox" checked={showHiddenLayers} onChange={e=>setShowHiddenLayers(e.target.checked)}/> إظهار العناصر المخفية
          </label>
          <div className="flex items-center justify-between"><h3 className="text-xs font-semibold">الكلمات المركبة</h3><span className="text-xs text-muted-foreground">{visibleGroups.length} / {grouped.size}</span></div>
          {visibleGroups.length===0&&<p className="text-xs text-muted-foreground">لا توجد كلمات مطابقة.</p>}
          {visibleGroups.map(([groupId,glyphs],i)=>{
            const shown=glyphs.filter(g=>showHiddenLayers||!g.hidden);
            const first=shown.find(g=>g.kind==="outline")??shown[0];
            if(!first)return null;
            const expanded=expandedGroup===groupId;
            const containsSelection=glyphs.some(g=>g.id===selectedId);
            return <div key={groupId} className={`rounded-lg border ${containsSelection?"border-primary":"border-border"}`}>
              <div className="flex items-center gap-1 p-1">
                <button type="button" aria-expanded={expanded} aria-label={expanded?"طي عناصر الكلمة":"عرض عناصر الكلمة"} onClick={()=>setExpandedGroup(expanded?null:groupId)} className="flex min-h-10 w-9 shrink-0 items-center justify-center rounded-md hover:bg-secondary">
                  {expanded?<ChevronDown className="h-4 w-4"/>:<ChevronLeft className="h-4 w-4"/>}
                </button>
                <button type="button" onClick={()=>{select(first.id);setExpandedGroup(groupId);}} className="min-h-10 min-w-0 flex-1 truncate text-start text-xs font-semibold">{first.sourceText||`الكلمة ${i+1}`}</button>
                <span className="pe-2 text-[10px] text-muted-foreground">{shown.length} عنصر</span>
              </div>
              {expanded&&<div className="space-y-2 border-t border-border p-2">
                <div className="grid grid-cols-3 gap-1">
                  {shown.map((g,n)=><button type="button" key={g.id} aria-pressed={selectedId===g.id} title={layerKind(g)} onClick={()=>select(g.id)} className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-md border px-1 text-[11px] ${selectedId===g.id?"border-primary bg-primary/10":"border-border"}`}>
                    {g.hidden&&<EyeOff className="h-3 w-3 shrink-0"/>}<span className="truncate">{layerKind(g)} {n+1}</span>
                  </button>)}
                </div>
                <button className={button+" w-full"} type="button" onClick={()=>{
                  setPhrase(first.sourceText??"");setFont(first.font??"Amiri");setFontSize(first.size);setInk(first.color);setEditRun(groupId);setMode("words");
                }}><RotateCcw className="h-4 w-4"/>إعادة تشكيل الكلمة</button>
                {containsSelection&&<button type="button" className={button+" w-full"} onClick={()=>setWorkspaceSection("edit")}>تحرير العنصر المحدد</button>}
              </div>}
            </div>;
          })}
          <div className="flex items-center justify-between"><h3 className="text-xs font-semibold">العناصر المستقلة</h3><span className="text-xs text-muted-foreground">{independent.length}</span></div>
          {independent.length===0&&<p className="text-xs text-muted-foreground">لا توجد عناصر مستقلة مطابقة.</p>}
          <div className="space-y-1">
            {independent.map(item=><button type="button" key={item.id} aria-pressed={selectedId===item.id} onClick={()=>select(item.id)} className={`flex min-h-10 w-full items-center gap-2 rounded-lg border px-2 text-start text-xs ${selectedId===item.id?"border-primary bg-primary/10":"border-border"}`}>
              {item.hidden?<EyeOff className="h-4 w-4 shrink-0"/>:<Shapes className="h-4 w-4 shrink-0" aria-hidden="true"/>}
              <span className="min-w-0 flex-1 truncate">{item.text||item.sourceText||layerKind(item)}</span><span className="text-[10px] text-muted-foreground">{layerKind(item)}</span>
            </button>)}
          </div>
          {selected&&!selected.groupId&&<button type="button" className={button+" w-full"} onClick={()=>setWorkspaceSection("edit")}>تحرير العنصر المحدد</button>}
        </section>
      )}

       {!section && <div className="flex gap-2">
        <button type="button" className={button + " flex-1"} onClick={undo}>تراجع</button>
        <button type="button" className={button + " flex-1"} onClick={redo}>إعادة</button>
      </div>}
      {error && <div role="alert" className="rounded-lg border border-destructive/50 p-3 text-xs text-destructive">{error}</div>}
      {!section && <p className="text-[11px] leading-5 text-muted-foreground">استخدم خطوطا مرخصة للاستخدام التجاري.</p>}
    </div>
  );
}
