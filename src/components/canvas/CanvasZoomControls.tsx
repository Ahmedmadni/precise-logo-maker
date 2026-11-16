import { Maximize2, Minus, Plus } from "lucide-react";
import { fitBounds, zoomAt } from "../../core/coordinates/view";
import { artboardWorldBounds, useStudio } from "../../store/studioStore";

/** Compact mobile controls for precise stylus work without obscuring the glyph. */
export function CanvasZoomControls() {
  const doc = useStudio((s) => s.doc);
  const view = useStudio((s) => s.view);
  const viewport = useStudio((s) => s.viewport);
  const setView = useStudio((s) => s.setView);
  const changeZoom = (factor: number) => {
    setView(zoomAt(view,
      { x: viewport.width / 2, y: viewport.height / 2 },
      view.zoom * factor));
  };
  const fit = () => {
    setView(fitBounds(artboardWorldBounds(doc.artboard),
      viewport.width, viewport.height));
  };
  return (
    <div dir="ltr" aria-label="أدوات تكبير مساحة الرسم"
      className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm sm:hidden"
      onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => changeZoom(1 / 1.3)}
        aria-label="تصغير مساحة الرسم" title="تصغير"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
        <Minus className="h-5 w-5" />
      </button>
      <span className="min-w-12 text-center font-mono text-[11px] text-muted-foreground" aria-live="off">
        {Math.round(view.zoom * 100)}%
      </span>
      <button type="button" onClick={() => changeZoom(1.3)}
        aria-label="تكبير مساحة الرسم" title="تكبير"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
        <Plus className="h-5 w-5" />
      </button>
      <button type="button" onClick={fit} aria-label="إظهار اللوحة كاملة" title="ملاءمة اللوحة"
        className="flex h-11 w-11 items-center justify-center rounded-lg border-s border-border text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}
