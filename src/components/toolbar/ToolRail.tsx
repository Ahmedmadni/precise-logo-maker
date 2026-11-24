import { useState } from "react";
import {
  ChevronsLeft, ChevronsRight, CircleDashed, Hand, PaintBucket, Paintbrush, PenTool, Ruler,
  Minus, MousePointer2, Spline, Waypoints, Type, Sparkles,
} from "lucide-react";
import type { ToolId } from "../../store/studioStore";
import { useStudio } from "../../store/studioStore";
import { cn } from "../../lib/utils";

type RailItem = {
  id: ToolId | "text" | "ornaments";
  label: string;
  shortcut?: string;
  icon: typeof Hand;
  panel?: "text" | "ornaments";
};

// Photoshop-style tool grouping: Select -> Paint -> Vector & Type -> Shapes -> Navigate & Measure
const TOOL_GROUPS: RailItem[][] = [
  [
    { id: "select", label: "تحديد", shortcut: "V", icon: MousePointer2 },
  ],
  [
    { id: "brush", label: "الفرشاة الخطاطية", shortcut: "B", icon: Paintbrush },
    { id: "cell", label: "تلوين خلايا", shortcut: "G", icon: PaintBucket },
  ],
  [
    { id: "pen", label: "قلم المسار", shortcut: "P", icon: PenTool },
    { id: "text", label: "كتابة", shortcut: "T", icon: Type, panel: "text" },
    { id: "ornaments", label: "المكتبة", icon: Sparkles, panel: "ornaments" },
  ],
  [
    { id: "line", label: "خط", shortcut: "L", icon: Minus },
    { id: "circle", label: "دائرة", shortcut: "C", icon: CircleDashed },
    { id: "arc", label: "قوس", shortcut: "A", icon: Spline },
    { id: "polygon", label: "مضلع", shortcut: "N", icon: Waypoints },
  ],
  [
    { id: "pan", label: "تحريك", shortcut: "H", icon: Hand },
    { id: "measure", label: "قياس", shortcut: "M", icon: Ruler },
  ],
];

/** Compact icon-only vertical tool rail styled after Photoshop. */
export function ToolRail({
  onOpenLettering,
}: {
  onOpenLettering?: () => void;
  orientation?: "vertical" | "horizontal";
} = {}) {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const section = useStudio((s) => s.workspaceSection);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const [twoColumns, setTwoColumns] = useState(false);

  const handleSelect = (item: RailItem) => {
    if (item.panel) {
      setTool("select");
      setSection(item.panel);
      onOpenLettering?.();
      return;
    }
    setTool(item.id as ToolId);
  };

  return (
    <nav
      aria-label="أدوات الرسم والخط"
      dir="rtl"
      className={cn(
        "flex h-full shrink-0 flex-col items-center overflow-y-auto overscroll-contain border-s border-border bg-card py-1.5 select-none [scrollbar-width:none]",
        twoColumns ? "w-[4.75rem] px-1.5" : "w-11 px-1",
      )}
    >
      <button
        type="button"
        onClick={() => setTwoColumns((prev) => !prev)}
        title={twoColumns ? "عمود واحد" : "عمودان"}
        aria-label={twoColumns ? "تبديل إلى عمود واحد" : "تبديل إلى عمودين"}
        aria-pressed={twoColumns}
        className="mb-1.5 flex h-5 w-full items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {twoColumns ? (
          <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      <div className={cn("w-full", twoColumns ? "space-y-1.5" : "space-y-1")}>
        {TOOL_GROUPS.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className={cn(
              groupIndex > 0 && "border-t border-border/70 pt-1.5",
              twoColumns ? "grid grid-cols-2 gap-1" : "flex flex-col items-center gap-0.5",
            )}
          >
            {group.map((item) => {
              const Icon = item.icon;
              const active = item.panel ? section === item.panel && tool === "select" : tool === item.id;
              const tooltip = item.shortcut ? `${item.label} (${item.shortcut})` : item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  title={tooltip}
                  aria-label={item.label}
                  aria-pressed={active}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
