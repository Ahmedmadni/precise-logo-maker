import { useEffect, useMemo, useRef, useState } from "react";
import { Buffer } from "buffer";
import { Layers, LoaderCircle, RotateCcw, Sparkles, Type, WandSparkles } from "lucide-react";
import {
  FONT_DESCRIPTIONS, HARAKAT, ORNAMENTS, createHaraka, createOrnament,
  fontFamily, type FontPreset, type LetteringItem,
} from "../../calligraphy/model";
import { composeArabicOutlines } from "../../calligraphy/shaping";
import { letteringGroupBounds } from "../../calligraphy/morph";
import { LetteringGlyph } from "../canvas/LetteringGlyph";
import { useStudio } from "../../store/studioStore";
import { placeAttachedHaraka } from "../../calligraphy/harakaAnchoring";
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
  const [markCategory, setMarkCategory] = useState<"harakat" | "decorations">("harakat");
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
  const grouped = new Map<string, LetteringItem[]>();
  for (const item of items) if (item.groupId) {
    const existing = grouped.get(item.groupId) ?? [];
    existing.push(item);
    grouped.set(item.groupId, existing);
  }

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

  const createMark = (mark: (typeof HARAKAT)[number]) => {
    const target = selected?.kind === "outline" ? selected :
      selected?.kind === "haraka" && selected.attachedToGlyphId
        ? items.find((item) => item.id === selected.attachedToGlyphId && item.kind === "outline")
        : undefined;
    const item = target
      ? placeAttachedHaraka(mark.id, target, items)
      : createHaraka(mark.id, doc.artboard.width / 2, doc.artboard.height / 2 - 65);
    insert(item);
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
            <textarea dir="rtl" className={field + " min-h-24 resize-y"} maxLength={120} value={phrase}
              onChange={(e) => setPhrase(e.target.value)} placeholder="اكتب الكلمة أو العبارة العربية هنا" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold">الخط المستخدم في تكوين الحروف</span>
            <select className={field} value={font} onChange={(e) => setFont(e.target.value as FontPreset)}>
              {FONTS.map((value) => <option key={value} value={value}>{value} — {FONT_DESCRIPTIONS[value]}</option>)}
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
        </section>
      )}

      {mode === "marks" && (
        <section className="space-y-4">
          <nav className="grid grid-cols-2 gap-2" aria-label="نوع العنصر المراد إضافته">
            {([
              ["harakat", "الحركات والتشكيل"],
              ["decorations", "الزخارف والامتدادات"],
            ] as const).map(([category, label]) => (
              <button type="button" key={category} onClick={() => setMarkCategory(category)}
                aria-pressed={markCategory === category}
                className={`min-h-12 rounded-xl border px-2 text-xs font-semibold ${markCategory === category ? "border-primary bg-primary/15 text-primary" : "border-border bg-background"}`}>
                {label}
              </button>
            ))}
          </nav>
          {markCategory === "harakat" && <div>
            <h3 className="mb-2 font-semibold">اختر حركة لإضافتها</h3>
            <p className="mb-2 text-xs leading-5 text-muted-foreground">
              حدد حرفا أولا لربط الحركة به تلقائيا. ويمكن تغيير موضعها أو فك الارتباط من «تعديل».
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {HARAKAT.map((mark) => (
                <button key={mark.id} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary"
                  type="button" title={mark.label} onClick={() => createMark(mark)}>
                  <svg viewBox="0 0 100 100" className="h-8 w-10" aria-hidden="true">
                    <path d={mark.path} fill="currentColor" fillRule="evenodd" />
                  </svg><span className="text-xs font-medium">{mark.label}</span>
                </button>
              ))}
            </div>
          </div>}
          {markCategory === "decorations" && <div>
            <h3 className="mb-2 font-semibold">الزخارف والامتدادات</h3>
            <div className="grid grid-cols-3 gap-2">
              {ORNAMENTS.map((shape) => (
                <button key={shape.id} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary"
                  type="button" onClick={() => createDecoration(shape)}>
                  <svg viewBox="0 0 100 100" className="h-11 w-12" aria-hidden="true">
                    <path d={shape.path} fill="currentColor" stroke="currentColor" strokeWidth="1" fillRule="evenodd" />
                  </svg><span className="text-[11px]">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>}
          <p className="text-xs leading-5 text-muted-foreground">بعد الإضافة حدّد الحركة أو الزخرفة ثم افتح «تعديل» للتحكم في مكانها وحجمها ولونها.</p>
        </section>
      )}

      {mode === "layers" && (
        <section className="space-y-3">
          <h3 className="font-semibold">الكلمات المركبة</h3>
          {grouped.size === 0 && <p className="text-xs text-muted-foreground">لم تنشئ مسارات حروف بعد. افتح تبويب الكلمات أولا.</p>}
          {[...grouped].map(([groupId, glyphs], i) => (
            <div key={groupId} className="rounded-lg border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <button className="text-right text-xs font-semibold" type="button" onClick={() => select(glyphs[0]!.id)}>
                  {glyphs[0]?.sourceText || `الكلمة ${i + 1}`}
                </button>
                <span className="text-[10px] text-muted-foreground">{glyphs.length} مسارات</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {glyphs.map((g, n) => (
                  <button className={`min-h-10 min-w-9 rounded-md border px-2 text-xs ${selectedId === g.id ? "border-primary bg-primary/10" : "border-border"}`}
                    key={g.id} onClick={() => select(g.id)} type="button">حرف {n + 1}</button>
                ))}
              </div>
              <button className={button + " mt-2 w-full"} type="button" onClick={() => {
                const first = glyphs[0]!;
                setPhrase(first.sourceText ?? "");
                setFont(first.font ?? "Amiri");
                setFontSize(first.size);
                setInk(first.color);
                setEditRun(groupId);
                setMode("words");
              }}><RotateCcw className="h-4 w-4" />إعادة تشكيل الكلمة بهذا الخط أو بخط آخر</button>
            </div>
          ))}
          <h3 className="font-semibold">العناصر المستقلة</h3>
          <select className={field} value={selectedId ?? ""} onChange={(e) => select(e.target.value || null)}>
            <option value="">اختر حرفا أو حركة أو زخرفة</option>
            {items.map((item, i) => <option value={item.id} key={item.id}>
              {i + 1}. {item.kind === "outline" ? "حرف فيكتور" : item.kind === "haraka" ? "حركة تشكيل" : item.kind === "ornament" ? "زخرفة" : "نص"}
            </option>)}
          </select>
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
