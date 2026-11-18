import { useState } from "react";
import type { LetteringItem } from "../../calligraphy/model";
import { letteringGroupBounds } from "../../calligraphy/morph";
import { listWordAlternates, type OpenTypeAlternate } from "../../calligraphy/shaping";
import { findLocalGlyphAlternates } from "../../calligraphy/localGlyphAlternates";
import { useStudio } from "../../store/studioStore";
import { LetteringGlyph } from "../canvas/LetteringGlyph";

type Filter = "all" | "single" | "combination";
const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "single", label: "بدائل الخط" },
  { id: "combination", label: "تركيبات البدائل" },
];
const previewBox = (glyphs: LetteringItem[]) => {
  const b = letteringGroupBounds(glyphs);
  const padding = 18;
  return b
    ? `${b.x - padding} ${b.y - padding} ${Math.max(60, b.width + 2 * padding)} ${Math.max(60, b.height + 2 * padding)}`
    : "0 0 400 200";
};

function GlyphPreview({ glyphs, label, highlightId }: {
  glyphs: LetteringItem[]; label: string; highlightId?: string | undefined;
}) {
  return (
    <svg viewBox={previewBox(glyphs)} role="img" aria-label={label}
      className="h-24 w-full overflow-visible">
      {glyphs.filter((g) => !g.hidden).map((g) =>
        <LetteringGlyph key={g.id} item={g} selected={g.id === highlightId} />)}
    </svg>
  );
}

/**
 * Browses genuine whole-word OpenType substitutions. There is no simulated
 * isolated Unicode-letter replacement: Arabic ligatures and joins are shaped
 * together. Review current artwork against a candidate before replacing it.
 */
