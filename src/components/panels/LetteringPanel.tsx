import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Layers, LoaderCircle, RotateCcw, Sparkles, Trash2, Type, WandSparkles } from "lucide-react";
import {
  FONT_DESCRIPTIONS, HARAKAT, ORNAMENTS, createHaraka, createOrnament,
  fontFamily, type FontPreset, type LetteringItem,
} from "../../calligraphy/model";
import { composeArabicOutlines } from "../../calligraphy/shaping";
import { useStudio } from "../../store/studioStore";

const field = "w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground hover:bg-accent active:scale-[.98] disabled:opacity-40";
const FONTS: FontPreset[] = ["Amiri", "Aref Ruqaa", "Scheherazade New", "Gulzar", "Custom Thuluth"];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Mode = "words" | "marks" | "layers";

export function LetteringPanel() {
  const doc = useStudio((s) => s.doc);
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const select = useStudio((s) => s.selectLettering);
  const insert = useStudio((s) => s.addLettering);
  const insertBatch = useStudio((s) => s.addLetteringBatch);
  const replaceGroup = useStudio((s) => s.replaceLetteringGroup);
  const groupMove = useStudio((s) => s.moveLetteringGroup);
  const update = useStudio((s) => s.updateLettering);
  const remove = useStudio((s) => s.deleteLettering);
  const duplicate = useStudio((s) => s.duplicateLettering);
  const reorder = useStudio((s) => s.reorderLettering);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const mode = useStudio((s) => s.letteringMode) as Mode;
  const setMode = useStudio((s) => s.setLetteringMode);
  const [phrase, setPhrase] = useState("المدني");
  const [font, setFont] = useState<FontPreset>("Amiri");
  const [fontSize, setFontSize] = useState(180);
  const [ink, setInk] = useState("#d1a95e");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editRun, setEditRun] = useState<string | null>(null);
  const fontInput = useRef<HTMLInputElement>(null);

  const items = doc.lettering ?? [];
  const selected = items.find((entry) => entry.id === selectedId);
  const currentGroup = selected?.groupId;
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
      setMode("layers");
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
      useStudio.getState().setCustomThuluthFont(data);
      setFont("Custom Thuluth");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر استيراد الخط.");
    }
  };

  const createMark = (mark: (typeof HARAKAT)[number]) => {
    const x = selected?.x ?? doc.artboard.width / 2;
    const y = (selected?.y ?? doc.artboard.height / 2) - Math.min(65, fontSize / 2);
    insert(createHaraka(mark.id, x, y));
    setMode("layers");
  };
  const createDecoration = (ornament: (typeof ORNAMENTS)[number]) => {
    const x = selected?.x ?? doc.artboard.width / 2;
    const y = selected?.y ?? doc.artboard.height / 2;
    insert(createOrnament(ornament.id, x, y));
    setMode("layers");
  };
  const shift = (dx: number, dy: number) => {
    if (!selected) return;
    if (selected.groupId) groupMove(selected.groupId, dx, dy);
    else update(selected.id, { x: selected.x + dx, y: selected.y + dy });
  };

  return (
    <div className="space-y-4 pb-20 text-sm" dir="rtl">
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <p className="font-semibold text-foreground">استوديو الخط العربي الاحترافي</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          شكّل الكلمة أولا ثم عدّل كل شكل حرفي ومساره كعنصر فيكتور مستقل. لا يتطلب الحساب أو رصيد Lovable.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1" role="tablist" aria-label="أدوات الخط">
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
      </div>

      {mode === "words" && (
        <section className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold">النص المراد تشكيله</span>
            <textarea dir="rtl" className={field + " min-h-24 resize-y"} maxLength={120} value={phrase}
              onChange={(e) => setPhrase(e.target.value)} placeholder="اكتب الكلمة أو العبارة العربية هنا" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold">الخط الأصلي</span>
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
          <div className="flex min-h-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-background px-2 text-center"
            dir="rtl" style={{ fontFamily: fontFamily(font), fontSize: "36px", color: ink }}>
            {phrase || "معاينة الخط"}
          </div>
          <button type="button" disabled={busy || !phrase.trim()} onClick={() => void compose()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <WandSparkles className="h-5 w-5" />}
            {editRun ? "إعادة تشكيل الكلمة المحددة" : "إنشاء مسارات فيكتور مستقلة للحروف"}
          </button>
          {editRun && <button className={button + " w-full"} onClick={() => setEditRun(null)} type="button">إلغاء استبدال الكلمة</button>}
          <div className="rounded-lg border border-border p-3 text-xs leading-6 text-muted-foreground">
            خطوط Amiri وAref Ruqaa وScheherazade New وGulzar مدمجة ومفتوحة الترخيص. ليست خطوط ثلث حقيقية.
            لخط الثلث الأصلي استورد خطا مرخصا لديك؛ يحفظ المشروع أشكال الحروف كمسارات SVG بعد تشكيل الكلمة كاملة.
          </div>
          <input ref={fontInput} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => {
            void uploadFont(e.target.files?.[0]); e.target.value = "";
          }} />
          <button className={button + " w-full"} type="button" onClick={() => fontInput.current?.click()}>
            استيراد خط ثلث مرخص (TTF/OTF/WOFF)
          </button>
        </section>
      )}

      {mode === "marks" && (
        <section className="space-y-4">
          <div>
            <h3 className="mb-2 font-semibold">حركات التشكيل الفيكتور</h3>
            <div className="grid grid-cols-4 gap-2">
              {HARAKAT.map((mark) => (
                <button key={mark.id} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background"
                  type="button" title={mark.label} onClick={() => createMark(mark)}>
                  <svg viewBox="0 0 100 100" className="h-8 w-10" aria-hidden="true">
                    <path d={mark.path} fill="currentColor" fillRule="evenodd" />
                  </svg><span className="text-[10px]">{mark.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">الزخارف والنقوش</h3>
            <div className="grid grid-cols-3 gap-2">
              {ORNAMENTS.map((shape) => (
                <button key={shape.id} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background"
                  type="button" onClick={() => createDecoration(shape)}>
                  <svg viewBox="0 0 100 100" className="h-11 w-12" aria-hidden="true">
                    <path d={shape.path} fill="currentColor" stroke="currentColor" strokeWidth="1" fillRule="evenodd" />
                  </svg><span className="text-[11px]">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">كل علامة أو زخرفة عنصر مستقل يمكن تحريكه وتحجيمه وتدويره وتغيير لونه.</p>
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

      {selected && (
        <section className="space-y-3 rounded-xl border border-primary/40 bg-background p-3">
          <h3 className="font-semibold">خصائص العنصر المحدد</h3>
          <p className="text-[11px] text-muted-foreground">
            {selected.kind === "outline" ? "مسار SVG حقيقي لا يعتمد على الخط المثبت" : selected.kind === "text" ? "نص قابل للتحرير" : "شكل فيكتور"}
          </p>
          {selected.kind === "text" && (
            <textarea dir="rtl" className={field} value={selected.text ?? ""} onChange={(e) => update(selected.id, { text: e.target.value })} />
          )}
          <div className="grid grid-cols-2 gap-2">
            {([
              ["x", "الموضع X", -100000, 100000],
              ["y", "الموضع Y", -100000, 100000],
              ["size", "الحجم", 1, 1000],
              ["rotation", "الدوران °", -3600, 3600],
              ["scaleX", "اتساع الحرف", -10, 10],
              ["scaleY", "ارتفاع الحرف", -10, 10],
            ] as const).map(([key, label, min, max]) => (
              <label className="block space-y-1" key={key}><span className="text-xs text-muted-foreground">{label}</span>
                <input className={field} type="number" min={min} max={max} step={key === "scaleX" || key === "scaleY" ? 0.05 : 1}
                  value={selected[key] ?? (key === "scaleX" || key === "scaleY" ? 1 : 0)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) update(selected.id, { [key]: clamp(v, min, max) });
                  }} />
              </label>
            ))}
          </div>
          {selected.kind === "outline" && (
            <label className="block space-y-1"><span className="text-xs text-muted-foreground">زيادة السمك بصريًا (ليس تعديل مسار الحرف)</span>
              <input type="range" min={0} max={8} step={0.25} className="w-full"
                value={selected.weight ?? 0} onChange={(e) => update(selected.id, { weight: Number(e.target.value) })} />
            </label>
          )}
          <label className="flex items-center justify-between text-xs">لون العنصر
            <input type="color" className="h-10 w-20 rounded-md" value={selected.color} onChange={(e) => update(selected.id, { color: e.target.value })} />
          </label>
          <p className="text-xs text-muted-foreground">تحريك دقيق {selected.groupId ? "للكلمة بكاملها" : "للعنصر"}</p>
          <div className="grid grid-cols-4 gap-2">
            {([[ArrowRight, 8, 0, "يمين"], [ArrowLeft, -8, 0, "يسار"], [ArrowUp, 0, -8, "أعلى"], [ArrowDown, 0, 8, "أسفل"]] as const).map(([Icon, dx, dy, label]) => (
              <button className={button + " px-1"} type="button" title={label} key={label} onClick={() => shift(dx, dy)}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={button} onClick={() => duplicate(selected.id)}><Copy className="h-4 w-4" />نسخ</button>
            <button type="button" className={button} onClick={() => reorder(selected.id, -1)}>للخلف</button>
            <button type="button" className={button} onClick={() => reorder(selected.id, 1)}>للأمام</button>
          </div>
          <button type="button" className={button + " w-full border-destructive text-destructive"} onClick={() => remove(selected.id)}>
            <Trash2 className="h-4 w-4" />حذف العنصر
          </button>
        </section>
      )}
      <div className="flex gap-2">
        <button type="button" className={button + " flex-1"} onClick={undo}>تراجع</button>
        <button type="button" className={button + " flex-1"} onClick={redo}>إعادة</button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/50 p-3 text-xs text-destructive">{error}</div>}
      <p className="text-[11px] leading-5 text-muted-foreground">
        استيراد الخطوط ومكتبة الزخارف لا يمنحان حقوقًا في خطوط تجارية خاصة. استخدم الخطوط المسموح لك باستعمالها فقط.
      </p>
    </div>
  );
}
