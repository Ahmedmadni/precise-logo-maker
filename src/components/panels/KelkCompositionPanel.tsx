import { useState } from "react";
import { Minimize2, Maximize2, Spline, Sparkles } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";
import {
  KELK_SLANT_PRESETS,
  adjustGroupOverlap,
  applyGroupSlant,
  composeWordLayout,
  createKashidaItem,
  type KashidaStyle,
  type KelkLayoutStyle,
} from "../../calligraphy/kelkComposition";
import { useStudio } from "../../store/studioStore";

const btn = "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground hover:bg-accent active:scale-[.98] disabled:opacity-40";

const LAYOUT_OPTIONS: { id: KelkLayoutStyle; label: string }[] = [
  { id: "cascade", label: "تدرّج ثلثي" },
  { id: "interlock", label: "تراكب متداخل" },
  { id: "arch", label: "قوس خطّي" },
  { id: "reset", label: "استعادة السطر" },
];

const KASHIDA_STYLES: { id: KashidaStyle; label: string }[] = [
  { id: "flat", label: "مسطّحة" },
  { id: "arch", label: "مقوّسة" },
  { id: "wave", label: "متموّجة" },
];

export function KelkCompositionPanel({ selected, siblings }: {
  selected: LetteringItem;
  siblings: LetteringItem[];
}) {
  const updateMany = useStudio((s) => s.updateLetteringMany);
  const addLettering = useStudio((s) => s.addLettering);
  const commitPreview = useStudio((s) => s.commitLetteringPreview);
  const moveScope = useStudio((s) => s.letteringMoveScope);
  const [kashidaStyle, setKashidaStyle] = useState<KashidaStyle>("arch");
  const [kashidaLength, setKashidaLength] = useState(650);
  const [kashidaArch, setKashidaArch] = useState(110);
  const [kashidaThickness, setKashidaThickness] = useState(72);

  const targets = moveScope === "word" && siblings.length > 1 ? siblings : [selected];
  const hasWordGroup = siblings.length > 1;

  const onSlant = (preset: { skewX: number; rotation: number; label: string }) => {
    commitPreview();
    const patches = applyGroupSlant(targets, preset);
    if (patches.length) updateMany(patches, `ميل ${preset.label}`);
  };

  const onLayout = (style: KelkLayoutStyle, label: string) => {
    commitPreview();
    const patches = composeWordLayout(siblings.length > 1 ? siblings : [selected], style);
    if (patches.length) updateMany(patches, label);
  };

  const onOverlap = (deltaPx: number) => {
    commitPreview();
    const patches = adjustGroupOverlap(siblings, deltaPx);
    if (patches.length) updateMany(patches, deltaPx < 0 ? "تقريب الحروف" : "تبعيد الحروف");
  };

  const onInsertKashida = () => {
    commitPreview();
    const item = createKashidaItem(selected, {
      length: kashidaLength,
      arch: kashidaStyle === "flat" ? 0 : kashidaArch,
      thickness: kashidaThickness,
      style: kashidaStyle,
    });
    if (item) addLettering(item);
  };

  return (
    <details open className="space-y-2.5 rounded-lg border border-border bg-card/70 p-2.5">
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        تركيب كيلك: الميل والتراكب والكشيدة
      </summary>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          قوالب ميل الخط ({moveScope === "word" && hasWordGroup ? "الكلمة كاملة" : "الحرف المحدد"})
        </span>
        <div className="grid grid-cols-4 gap-1">
          {KELK_SLANT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={btn}
              onClick={() => onSlant(preset)}
              title={`ميل ${preset.skewX}° ودوران ${preset.rotation}°`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border pt-2">
        <span className="text-[11px] font-medium text-muted-foreground">تراكب وتداخل الكلمة</span>
        <div className="grid grid-cols-2 gap-1">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={btn}
              disabled={!hasWordGroup && opt.id !== "reset"}
              onClick={() => onLayout(opt.id, opt.label)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" className={btn} disabled={!hasWordGroup} onClick={() => onOverlap(-6)}>
            <Minimize2 className="h-3.5 w-3.5" /> تقريب التداخل
          </button>
          <button type="button" className={btn} disabled={!hasWordGroup} onClick={() => onOverlap(6)}>
            <Maximize2 className="h-3.5 w-3.5" /> تبعيد الحروف
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Spline className="h-3.5 w-3.5" /> كشيدة خطّية قابلة للتعديل
        </span>
        <div className="grid grid-cols-3 gap-1">
          {KASHIDA_STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              aria-pressed={kashidaStyle === st.id}
              className={`${btn} ${kashidaStyle === st.id ? "border-foreground bg-foreground text-background hover:bg-foreground/90" : ""}`}
              onClick={() => setKashidaStyle(st.id)}
            >
              {st.label}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>طول الكشيدة</span>
            <span className="font-mono" dir="ltr">{kashidaLength}</span>
          </span>
          <input type="range" min={200} max={1600} step={25} value={kashidaLength} onChange={(e) => setKashidaLength(Number(e.target.value))} className="w-full" />
        </label>
        {kashidaStyle !== "flat" && (
          <label className="block space-y-1">
            <span className="flex justify-between text-[11px] text-muted-foreground">
              <span>تقوّس الكشيدة</span>
              <span className="font-mono" dir="ltr">{kashidaArch}</span>
            </span>
            <input type="range" min={-240} max={240} step={10} value={kashidaArch} onChange={(e) => setKashidaArch(Number(e.target.value))} className="w-full" />
          </label>
        )}
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>سماكة الكشيدة</span>
            <span className="font-mono" dir="ltr">{kashidaThickness}</span>
          </span>
          <input type="range" min={30} max={160} step={4} value={kashidaThickness} onChange={(e) => setKashidaThickness(Number(e.target.value))} className="w-full" />
        </label>
        <button type="button" className={`${btn} w-full font-semibold`} onClick={onInsertKashida}>
          إدراج كشيدة
        </button>
      </div>
    </details>
  );
}