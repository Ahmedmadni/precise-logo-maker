import { formatUnit } from "../../core/coordinates/units";
import { useStudio } from "../../store/studioStore";

export function StatusBar() {
  const view = useStudio((s) => s.view);
  const cursor = useStudio((s) => s.cursor);
  const unit = useStudio((s) => s.doc.artboard.unit);
  const snap = useStudio((s) => s.snap);
  const grids = useStudio((s) => s.doc.grids);
  const tool = useStudio((s) => s.tool);
  const count = useStudio((s) => s.doc.objects.length);

  const visibleGrids = grids.filter((g) => g.visible).length;

  return (
    <footer className="flex items-center gap-4 border-t border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
      <span>Zoom {(view.zoom * 100).toFixed(0)}%</span>
      <span>
        {cursor
          ? `X ${formatUnit(cursor.x, unit)}  Y ${formatUnit(cursor.y, unit)}`
          : "X —  Y —"}
      </span>
      <span>Unit {unit}</span>
      <span>Snap {snap.enabled ? "on" : "off"}</span>
      <span>
        Grids {visibleGrids}/{grids.length}
      </span>
      <span>Objects {count}</span>
      <span className="ml-auto capitalize">Tool: {tool}</span>
    </footer>
  );
}
