import {
  CircleDashed,
  Hand,
  Ruler,
  Minus,
  MousePointer2,
  Spline,
} from "lucide-react";
import type { ToolId } from "../../store/studioStore";
import { useStudio } from "../../store/studioStore";
import { cn } from "../../lib/utils";

const TOOLS: { id: ToolId; label: string; key: string; icon: typeof Hand }[] = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2 },
  { id: "line", label: "Line", key: "L", icon: Minus },
  { id: "circle", label: "Circle", key: "C", icon: CircleDashed },
  { id: "arc", label: "Arc", key: "A", icon: Spline },
  { id: "measure", label: "Measure", key: "M", icon: Ruler },
  { id: "pan", label: "Pan", key: "H", icon: Hand },
];

export function ToolRail() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);

  return (
    <nav
      aria-label="Drawing tools"
      className="flex h-full w-14 flex-col items-center gap-1 border-r border-border bg-card py-3"
    >
      {TOOLS.map(({ id, label, key, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTool(id)}
          title={`${label} (${key})`}
          aria-label={`${label} tool`}
          aria-pressed={tool === id}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tool === id && "border-border bg-accent text-accent-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </nav>
  );
}
