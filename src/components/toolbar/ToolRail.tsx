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
import { useT } from "../../i18n";

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
  const t = useT();

  return (
    <nav
      aria-label={t("Drawing tools")}
      className="flex h-full w-12 flex-col items-center gap-1 border-e border-border bg-card py-2 sm:w-14 sm:py-3"
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
            "flex h-11 w-11 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
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
