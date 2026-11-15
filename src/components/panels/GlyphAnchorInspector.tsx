import type { LetteringItem } from "../../calligraphy/model";
import { useStudio } from "../../store/studioStore";
import { defaultCalligraphyGuides } from "../../calligraphy/harakaAnchoring";
import { CalligraphyGuidesPanel } from "./CalligraphyGuidesPanel";

const field = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground";

export function GlyphAnchorInspector({ selected }: { selected: LetteringItem }) {
  const doc = useStudio((s) => s.doc);
  const update = useStudio((s) => s.updateLettering);
  const setOffset = useStudio((s) => s.setLetteringBaselineOffset);
  const guides = doc.calligraphyGuides ?? defaultCalligraphyGuides(doc.artboard.height);
  const glyphs = (doc.lettering ?? []).filter((item) => item.kind === "outline");
  if (selected.kind === "haraka") {
    const target = glyphs.find((item) => item.id === selected.attachedToGlyphId);
    return (
      <details className="rounded-xl border border-border p-3" open>
        <summary className="cursor-pointer text-xs font-semibold">ربط الحركة بالحرف</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            يمكنك ربط التشكيل بحرف معين ليلاحقه عند النقل وإعادة تشكيل الكلمة، أو تحرير موضع الحركة بحرية.
          </p>
          <label className="block space-y-1 text-xs">الحرف المرتبط
            <select className={field} value={selected.attachedToGlyphId ?? ""} onChange={(e) => {
              const id = e.target.value;
              update(selected.id, {
                attachedToGlyphId: id || undefined,
                anchorMode: id ? "auto" : "manual",
              });
            }}>
              <option value="">غير مرتبطة بحرف</option>
              {glyphs.map((glyph, i) => (
                <option value={glyph.id} key={glyph.id}>{glyph.sourceText ?? "كلمة"} – الجزء {glyph.glyphIndex !== undefined ? glyph.glyphIndex + 1 : i + 1}</option>
              ))}
            </select>
          </label>
          {target && <div className="grid grid-cols-2 gap-2">
            <button className={`min-h-11 rounded-lg border px-2 text-xs ${selected.anchorMode === "auto" ? "border-primary bg-primary/10" : "border-border"}`}
              type="button" onClick={() => update(selected.id, { anchorMode: "auto" })}>موضع تلقائي</button>
            <button className={`min-h-11 rounded-lg border px-2 text-xs ${selected.anchorMode === "manual" ? "border-primary bg-primary/10" : "border-border"}`}
              type="button" onClick={() => update(selected.id, { anchorMode: "manual" })}>موضع يدوي</button>
          </div>}
          <p className="text-[11px] leading-5 text-muted-foreground">
            عند سحب الحركة يدويًا تتحول إلى الوضع اليدوي تلقائيًا، وتظل مرتبطة بنقل الحرف.
          </p>
        </div>
      </details>
    );
  }
  if (selected.kind !== "outline") return null;
  const currentOffset = selected.baselineOffset ?? 0;
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-xs font-semibold">موضع الحرف بالنسبة إلى السطر</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">ارفع أو اخفض الحرف دون تغيير نقاطه الأصلية.</p>
        <label className="flex min-h-11 items-center justify-between gap-2 text-xs">
          رفع / خفض الحرف
          <input type="number" min={-10000} max={10000} step={5} className={field + " max-w-32"}
            value={currentOffset} onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value)) setOffset(selected.id, value);
            }} />
        </label>
        <button type="button" onClick={() => setOffset(selected.id,
          currentOffset + guides.baselineY - selected.y)}
          className="min-h-11 w-full rounded-lg border border-border bg-secondary px-3 text-xs">
          محاذاة الحرف إلى سطر الأساس
        </button>
        <CalligraphyGuidesPanel />
      </div>
    </details>
  );
}
