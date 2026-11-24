import { useState } from "react";
import { ChevronDown, ChevronUp, Paintbrush, Settings2 } from "lucide-react";
import { useStudio } from "../store/studioStore";
import { BrushPresetPreview } from "../components/panels/BrushPresetPreview";

/**
 * Small controls on the actual canvas when the brush is selected.
 * All full-detail controls stay in Drawing; no additional main nav tab.
 */
export function MobileBrushControls({ panelOpen }: { panelOpen: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const tool = useStudio((s) => s.tool);
  const brush = useStudio((s) => s.brush);
  const setBrush = useStudio((s) => s.setBrush);
  if (tool !== "brush" || panelOpen) return null;

  const presets = [
    { id: "round", label: "دائري" },
    { id: "qalam", label: "قصبة" },
    { id: "taper", label: "مدبب" },
  ] as const;
  return (
    <aside aria-label="التحكم السريع بالفرشاة" dir="rtl"
      className="absolute inset-x-2 bottom-3 z-20 max-h-[min(70dvh,32rem)] overflow-y-auto rounded-2xl border border-primary/30 bg-card/95 p-2 text-foreground shadow-xl backdrop-blur-lg sm:inset-x-auto sm:end-3 sm:w-[min(23rem,calc(100%-1.5rem))] lg:hidden">
      <div className="flex min-h-11 items-center gap-1.5">
        <Paintbrush className="mx-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {presets.map((preset) => (
            <button key={preset.id} type="button" aria-pressed={brush.preset === preset.id}
              onClick={() => setBrush({ preset: preset.id })}
              className={"min-h-11 min-w-0 flex-1 rounded-lg border px-1 text-[11px] font-semibold " +
                (brush.preset === preset.id ? "border-primary bg-primary/15 text-primary" : "border-border")}>
              {preset.label}
            </button>
          ))}
        </div>
        <button type="button" aria-expanded={expanded} aria-label="إعدادات الفرشاة السريعة"
          onClick={() => setExpanded(!expanded)}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-border">
          <Settings2 className="h-4 w-4" />
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-1.5">
            <span className="text-[11px] font-semibold">معاينة الضربة الخطاطية</span>
            <BrushPresetPreview preset={brush.preset} settings={brush} className="h-9 max-w-28 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold">أطراف الضربة</p>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="نهاية الضربة">
              {([
                ["flat", "مسطحة"], ["soft", "ناعمة"], ["sharp", "مدببة"],
              ] as const).map(([style, label]) => (
                <button key={style} type="button" aria-pressed={(brush.endStyle ?? "flat") === style}
                  onClick={() => setBrush({ endStyle: style })}
                  className={"min-h-11 min-w-0 rounded-lg border px-1 text-[11px] font-semibold " +
                    ((brush.endStyle ?? "flat") === style ? "border-primary bg-primary/15 text-primary" : "border-border")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0">الحجم</span>
            <input type="range" min={1} max={100} value={brush.size}
              onChange={(e) => setBrush({ size: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-[var(--color-primary)]" />
            <output className="w-10 text-left tabular-nums" dir="ltr">{brush.size}px</output>
          </label>
          {brush.preset === "qalam" && <label className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0">زاوية الحافة</span>
            <input type="range" min={-90} max={90} value={brush.angle}
              onChange={(e) => setBrush({ angle: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-[var(--color-primary)]" />
            <output className="w-10 text-left tabular-nums" dir="ltr">{brush.angle}°</output>
          </label>}
          <label className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0">تنعيم الضربة</span>
            <input type="range" min={0} max={80} step={1}
              aria-label="مقدار تنعيم الفرشاة مع الحفاظ على الزوايا"
              value={Math.round(brush.smoothing * 100)}
              onChange={(event) => setBrush({ smoothing: Number(event.target.value) / 100 })}
              className="min-w-0 flex-1 accent-[var(--color-primary)]" />
            <output className="w-12 text-left tabular-nums" dir="ltr">
              {Math.round(brush.smoothing * 100)}%
            </output>
          </label>
          <p className="text-[11px] leading-5 text-muted-foreground">
            التنعيم يقلل اهتزاز اليد ويحافظ على الزوايا الحادة وتغيّرات ضغط القلم الواضحة.
          </p>
          <label className="flex min-h-11 items-center justify-between gap-2 text-xs">
            <span>حساسية ضغط القلم</span>
            <input type="checkbox" checked={brush.pressure}
              onChange={(e) => setBrush({ pressure: e.target.checked })}
              className="h-5 w-5" />
          </label>
        </div>
      )}
    </aside>
  );
}
