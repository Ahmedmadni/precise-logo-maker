import { formatUnit } from "../../core/coordinates/units";
import { useStudio } from "../../store/studioStore";
import { useT } from "../../i18n";

export function StatusBar() {
  const view = useStudio((s) => s.view);
  const cursor = useStudio((s) => s.cursor);
  const unit = useStudio((s) => s.doc.artboard.unit);
  const snap = useStudio((s) => s.snap);
  const grids = useStudio((s) => s.doc.grids);
  const tool = useStudio((s) => s.tool);
  const count = useStudio((s) => s.doc.objects.length);
  const t = useT();

  const showGrids = useStudio((s) => s.showGrids);
  const cells = useStudio((s) => s.doc.objects.filter((o) => o.cellKey).length);
  const visibleGrids = showGrids ? grids.filter((g) => g.visible).length : 0;
  const TOOL_LABEL: Record<string, string> = { cell: "Paint cells", polygon: "Cell shape" };
  const toolLabel = TOOL_LABEL[tool] ?? tool.charAt(0).toUpperCase() + tool.slice(1);

  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
      <span>
        {t("Zoom")} {(view.zoom * 100).toFixed(0)}%
      </span>
      <span dir="ltr">
        {cursor ? `X ${formatUnit(cursor.x, unit)}  Y ${formatUnit(cursor.y, unit)}` : "X —  Y —"}
      </span>
      <span>
        {t("Unit")} {unit}
      </span>
      <span>
        {t("Snap")} {snap.enabled ? t("on") : t("off")}
      </span>
      <span>
        {t("Grids")} {visibleGrids}/{grids.length}
      </span>
      <span>
        {t("Objects")} {count}
      </span>
      <span>
        {t("Cells")} {cells}
      </span>
      <span className="ms-auto">
        {t("Tool")}: {t(toolLabel)}
      </span>
    </footer>
  );
}