export function AlternateBrowser({ glyph, siblings }: {
  glyph: LetteringItem;
  siblings: LetteringItem[];
}) {
  const replaceGroup = useStudio((s) => s.replaceLetteringGroup);
  const updateGlyph = useStudio((s) => s.updateLettering);
  const customFontData = useStudio((s) => s.doc.customThuluthFont);
  const [choices, setChoices] = useState<OpenTypeAlternate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editScope, setEditScope] = useState<"word" | "segment">("word");
  const [candidateTag, setCandidateTag] = useState<string | null>(null);
  const key = [glyph.groupId, glyph.sourceText, glyph.font, glyph.size,
    glyph.rotation, glyph.color, customFontData?.length ?? 0,
    siblings.map((s) => `${s.id}:${s.pathData?.length}:${s.x}:${s.y}`).join("|")].join("|");
  const current = siblings.filter((item) => item.kind === "outline");
  const visible = loadedFor === key ? choices : null;
  const currentUsesAlternate = current.some((item) => !!item.alternateFeature);
  // A word that already uses a stylistic alternate must be able to switch
  // back to the genuine default OpenType shape without relying on Undo.
  const available = (visible ?? []).filter((v) =>
    v.kind !== "default" || currentUsesAlternate);
  const listed = filter === "all" ? available : available.filter((v) => v.kind === filter);
  const candidate = editScope === "word" ? available.find((v) => v.tag === candidateTag) : undefined;
  const localChoices = findLocalGlyphAlternates(glyph.id, current, visible ?? []);
  const localCandidate = editScope === "segment" ?
    localChoices.find((v) => v.tag === candidateTag) : undefined;

  const load = async () => {
    setError("");
    setBusy(true);
    setCandidateTag(null);
    try {
      const results = await listWordAlternates(glyph, current, customFontData);
      setChoices(results);
      setLoadedFor(key);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر قراءة بدائل الخط.");
    } finally {
      setBusy(false);
    }
  };

  if (!glyph.groupId || !glyph.sourceText || glyph.kind !== "outline") return null;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-3" dir="rtl">
      <div>
        <h4 className="text-sm font-semibold">تكوينات الكلمة من الخط الأصلي</h4>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          يعتمد كل خيار على ميزة OpenType موجودة في الخط، وليس على أشكال مخترعة.
          بعض الخطوط لا توفر بدائل كثيرة، وبعض الميزات لا تغير هذه الكلمة.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-background p-2">
        <p className="mb-2 text-xs font-semibold">الكلمة الحالية — {glyph.sourceText}</p>
        <GlyphPreview glyphs={current} label="الشكل الحالي للكلمة قبل تطبيق أي بديل"
          highlightId={editScope === "segment" ? glyph.id : undefined} />
      </div>
      <button type="button" onClick={() => void load()} disabled={busy}
        className="min-h-12 w-full rounded-lg border border-primary/50 bg-primary/10 px-3 text-xs font-semibold text-foreground disabled:opacity-50">
        {busy ? "جار فحص ميزات وتراكيب الخط..." : "استعراض التكوينات المدعومة"}
      </button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {visible && <div className="grid grid-cols-2 gap-2" aria-label="نطاق تعديل بدائل الخط">
        <button type="button" aria-pressed={editScope === "word"}
          onClick={() => { setEditScope("word"); setCandidateTag(null); }}
          className={`min-h-12 rounded-lg border px-2 text-xs font-semibold
            ${editScope === "word" ? "border-primary bg-primary/15 text-primary" :
            "border-border bg-background"}`}>
          الكلمة كاملة
        </button>
        <button type="button" aria-pressed={editScope === "segment"}
          onClick={() => { setEditScope("segment"); setCandidateTag(null); }}
          className={`min-h-12 rounded-lg border px-2 text-xs font-semibold
            ${editScope === "segment" ? "border-primary bg-primary/15 text-primary" :
            "border-border bg-background"}`}>
          الجزء المحدد
        </button>
      </div>}
      {visible && editScope === "segment" && <div className="space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">
          الجزء المختار: <strong dir="ltr">#{glyph.glyphIndex !== undefined ? glyph.glyphIndex + 1 : "?"}</strong>.
          هذا رقم الشكل الناتج من تشكيل OpenType، وقد يمثل حرفًا أو حركة أو تركيبًا،
          وليس بالضرورة حرفًا واحدًا من النص.
          يعرض المحرر فقط البدائل التي لا تغير مواضع الأجزاء المجاورة أو أشكالها.
        </p>
        {localChoices.length === 0 ? <div className="rounded-lg border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
          لا يوجد بديل موضعي آمن لهذا الجزء في الخط المختار. قد تتطلب البدائل الأخرى
          إعادة تشكيل الكلمة كاملة للحفاظ على الوصلات؛ جرّب «الكلمة كاملة»
          أو استخدم تحرير المنحنيات يدويًا.
        </div> : <>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {localChoices.length} بديل موضعي مستخرج من OpenType
          </p>
          <div className="grid grid-cols-2 gap-2">
            {localChoices.map((choice) => (
              <button type="button" key={choice.tag}
                aria-pressed={candidateTag === choice.tag}
                onClick={() => setCandidateTag(choice.tag)}
                className={`flex min-h-40 flex-col justify-between gap-2 rounded-xl border bg-background p-2
                  text-xs focus-visible:outline-2 focus-visible:outline-primary
                  ${candidateTag === choice.tag ? "border-primary bg-primary/10" :
                  "border-border hover:border-primary/50"}`}>
                <GlyphPreview glyphs={choice.previewGlyphs}
                  label={`معاينة البديل الموضعي: ${choice.label}`}
                  highlightId={glyph.id} />
                <span className="font-semibold">{choice.label}</span>
                <span dir="ltr" className="text-[10px] text-muted-foreground">
                  {choice.featureTags.join(" + ") || "default"}
                </span>
              </button>
            ))}
          </div>
        </>}
      </div>}
      {visible && editScope === "word" && available.length === 0 && (
        <p className="rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
          لم نجد لهذه الكلمة بدائل تُغيّر شكلها فعليًا في الخط المحدد.
          يمكنك تحرير المنحنيات والإطالات يدويًا، أو استخدام خط مرخص يحتوي على بدائل OpenType.
        </p>
      )}
      {visible && editScope === "word" && available.length > 0 && <>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {available.length} تكوين مختلف فعليًا لهذه الكلمة
        </p>
        <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="أنواع بدائل الخط">
          {filters.map(({ id, label }) => (
            <button type="button" key={id} aria-pressed={filter === id}
              onClick={() => { setFilter(id); setCandidateTag(null); }}
              className={`min-h-11 shrink-0 rounded-lg border px-2 text-[11px] font-semibold
                ${filter === id ? "border-primary bg-primary/15 text-primary" :
                "border-border bg-background text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </nav>
        {listed.length === 0 && <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          لا توجد تراكيب متعددة مؤثرة على هذه الكلمة. جرّب قسم «بدائل الخط».
        </p>}
        <div className="grid grid-cols-2 gap-2">
          {listed.map((choice) => (
            <button type="button" key={choice.tag} aria-pressed={candidateTag === choice.tag}
              className={`flex min-h-40 flex-col justify-between gap-2 rounded-xl border bg-background p-2
                text-xs focus-visible:outline-2 focus-visible:outline-primary
                ${candidateTag === choice.tag ? "border-primary bg-primary/10" :
                "border-border hover:border-primary/50"}`}
              onClick={() => setCandidateTag(choice.tag)}>
              <GlyphPreview glyphs={choice.glyphs} label={choice.label} />
              <span className="block font-semibold">{choice.label}</span>
              <span dir="ltr" className="text-[10px] text-muted-foreground">
                {choice.featureTags.join(" + ")}
              </span>
            </button>
          ))}
        </div>
      </>}
      {localCandidate && <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
        <h5 className="text-xs font-semibold">مقارنة الجزء المحدد قبل الاعتماد</h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg bg-background p-2 text-center">
            <p className="mb-2 text-[11px]">الكلمة الحالية</p>
            <GlyphPreview glyphs={current} label="المسارات الأصلية قبل تعديل الجزء المحدد"
              highlightId={glyph.id} />
          </div>
          <div className="min-w-0 rounded-lg bg-background p-2 text-center">
            <p className="mb-2 text-[11px]">تغيير الجزء فقط</p>
            <GlyphPreview glyphs={localCandidate.previewGlyphs}
              label="المعاينة مع استبدال الجزء المحدد دون تبديل بقية الكلمة"
              highlightId={glyph.id} />
          </div>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          يُحفظ موقع الجزء المختار وهويته وحركاته المرتبطة كما هي، ولا تُستبدل
          مسارات الأجزاء المجاورة. قد يتطلب الاتصال النهائي ضبطًا يدويًا
          عند التكبير؛ تطبيق البديل لا يضمن اندماج المنحنيات تلقائيًا.
          يمكنك التراجع عن التغيير من سجل التعديلات.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setCandidateTag(null)}
            className="min-h-11 rounded-lg border border-border bg-background px-2 text-xs font-semibold">
            إلغاء
          </button>
          <button type="button" onClick={() => {
            updateGlyph(glyph.id, {
              pathData: localCandidate.pathData,
              fontGlyphId: localCandidate.fontGlyphId,
              alternateFeature: localCandidate.featureTags.join("+") || undefined,
            });
            setCandidateTag(null);
            setChoices(null);
          }} className="min-h-11 rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground">
            اعتماد بديل الجزء
          </button>
        </div>
      </div>}
      {candidate && <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
        <h5 className="text-xs font-semibold">مقارنة التكوين قبل اعتماده</h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg bg-background p-2 text-center">
            <p className="mb-2 text-[11px]">الحالي</p>
            <GlyphPreview glyphs={current} label="الكلمة قبل التغيير" />
          </div>
          <div className="min-w-0 rounded-lg bg-background p-2 text-center">
            <p className="mb-2 text-[11px]">المقترح</p>
            <GlyphPreview glyphs={candidate.glyphs} label="الكلمة بعد اختيار البديل" />
          </div>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          تطبيق البديل يعيد تشكيل الكلمة كاملة وقد يستبدل تعديلات Bézier السابقة.
          احتفظ بنسخة من التصميم أو استخدم «تراجع» إذا لم يناسبك التغيير.
          حركات التشكيل المرتبطة يعاد توزيعها وفق مواضع الحروف الجديدة.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setCandidateTag(null)}
            className="min-h-11 rounded-lg border border-border bg-background px-2 text-xs font-semibold">
            إلغاء المقارنة
          </button>
          <button type="button" className="min-h-11 rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground"
            onClick={() => {
              if (glyph.groupId) replaceGroup(glyph.groupId, candidate.glyphs);
              setCandidateTag(null);
              setChoices(null);
            }}>
            اعتماد التكوين
          </button>
        </div>
      </div>}
    </section>
  );
}
