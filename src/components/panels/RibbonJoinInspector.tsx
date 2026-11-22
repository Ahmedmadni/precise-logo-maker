import { useState } from "react";
import { Copy, Link2, Merge, Trash2 } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";
import { buildRibbonPath, DEFAULT_RIBBON, type RibbonLink } from "../../calligraphy/ribbonJoin";
import { isRibbonWidthRisk, ribbonHandleGeometry } from "../../calligraphy/ribbonHandles";
import { analyzeRibbonSafety } from "../../calligraphy/ribbonSafety";
import { useStudio } from "../../store/studioStore";

const line = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground";
const fields = [
  { key: "startWidth", label: "سُمك بداية الوصلة", min: 1, max: 100, step: 1, factor: 1 },
  { key: "endWidth", label: "سُمك نهايتها", min: 1, max: 100, step: 1, factor: 1 },
  { key: "tension", label: "امتداد مقابض المنحنى", min: 5, max: 70, step: 1, factor: 100 },
  { key: "curvature", label: "انحناء الوصلة", min: -50, max: 50, step: 1, factor: 100 },
] as const;

export function RibbonJoinInspector({ item }: { item: LetteringItem }) {
  const doc = useStudio((s) => s.doc);
  const update = useStudio((s) => s.updateLettering);
  const preview = useStudio((s) => s.letteringPreview);
  const setPreview = useStudio((s) => s.setLetteringPreview);
  const commitPreview = useStudio((s) => s.commitLetteringPreview);
  const remove = useStudio((s) => s.deleteLettering);
  const duplicate = useStudio((s) => s.duplicateLettering);
  const choose = useStudio((s) => s.selectLettering);
  const bake = useStudio((s) => s.bakeLetteringJoin);
  const [bakeError, setBakeError] = useState("");
  if (!item.ribbon || item.kind !== "bridge") return null;
  const ribbon = preview?.id === item.id && preview.patch.ribbon
    ? preview.patch.ribbon : item.ribbon;
  const shown = { ...item, ribbon };
  const source = (doc.lettering ?? []).find((x) => x.id === ribbon.sourceGlyphId);
  const target = (doc.lettering ?? []).find((x) => x.id === ribbon.targetGlyphId);
  const path = buildRibbonPath(shown, doc.lettering ?? []);
  const handleGeometry = ribbonHandleGeometry(shown, doc.lettering ?? []);
  const widthRisk = !!handleGeometry && isRibbonWidthRisk(ribbon, handleGeometry);
  const geometrySafety = analyzeRibbonSafety(shown, doc.lettering ?? []);
  // Preview live while dragging, then keep exactly one Undo entry per gesture.
  const change = (key: keyof RibbonLink, value: number) => {
    if (!Number.isFinite(value)) return;
    setPreview(item.id, { ribbon: { ...ribbon, [key]: value } });
  };
  const finish = () => commitPreview();
  const resetAngles = () => {
    finish();
    update(item.id, { ribbon: {
      ...ribbon,
      startAngle: DEFAULT_RIBBON.startAngle,
      endAngle: DEFAULT_RIBBON.endAngle,
      widthEase: DEFAULT_RIBBON.widthEase,
    } });
  };
  const resetNib = () => {
    finish();
    update(item.id, { ribbon: {
      ...ribbon, nibAngle: DEFAULT_RIBBON.nibAngle,
      nibContrast: DEFAULT_RIBBON.nibContrast,
      startOverlap: 0, endOverlap: 0,
    } });
  };
  return (
    <section className="space-y-4 rounded-xl border border-primary/40 bg-background p-3 text-sm" dir="rtl">
      <div>
        <h3 className="font-semibold">تحرير الوصلة المنحنية</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          هذه وصلة فيكتور بين حرفين؛ تتحرك معهما ويمكن ضبط شكلها دون تغيير الحروف الأصلية.
        </p>
      </div>
      {!path && <p role="alert" className="rounded-lg border border-destructive/50 p-3 text-xs text-destructive">
        لا يمكن رسم الوصلة حاليًا. تأكد من وجود الحرفين وأن المسافة بينهما مناسبة.
      </p>}
      {handleGeometry && (
        <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <p className="text-xs font-semibold">التحرير المباشر على اللوحة</p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            اختر الوصلة ثم اسحب المقبض الأخضر لتغيير اتجاه بدايتها، والذهبي لاتجاه نهايتها،
            والأزرق لضبط الانحناء في المنتصف. تظهر المقابض فوق الرسم فقط، وليست جزءًا من الشعار.
          </p>
        </div>
      )}
      {widthRisk && <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-xs leading-5 text-foreground">
        تنبيه هندسي: سُمك الوصلة كبير مقارنة بالمسافة بين النقطتين؛ قد تتداخل الحواف.
        قلل السُمك أو أبعد نقطتي الاتصال وراجع المعاينة قبل الدمج.
      </p>}
      {geometrySafety && (geometrySafety.edgeCrossings > 0 || geometrySafety.sharpTurns > 0) && (
        <p role="status" className="rounded-xl border border-amber-500/40 p-3 text-xs leading-5 text-foreground">
          {geometrySafety.edgeCrossings > 0
            ? "تنبيه: حواف الوصلة تتقاطع في " + geometrySafety.edgeCrossings + " موضعًا وفق الفحص المتقطع؛ قلل السُمك أو الانحناء وراجع الرسم قبل دمج الأشكال."
            : "تنبيه: يوجد انعطاف حاد في الوصلة؛ راجع الحواف عند التكبير قبل التصدير."}
        </p>
      )}
      {geometrySafety && (
        <details className="rounded-xl border border-border px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold">
            فحص هندسي للوصلة
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-background p-2">
              <span className="text-muted-foreground">طول الوصلة التقريبي</span>
              <p dir="ltr" className="mt-1 font-mono">{geometrySafety.distance.toFixed(1)} px</p>
            </div>
            <div className="rounded-lg bg-background p-2">
              <span className="text-muted-foreground">أكبر عرض فعلي</span>
              <p dir="ltr" className="mt-1 font-mono">{geometrySafety.maxWidth.toFixed(1)} px</p>
            </div>
            <div className="rounded-lg bg-background p-2">
              <span className="text-muted-foreground">نسبة العرض للطول</span>
              <p dir="ltr" className="mt-1 font-mono">{geometrySafety.widthRatio.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-background p-2">
              <span className="text-muted-foreground">تقاطعات الحواف المرصودة</span>
              <p dir="ltr" className="mt-1 font-mono">{geometrySafety.edgeCrossings}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            النتائج هندسية تقريبية بفحص عينات من الحواف، وليست تقييمًا آليًا لجودة الخط العربي.
          </p>
        </details>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button className="min-h-11 rounded-lg border border-border px-2 text-xs" type="button"
          disabled={!source} onClick={() => choose(ribbon.sourceGlyphId)}>تعديل الحرف الأول</button>
        <button className="min-h-11 rounded-lg border border-border px-2 text-xs" type="button"
          disabled={!target} onClick={() => choose(ribbon.targetGlyphId)}>تعديل الحرف الثاني</button>
      </div>
      {fields.map(({ key, label, min, max, step, factor }) => (
        <label key={key} className="block space-y-2">
          <span className="flex items-center justify-between gap-2 text-xs font-semibold">
            <span>{label}</span>
            <span dir="ltr" className="font-mono text-xs text-muted-foreground">
              {Math.round(ribbon[key] * factor)}{factor === 100 ? "%" : " px"}
            </span>
          </span>
          <input type="range" min={min} max={max} step={step}
            value={Math.round(ribbon[key] * factor)}
            onChange={(e) => change(key, Number(e.target.value) / factor)}
            onPointerUp={finish} onPointerCancel={finish} onKeyUp={finish} onBlur={finish}
            className="w-full accent-[var(--color-primary)]" />
        </label>
      ))}
      <label className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-border px-3 text-xs">
        لون الوصلة
        <input type="color" value={item.color} onChange={(e) => update(item.id, { color: e.target.value })}
          className="h-10 w-20 rounded-lg border border-border bg-background p-1" />
      </label>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">اتجاه الوصلة وتدرج السُمك</summary>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          غيّر اتجاه خروج الشريط ودخوله بالنسبة للمسافة بين الحرفين،
          واضبط سرعة انتقال السُمك دون زوايا حادة عند الأطراف.
        </p>
        <div className="mt-3 space-y-4">
          {([
            ["startAngle", "زاوية بداية الوصلة", -70, 70, "°"],
            ["endAngle", "زاوية نهايتها", -70, 70, "°"],
            ["widthEase", "توزيع تدرج السُمك", -100, 100, "%"],
          ] as const).map(([key, label, min, max, unit]) => {
            const current = key === "widthEase" ? (ribbon.widthEase ?? 0) * 100
              : (ribbon[key] ?? 0);
            return (
              <label key={key} className="block space-y-2">
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span>{label}</span>
                  <span dir="ltr" className="font-mono">{Math.round(current)}{unit}</span>
                </span>
                <input type="range" className="w-full accent-[var(--color-primary)]"
                  min={min} max={max} step={1} value={Math.round(current)}
                  onChange={(e) => change(key, key === "widthEase" ? Number(e.target.value) / 100 : Number(e.target.value))}
                  onPointerUp={finish} onPointerCancel={finish} onKeyUp={finish} onBlur={finish} />
              </label>
            );
          })}
          <button type="button" className="min-h-11 w-full rounded-lg border border-border text-xs"
            onClick={resetAngles}>إعادة اتجاهات الوصلة وتدرج السُمك للوضع المحايد</button>
        </div>
      </details>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">تأثير سن القلم وإخفاء فجوات الاتصال</summary>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          يحاكي تغير عرض الوصلة أثناء انحنائها حسب اتجاه سن القلم. ويمكن إدخال
          طرف الوصلة قليلًا خلف الحروف لتقليل الفواصل الظاهرة. لا يدمج مسارات
          الحروف هندسيًا ولا يحدد زاوية سن قلم الثلث تلقائيًا.
        </p>
        <div className="mt-3 space-y-4">
          {([
            ["nibAngle", "زاوية سن القلم", -180, 180, "°", 1],
            ["nibContrast", "تأثير تفاوت عرض الضربة", 0, 80, "%", 100],
            ["startOverlap", "تداخل البداية داخل الحرف", 0, 60, "px", 1],
            ["endOverlap", "تداخل النهاية داخل الحرف", 0, 60, "px", 1],
          ] as const).map(([key, label, min, max, unit, factor]) => {
            const current = (ribbon[key] ?? (key === "nibAngle" ? 35 : 0)) * factor;
            return <label key={key} className="block space-y-2">
              <span className="flex items-center justify-between gap-2 text-xs">
                <span>{label}</span>
                <span dir="ltr" className="font-mono">{Math.round(current)}{unit}</span>
              </span>
              <input className="w-full accent-[var(--color-primary)]" type="range"
                min={min} max={max} step={1} value={Math.round(current)}
                onChange={(e) => change(key, Number(e.target.value) / factor)}
                onPointerUp={finish} onPointerCancel={finish} onKeyUp={finish} onBlur={finish} />
            </label>;
          })}
          <button type="button" className="min-h-11 w-full rounded-lg border border-border text-xs"
            onClick={resetNib}>إعادة إعدادات القلم والتداخل</button>
        </div>
      </details>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">إعدادات متقدمة للوصلة</summary>
        <div className="mt-3 space-y-2">
          {(["startWidth", "endWidth"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              {key === "startWidth" ? "بداية" : "نهاية"}
              <input type="number" className={line} min={0.8} max={150} step={0.5}
                value={ribbon[key]} onChange={(e) => {
                  const next = Number(e.target.value);
                  if (next >= 0.8 && next <= 150) change(key, next);
                }} onBlur={finish} onKeyUp={finish} />
            </label>
          ))}
        </div>
      </details>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">إنشاء شكل فيكتور موحد (متقدم)</summary>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          يجمع الوصلة والحرفين بعملية Boolean Union فعلية في شكل واحد. تحتفظ
          النسخة الجديدة بالفراغات الداخلية، ويمكنك العودة للأحرف الأصلية.
          تُقرّب المنحنيات إلى مضلعات دقيقة، لذلك احتفظ بالأصول عند الحاجة لتحرير Bézier.
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          يجب توحيد ألوان العناصر الثلاثة، وإزالة السُمك الإضافي من الحروف،
          والتأكد أن الوصلة تتداخل فعلًا مع طرفي الحرفين.
        </p>
        <button type="button" disabled={!path} onClick={() => {
          finish();
          const result = bake(item.id);
          setBakeError(result.ok ? "" : (result.reason ?? "تعذر دمج المسارات"));
        }} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 text-xs font-semibold text-primary disabled:opacity-40">
          <Merge className="h-4 w-4" /> إنشاء النسخة الموحّدة مع الاحتفاظ بالأصول
        </button>
        {bakeError && <p role="alert" className="mt-2 text-xs text-destructive">{bakeError}</p>}
      </details>
      <p className="text-[11px] leading-5 text-muted-foreground">
        يتم تطبيق تأثير عرض سن القلم على جسم الوصلة مع الحفاظ على السُمك المحدد عند طرفيها.
        التداخل البصري يخفي بعض الفواصل فقط؛ لا ينتج وصلًا هندسيًا تلقائيًا بين المسارات.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border text-xs"
          onClick={() => { finish(); duplicate(item.id); }}><Copy className="h-4 w-4" />نسخ</button>
        <button type="button" className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-destructive/40 text-xs text-destructive"
          onClick={() => { finish(); remove(item.id); }}><Trash2 className="h-4 w-4" />حذف الوصلة</button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs text-muted-foreground">
        <Link2 className="h-4 w-4 shrink-0 text-primary" />
        ترتبط تلقائيًا بنقطتي اتصال الحرفين وتُحفظ في ملف المشروع.
      </div>
    </section>
  );
}
