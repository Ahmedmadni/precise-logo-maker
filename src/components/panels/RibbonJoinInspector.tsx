import { Copy, Link2, Trash2 } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";
import { buildRibbonPath, DEFAULT_RIBBON, type RibbonLink } from "../../calligraphy/ribbonJoin";
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
  if (!item.ribbon || item.kind !== "bridge") return null;
  const ribbon = preview?.id === item.id && preview.patch.ribbon
    ? preview.patch.ribbon : item.ribbon;
  const shown = { ...item, ribbon };
  const source = (doc.lettering ?? []).find((x) => x.id === ribbon.sourceGlyphId);
  const target = (doc.lettering ?? []).find((x) => x.id === ribbon.targetGlyphId);
  const path = buildRibbonPath(shown, doc.lettering ?? []);
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
      <p className="text-[11px] leading-5 text-muted-foreground">
        الانحناء وحواف الشريط الآن أكثر نعومة، لكن الوصلة ما زالت مسارًا مستقلًا،
        ولا تحقق اندماج مسارات الحروف الأصلية أو محاكاة سن القلم تلقائيًا. افحصها عند التكبير.
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
