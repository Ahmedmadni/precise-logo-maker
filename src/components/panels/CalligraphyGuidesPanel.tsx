import { useStudio } from "../../store/studioStore";
import { defaultCalligraphyGuides, type CalligraphyGuideSettings } from "../../calligraphy/harakaAnchoring";

const settingsFields = [
  { id: "baselineY", label: "موضع سطر الأساس" },
  { id: "upperOffset", label: "الحد العلوي (من السطر)" },
  { id: "ascenderOffset", label: "ارتفاع الحروف" },
  { id: "lowerOffset", label: "الحد السفلي (من السطر)" },
  { id: "descenderOffset", label: "نزول الحروف" },
] as const;

export function CalligraphyGuidesPanel() {
  const doc = useStudio((s) => s.doc);
  const save = useStudio((s) => s.setCalligraphyGuides);
  const guides = doc.calligraphyGuides ?? defaultCalligraphyGuides(doc.artboard.height);
  const setValue = (key: keyof CalligraphyGuideSettings, value: number | boolean) =>
    save({ [key]: value });
  return (
    <div className="space-y-3" dir="rtl">
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 text-sm">
        إظهار سطور الخط المساعدة
        <input type="checkbox" checked={guides.visible}
          onChange={(e) => setValue("visible", e.target.checked)} className="h-5 w-5" />
      </label>
      <p className="text-xs leading-5 text-muted-foreground">
        سطور قياس بصرية تساعد على توزيع الحروف والارتفاعات، ولا تظهر في SVG أو PNG النهائي.
      </p>
      {guides.visible && <div className="space-y-2">
        {settingsFields.map(({ id, label }) => (
          <label key={id} className="flex min-h-11 items-center justify-between gap-2 text-xs">
            <span>{label}</span>
            <input type="number" value={guides[id]} step={5}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && Math.abs(value) <= 100000) setValue(id, value);
              }}
              className="min-h-11 w-28 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
          </label>
        ))}
      </div>}
      <button type="button" onClick={() => save(defaultCalligraphyGuides(doc.artboard.height))}
        className="min-h-11 w-full rounded-lg border border-border bg-secondary px-3 text-xs text-foreground">
        إعادة ضبط السطور إلى الإعدادات الافتراضية
      </button>
    </div>
  );
}
