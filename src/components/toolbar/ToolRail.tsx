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

/** Drawing tools can dock vertically on tablets or horizontally above the canvas. */
export function ToolRail({
  onOpenLettering,
  orientation = "vertical",
}: {
  onOpenLettering?: () => void;
  orientation?: "vertical" | "horizontal";
} = {}) {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const section = useStudio((s) => s.workspaceSection);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const horizontal = orientation === "horizontal";

  const open = (to: "text" | "ornaments") => {
    setTool("select");
    setSection(to);
    onOpenLettering?.();
  };
  return (
    <nav
      aria-label="أدوات الرسم والخط"
      dir="rtl"
      className={cn(
        "shrink-0 border-border bg-card [scrollbar-width:thin]",
        horizontal
          ? "flex h-[4.5rem] w-full flex-row items-stretch gap-1 overflow-x-auto overflow-y-hidden border-b px-2 py-1"
          : "flex h-full w-[5.25rem] flex-col gap-2 overflow-y-auto overscroll-contain border-e px-1 py-2",
      )}
    >
      <div className={cn(
        "border-border",
        horizontal
          ? "flex shrink-0 items-center gap-1 border-e pe-2"
          : "space-y-1 border-b pb-2",
      )}>
        <p className={cn("text-[10px] font-semibold text-muted-foreground", horizontal ? "sr-only" : "text-center")}>الخط</p>
        {([
          { id: "text", label: "كتابة", icon: Type },
          { id: "ornaments", label: "المكتبة", icon: Sparkles },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => open(id)}
            title={label} aria-label={label} aria-pressed={section === id}
            className={cn("flex flex-col items-center justify-center gap-1 rounded-xl border border-transparent text-[10px] transition-colors",
              horizontal ? "min-h-[56px] w-[4.25rem] shrink-0" : "mx-auto min-h-[52px] w-[4.5rem]",
              section === id ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>
            <Icon className="h-5 w-5" aria-hidden /><span>{label}</span>
          </button>
        ))}
      </div>
      {groups.map((group) => (
        <div
          className={cn(
            "border-border/65",
            horizontal
              ? "flex shrink-0 items-center gap-1 border-e px-1 last:border-e-0"
              : "space-y-1 border-b pb-2 last:border-b-0",
          )}
          key={group.label}
        >
          <p className={cn("text-[10px] font-semibold text-muted-foreground", horizontal ? "sr-only" : "text-center")}>{group.label}</p>
          {group.tools.map(({ id, label, key, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTool(id)}
              title={label + " (" + key + ")"} aria-label={label} aria-pressed={tool === id}
              className={cn("flex flex-col items-center justify-center gap-1 rounded-xl border border-transparent text-[10px] transition-colors",
                horizontal ? "min-h-[56px] w-[4rem] shrink-0" : "mx-auto min-h-[52px] w-[3.8rem]",
                tool === id ? "border-primary/30 bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              <Icon className="h-5 w-5" aria-hidden/><span>{label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
