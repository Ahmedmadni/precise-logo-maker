import { useState } from "react";
import type { LetteringItem } from "../../calligraphy/model";
import { letteringGroupBounds } from "../../calligraphy/morph";
import { listWordAlternates, type OpenTypeAlternate } from "../../calligraphy/shaping";
import { useStudio } from "../../store/studioStore";
import { LetteringGlyph } from "../canvas/LetteringGlyph";

export function AlternateBrowser({ glyph, siblings }: { glyph: LetteringItem; siblings: LetteringItem[] }) {
  const replaceGroup = useStudio((s) => s.replaceLetteringGroup);
  const customFontData = useStudio((s) => s.doc.customThuluthFont);
  const [choices, setChoices] = useState<OpenTypeAlternate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const key = [glyph.groupId, glyph.sourceText, glyph.font, glyph.size,
    siblings.map((s) => s.pathData?.slice(0, 20)).join(":")].join("|");

  const load = async () => {
    setError("");
    setBusy(true);
    try {
      const results = await listWordAlternates(glyph, siblings, customFontData);
      setChoices(results);
      setLoadedFor(key);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر قراءة بدائل الخط.");
    } finally {
      setBusy(false);
    }
  };
  if (!glyph.groupId || !glyph.sourceText || glyph.kind !== "outline") return null;
  const visible = loadedFor === key ? choices : null;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-3" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">بدائل الحروف من الخط الأصلي</h4>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            نعرض فقط التشكيلات الحقيقية الموجودة داخل الخط. استبدال البديل يعيد تشكيل الكلمة للحفاظ على اتصال الحروف.
          </p>
        </div>
      </div>
      <button type="button" onClick={() => void load()} disabled={busy}
        className="min-h-11 w-full rounded-lg border border-primary/50 bg-primary/10 px-3 text-xs font-semibold text-foreground disabled:opacity-50">
        {busy ? "جار فحص البدائل..." : "استعراض بدائل الكلمة المحددة"}
      </button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {visible && visible.length <= 1 && (
        <p className="rounded-md bg-background p-3 text-xs text-muted-foreground">
          لا يتضمن الخط المحدد بدائل مختلفة قابلة للتطبيق على هذه الكلمة. يمكنك استخدام الإطالة وتحرير المنحنيات يدويًا.
        </p>
      )}
      {visible && visible.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {visible.map((choice) => {
            const bounds = letteringGroupBounds(choice.glyphs);
            const pad = 18;
            const box = bounds
              ? `${bounds.x - pad} ${bounds.y - pad} ${Math.max(60, bounds.width + 2 * pad)} ${Math.max(60, bounds.height + 2 * pad)}`
              : "0 0 400 200";
            return (
              <button type="button" key={choice.tag}
                className="flex min-h-32 flex-col justify-between gap-2 rounded-lg border border-border bg-background p-2 text-xs hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => {
                  if (glyph.groupId) replaceGroup(glyph.groupId, choice.glyphs);
                  setChoices(null);
                }}
                title={choice.label}>
                <svg viewBox={box} className="h-20 w-full overflow-visible" aria-label={choice.label}>
                  {choice.glyphs.map((g) => <LetteringGlyph item={g} selected={false} key={g.id} />)}
                </svg>
                <span>{choice.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
