import { Hand, Layers, MousePointer2, Paintbrush, Sparkles, Type } from "lucide-react";
import { useStudio } from "../../store/studioStore";
import { cn } from "../../lib/utils";

/** Mobile tool dock is deliberately compact: the canvas keeps its full width. */
export function MobileToolDock({ openPanel }: { openPanel: () => void }) {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const setLetteringMode = useStudio((s) => s.setLetteringMode);
  const buttons = [
    { label: "تحديد", icon: MousePointer2, active: tool === "select", action: () => setTool("select") },
    { label: "رسم", icon: Paintbrush, active: tool === "pen", action: () => setTool("pen") },
    { label: "تحريك", icon: Hand, active: tool === "pan", action: () => setTool("pan") },
    { label: "الخطوط", icon: Type, active: false, action: () => { setLetteringMode("words"); setTool("lettering"); openPanel(); } },
    { label: "التشكيل", icon: Sparkles, active: false, action: () => { setLetteringMode("marks"); setTool("lettering"); openPanel(); } },
    { label: "الطبقات", icon: Layers, active: false, action: () => { setLetteringMode("layers"); setTool("select"); openPanel(); } },
  ] as const;
  return (
    <nav aria-label="أدوات الرسم والخط للهاتف" className="flex shrink-0 items-stretch justify-around gap-1 border-t border-border bg-card px-1 pt-1 pb-[max(env(safe-area-inset-bottom),4px)] sm:hidden">
      {buttons.map(({ label, icon: Icon, active, action }) => (
        <button key={label} type="button" aria-label={label} aria-pressed={active}
          onClick={action} className={cn(
            "flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] text-muted-foreground",
            active && "bg-accent text-primary",
          )}>
          <Icon className="h-5 w-5" aria-hidden /> <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
