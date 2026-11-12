import { Circle, Compass, Grid3X3, Hand, Minus, MousePointer2, PenLine, Ruler, Shapes, Spline } from "lucide-react";
import type { ToolId } from "../../store/studioStore";
import { useStudio } from "../../store/studioStore";

const tools: { id: ToolId; label: string; description: string; icon: typeof PenLine }[] = [
  { id: "select", label: "تحديد وتحريك", description: "حدد الأشكال أو الحروف واسحبها", icon: MousePointer2 },
  { id: "pan", label: "تحريك اللوحة", description: "حرّك مساحة الرسم", icon: Hand },
  { id: "pen", label: "الرسم الحر", description: "ارسم الخطوط بلمسة واحدة", icon: PenLine },
  { id: "line", label: "خط مستقيم", description: "خطوط هندسية دقيقة", icon: Minus },
  { id: "circle", label: "دائرة", description: "أشكال دائرية", icon: Circle },
  { id: "arc", label: "قوس", description: "منحنيات وأقواس", icon: Spline },
  { id: "polygon", label: "شكل هندسي", description: "إنشاء أشكال مغلقة", icon: Shapes },
  { id: "cell", label: "تلوين الخلايا", description: "الرسم على الشبكات", icon: Grid3X3 },
  { id: "measure", label: "قياس", description: "الأطوال والزوايا", icon: Ruler },
];

export function StudioDrawingPanel({ onChoose }: { onChoose?: () => void }) {
  const selected = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
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
      <div className="grid grid-cols-2 gap-2">
        {tools.map(({ id, label, description, icon: Icon }) => (
          <button key={id} type="button"
            className={`min-h-[76px] rounded-xl border p-3 text-right transition-colors ${selected === id ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}
            onClick={() => { setTool(id); onChoose?.(); }}
            aria-pressed={selected === id}>
            <Icon className={`mb-1 h-5 w-5 ${selected === id ? "text-primary" : "text-muted-foreground"}`} />
            <span className="block text-xs font-semibold">{label}</span>
            <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>
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
