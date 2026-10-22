import {
  CircleDashed,
  Hand,
  PaintBucket,
  PenTool,
  Ruler,
  Minus,
  MousePointer2,
  Spline,
  Waypoints,
} from "lucide-react";
import type { ToolId } from "../../store/studioStore";
import { useStudio } from "../../store/studioStore";
import { cn } from "../../lib/utils";
import { useT } from "../../i18n";

const TOOLS: { id: ToolId; label: string; key: string; icon: typeof Hand }[] = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2 },
  { id: "line", label: "Line", key: "L", icon: Minus },
  { id: "circle", label: "Circle", key: "C", icon: CircleDashed },
  { id: "arc", label: "Arc", key: "A", icon: Spline },
  { id: "pen", label: "Pen", key: "P", icon: PenTool },
  { id: "cell", label: "Paint cells", key: "B", icon: PaintBucket },
  { id: "polygon", label: "Cell shape", key: "N", icon: Waypoints },
  { id: "measure", label: "Measure", key: "M", icon: Ruler },
  { id: "pan", label: "Pan", key: "H", icon: Hand },
];

export function ToolRail() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const t = useT();

  return (
    <nav
      aria-label={t("Drawing tools")}
      className="order-2 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] w-full shrink-0 flex-row items-center gap-1 overflow-x-auto overscroll-x-contain border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] [scrollbar-width:none] lg:order-none lg:h-full lg:w-14 lg:flex-col lg:overflow-y-auto lg:border-t-0 lg:border-e lg:px-0 lg:py-3"
    >
      {TOOLS.map(({ id, label, key, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTool(id)}
          title={`${t(label)} (${key})`}
          aria-label={`${t(label)} ${t("tool")}`}
          aria-pressed={tool === id}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            tool === id && "border-border bg-accent text-accent-foreground",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </button>
      ))}
    </nav>
  );
}
