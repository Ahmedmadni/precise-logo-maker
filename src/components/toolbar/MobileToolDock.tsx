import { Layers3, MousePointer2, PenTool, SlidersHorizontal, Sparkles, Type } from "lucide-react";
import { useStudio } from "../../store/studioStore";
import { cn } from "../../lib/utils";

export function MobileToolDock({ openPanel, closePanel, panelOpen }: {
  openPanel: () => void;
  closePanel: () => void;
  panelOpen: boolean;
}) {
  const selectedTool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const section = useStudio((s) => s.workspaceSection);
  const setSection = useStudio((s) => s.setWorkspaceSection);

  const actions = [
    { id: "select", label: "تحديد", icon: MousePointer2, active: selectedTool === "select" && !panelOpen,
      onClick: () => { setTool("select"); closePanel(); } },
    { id: "text", label: "كتابة", icon: Type, active: section === "text" && panelOpen,
      onClick: () => { setSection("text"); setTool("select"); openPanel(); } },
    { id: "ornaments", label: "زخارف", icon: Sparkles, active: section === "ornaments" && panelOpen,
      onClick: () => { setSection("ornaments"); setTool("select"); openPanel(); } },
    { id: "edit", label: "تعديل", icon: SlidersHorizontal, active: section === "edit" && panelOpen,
      onClick: () => { setSection("edit"); setTool("select"); openPanel(); } },
    { id: "layers", label: "الطبقات", icon: Layers3, active: section === "layers" && panelOpen,
      onClick: () => { setSection("layers"); setTool("select"); openPanel(); } },
    { id: "draw", label: "رسم", icon: PenTool, active: section === "draw" && panelOpen,
      onClick: () => { setSection("draw"); openPanel(); } },
  ];
  return (
    <nav aria-label="الأدوات الرئيسية" className="flex shrink-0 items-stretch gap-0.5 border-t border-border bg-card px-1 pt-1 pb-[max(env(safe-area-inset-bottom),4px)] sm:hidden" dir="rtl">
      {actions.map(({ id, label, icon: Icon, active, onClick }) => (
        <button key={id} type="button" aria-label={label} aria-pressed={active} onClick={onClick}
          className={cn(
            "flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] text-muted-foreground transition-colors",
            active && "bg-primary/10 font-semibold text-primary",
          )}>
          <Icon className="h-[19px] w-[19px]" aria-hidden />
          <span className="whitespace-nowrap">{label}</span>
        </button>
      ))}
    </nav>
  );
}
