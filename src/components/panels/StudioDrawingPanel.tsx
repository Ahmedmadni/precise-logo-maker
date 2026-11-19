import { Circle, Compass, Grid3X3, Hand, Minus, MousePointer2, Paintbrush, PenLine, Ruler, Shapes, Spline } from "lucide-react";
import type { ToolId } from "../../store/studioStore";
import { useStudio } from "../../store/studioStore";
import { BrushPresetPreview } from "./BrushPresetPreview";

const tools: { id: ToolId; label: string; description: string; icon: typeof PenLine }[] = [
  { id: "select", label: "تحديد وتحريك", description: "حدد الأشكال أو الحروف واسحبها", icon: MousePointer2 },
  { id: "pan", label: "تحريك اللوحة", description: "حرّك مساحة الرسم", icon: Hand },
  { id: "pen", label: "قلم المسارات", description: "ارسم خطًا يمكن تنعيمه وتحويله إلى فيكتور", icon: PenLine },
  { id: "brush", label: "الفرش الخطاطية", description: "فرش فيكتور بضغط القلم واتجاه سن القصبة", icon: Paintbrush },
  { id: "line", label: "خط مستقيم", description: "خطوط هندسية دقيقة", icon: Minus },
  { id: "circle", label: "دائرة", description: "أشكال دائرية", icon: Circle },
  { id: "arc", label: "قوس", description: "منحنيات وأقواس", icon: Spline },
  { id: "polygon", label: "شكل هندسي", description: "إنشاء أشكال مغلقة", icon: Shapes },
  { id: "cell", label: "تلوين الخلايا", description: "الرسم على الشبكات", icon: Grid3X3 },
  { id: "measure", label: "قياس", description: "الأطوال والزوايا", icon: Ruler },
];

