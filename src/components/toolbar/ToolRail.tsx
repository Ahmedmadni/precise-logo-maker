import {
  CircleDashed, Hand, PaintBucket, Paintbrush, PenTool, Ruler,
  Minus, MousePointer2, Spline, Waypoints, Type, Sparkles,
} from "lucide-react";
import type { ToolId } from "../../store/studioStore";
import { useStudio } from "../../store/studioStore";
import { cn } from "../../lib/utils";

type StudioRailTool = {
  id: ToolId;
  label: string;
  key: string;
  icon: typeof Hand;
};
const groups: { label: string; tools: StudioRailTool[] }[] = [
  { label: "اختيار", tools: [
    { id: "select", label: "تحديد", key: "V", icon: MousePointer2 },
    { id: "pan", label: "تحريك", key: "H", icon: Hand },
  ] },
  { label: "رسم", tools: [
    { id: "pen", label: "قلم المسار", key: "P", icon: PenTool },
    { id: "brush", label: "الفرشاة الخطاطية", key: "B", icon: Paintbrush },
  ] },
  { label: "هندسة", tools: [
    { id: "line", label: "خط", key: "L", icon: Minus },
    { id: "circle", label: "دائرة", key: "C", icon: CircleDashed },
    { id: "arc", label: "قوس", key: "A", icon: Spline },
    { id: "polygon", label: "مضلع", key: "N", icon: Waypoints },
    { id: "cell", label: "تلوين خلايا", key: "G", icon: PaintBucket },
    { id: "measure", label: "قياس", key: "M", icon: Ruler },
  ] },
];

/**
 * Desktop/tablet rail: actions, not an overloaded property inspector.
 * All advanced options remain in the contextual right-hand panel.
 */
export function ToolRail({ onOpenLettering }: { onOpenLettering?: () => void } = {}) {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const section = useStudio((s) => s.workspaceSection);
  const setSection = useStudio((s) => s.setWorkspaceSection);

  const open = (to: "text" | "ornaments") => {
    setTool("select");
    setSection(to);
    onOpenLettering?.();
  };
  return (
    <nav aria-label="أدوات الرسم والخط" dir="rtl"
      className="flex h-full w-[5.25rem] shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain border-e border-border bg-card px-1 py-2 [scrollbar-width:thin]">
      <div className="space-y-1 border-b border-border pb-2">
        <p className="text-center text-[10px] font-semibold text-muted-foreground">الخط</p>
        {([
          { id: "text", label: "كتابة", icon: Type },
          { id: "ornaments", label: "المكتبة", icon: Sparkles },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => open(id)}
            title={label} aria-label={label} aria-pressed={section === id}
            className={cn("mx-auto flex min-h-[52px] w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-transparent text-[10px] transition-colors",
              section === id ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>
            <Icon className="h-5 w-5" aria-hidden /><span>{label}</span>
          </button>
        ))}
      </div>
      {groups.map((group) => (
        <div className="space-y-1 border-b border-border/65 pb-2 last:border-b-0" key={group.label}>
          <p className="text-center text-[10px] font-semibold text-muted-foreground">{group.label}</p>
          {group.tools.map(({ id, label, key, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTool(id)}
              title={label + " (" + key + ")"} aria-label={label} aria-pressed={tool === id}
              className={cn("mx-auto flex min-h-[52px] w-[3.8rem] flex-col items-center justify-center gap-1 rounded-xl border border-transparent text-[10px] transition-colors",
                tool === id ? "border-primary/30 bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              <Icon className="h-5 w-5" aria-hidden/><span>{label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
