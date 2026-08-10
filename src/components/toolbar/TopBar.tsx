import { Maximize2, Redo2, RotateCcw, Scan, Undo2 } from "lucide-react";
import { fitBounds } from "../../core/coordinates/view";
import { geometryBounds, unionBounds } from "../../core/geometry/math";
import { artboardWorldBounds, useStudio } from "../../store/studioStore";

const ZOOM_LEVELS = [1, 2, 4, 8];

export function TopBar() {
  const view = useStudio((s) => s.view);
  const setView = useStudio((s) => s.setView);
  const doc = useStudio((s) => s.doc);
  const viewport = useStudio((s) => s.viewport);
  const selection = useStudio((s) => s.selection);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);

  const fitArtboard = () =>
    setView(fitBounds(artboardWorldBounds(doc.artboard), viewport.width, viewport.height));

  const fitSelection = () => {
    const selected = doc.objects.filter((o) => selection.includes(o.id));
    if (selected.length === 0) return;
    const b = unionBounds(selected.map((o) => geometryBounds(o.geometry)));
    setView(fitBounds(b, viewport.width, viewport.height, 96));
  };

  const setZoom = (zoom: number) => {
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const world = {
      x: (center.x - view.pan.x) / view.zoom,
      y: (center.y - view.pan.y) / view.zoom,
    };
    setView({
      ...view,
      zoom,
      pan: { x: center.x - world.x * zoom, y: center.y - world.y * zoom },
    });
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2">
      <h1 className="text-sm font-semibold tracking-tight text-foreground">
        Logo Grid Studio
      </h1>
      <span className="text-[11px] text-muted-foreground">Phase 1 — Geometry Core</span>

      <div className="ml-4 flex items-center gap-1.5">
        <button type="button" className={btn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
        </button>
        <button
          type="button"
          className={btn}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-3.5 w-3.5" aria-hidden /> Redo
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" className={btn} onClick={fitArtboard}>
          <Maximize2 className="h-3.5 w-3.5" aria-hidden /> Fit artboard
        </button>
        <button
          type="button"
          className={btn}
          onClick={fitSelection}
          disabled={selection.length === 0}
        >
          <Scan className="h-3.5 w-3.5" aria-hidden /> Fit selection
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => setView({ ...view, rotation: 0, zoom: 1, pan: { x: 0, y: 0 } })}
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
        </button>
        {ZOOM_LEVELS.map((z) => (
          <button key={z} type="button" className={btn} onClick={() => setZoom(z)}>
            {z * 100}%
          </button>
        ))}
      </div>
    </header>
  );
}