export function StudioDrawingPanel({ onChoose }: { onChoose?: (() => void) | undefined }) {
  const selected = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const brush = useStudio((s) => s.brush);
  const setBrush = useStudio((s) => s.setBrush);
  const showGrids = useStudio((s) => s.showGrids);
  const setShowGrids = useStudio((s) => s.setShowGrids);
  const guideDraw = useStudio((s) => s.guideDraw);
  const setGuideDraw = useStudio((s) => s.setGuideDraw);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <div>
        <h3 className="text-sm font-semibold">أدوات الرسم الفيكتور</h3>
        <p className="mt-1 text-xs text-muted-foreground">اختر أداة ثم ارسم مباشرة على المساحة. للتعديل في الأشكال اختر «تحديد وتحريك».</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">الأدوات الأساسية</p>
        <div className="grid grid-cols-2 gap-2">
          {tools.slice(0, 7).map(({ id, label, description, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={selected === id}
              className={`min-h-[84px] rounded-xl border p-3 text-right transition-colors ${selected === id ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}
              onClick={() => { setTool(id); onChoose?.(); }}>
              <Icon className={`mb-1 h-5 w-5 ${selected === id ? "text-primary" : "text-muted-foreground"}`} />
              <span className="block text-xs font-semibold">{label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      </div>
      <details className="rounded-xl border border-border bg-background p-3">
        <summary className="cursor-pointer text-xs font-semibold">
          أدوات رسم إضافية — مضلعات، خلايا وقياس
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {tools.slice(7).map(({ id, label, description, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={selected === id}
              className={`min-h-[84px] rounded-xl border p-3 text-right ${selected === id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              onClick={() => { setTool(id); onChoose?.(); }}>
              <Icon className="mb-1 h-5 w-5 text-primary" />
              <span className="block text-xs font-semibold">{label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      </details>
      {selected === "brush" && (
        <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Paintbrush className="h-4 w-4" /> إعدادات الفرش الفيكتور
          </h4>
          <p className="text-xs leading-5 text-muted-foreground">
            ارسم بالإصبع أو القلم. يتم حفظ كل ضربة كشكل فيكتور مغلق يمكن تغيير حجمه ولونه وتصديره.
          </p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="شكل سن القلم">
            {([
              ["round", "دائرية"], ["qalam", "سن قصبة"], ["taper", "مدببة"],
            ] as const).map(([preset, label]) => (
              <button key={preset} type="button" aria-pressed={brush.preset === preset}
                onClick={() => setBrush({ preset })} title={"معاينة: " + label}
                className={"flex min-h-[92px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary " +
                  (brush.preset === preset
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background hover:border-primary/40")}>
                <BrushPresetPreview preset={preset} settings={brush} />
                <span className="text-center leading-4">{label}</span>
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-xs">
            <span className="flex justify-between"><span>عرض الفرشاة</span><span dir="ltr">{brush.size} px</span></span>
            <input className="w-full accent-[var(--color-primary)]" type="range" min={1} max={100}
              value={brush.size} onChange={(e) => setBrush({ size: Number(e.target.value) })} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-xs">
            لون الحبر
            <input className="h-10 w-20 rounded-lg border border-border bg-background p-1"
              type="color" value={brush.color} onChange={(e) => setBrush({ color: e.target.value })} />
          </label>
          {brush.preset === "qalam" && <div className="space-y-2">
            <label className="block space-y-1 text-xs">
              <span className="flex justify-between">
                <span>زاوية حافة سن القصبة</span><span dir="ltr">{brush.angle}°</span>
              </span>
              <input className="min-h-11 w-full accent-[var(--color-primary)]" type="range" min={-90} max={90}
                value={brush.angle} onChange={(e) => setBrush({ angle: Number(e.target.value) })} />
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <svg viewBox="0 0 70 48" className="h-12 w-20 shrink-0" role="img"
                aria-label={"شكل حافة سن القصبة بزاوية " + brush.angle + " درجة"}>
                <g transform={"translate(35 24) rotate(" + brush.angle + ")"}>
                  <rect x="-26" y="-4" width="52" height="8" rx="2"
                    fill="currentColor" className="text-primary" />
                </g>
              </svg>
              <p className="text-[11px] leading-5 text-muted-foreground">
                عرض الضربة أكبر عند الحركة عموديًا على حافة السن،
                وأنحف عند الحركة في اتجاه الحافة.
              </p>
            </div>
          </div>}
          <label className="block space-y-1 text-xs">
            <span className="flex justify-between"><span>تنعيم حركة اليد</span><span dir="ltr">{Math.round(brush.smoothing * 100)}%</span></span>
            <input className="w-full accent-[var(--color-primary)]" type="range" min={0} max={80}
              value={Math.round(brush.smoothing * 100)}
              onChange={(e) => setBrush({ smoothing: Number(e.target.value) / 100 })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-xs">
            حساسية ضغط القلم الإلكتروني
            <input type="checkbox" checked={brush.pressure}
              onChange={(e) => setBrush({ pressure: e.target.checked })} className="h-5 w-5" />
          </label>
          <p className="text-[11px] leading-5 text-muted-foreground">
            الضغط الفعلي يحتاج قلمًا وجهازًا يدعمان Pointer Events. الرسم بالإصبع يستخدم ضغطًا افتراضيًا ثابتًا.
            نقرة القصبة المفردة تترك بصمة سن مائلة بدل دائرة. الأطراف المدببة تعتمد على المسافة لا سرعة العينات. هذه فرش فيكتور وليست ضربات ثلث أصيلة جاهزة.
          </p>
        </section>
      )}
      <details className="rounded-xl border border-border bg-background p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold"><Compass className="h-4 w-4 text-primary" /> إعدادات الرسم المساعدة</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setShowGrids(!showGrids)} aria-pressed={showGrids}
            className={`min-h-11 rounded-lg border px-2 text-xs ${showGrids ? "border-primary bg-primary/10" : "border-border"}`}>
            {showGrids ? "إخفاء الشبكة" : "إظهار الشبكة"}
          </button>
          <button type="button" onClick={() => setGuideDraw(!guideDraw)} aria-pressed={guideDraw}
            className={`min-h-11 rounded-lg border px-2 text-xs ${guideDraw ? "border-primary bg-primary/10" : "border-border"}`}>
            {guideDraw ? "إيقاف خطوط الدليل" : "خطوط الدليل"}
          </button>
          <button type="button" onClick={() => setSection("advanced")}
            className="col-span-2 min-h-11 rounded-lg border border-border px-2 text-xs">
            فتح الإعدادات الهندسية المتقدمة
          </button>
        </div>
      </details>
    </div>
  );
}
