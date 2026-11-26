import { Maximize2, Minus, Plus } from "lucide-react";
import { fitBounds, zoomAt } from "../../core/coordinates/view";
import { artboardWorldBounds, useStudio } from "../../store/studioStore";

/** Compact mobile controls for precise stylus work without obscuring the glyph. */
export function CanvasZoomControls() {
  const artboard=useStudio(s=>s.doc.artboard);
  const tool=useStudio(s=>s.tool);
  const editNodes=useStudio(s=>s.editGlyphNodes);
  const selected=useStudio(s=>!!s.selectedLetteringId||s.selection.length>0);
  const editing=useStudio(s=>s.glyphLassoActive||!!s.nodeLassoTargetId||!!s.knifeTargetId||s.editGlyphContours);
  const view = useStudio((s) => s.view);
  const viewport = useStudio((s) => s.viewport);
  const setView = useStudio((s) => s.setView);
  const changeZoom = (factor: number) => {
    setView(zoomAt(view,
      { x: viewport.width / 2, y: viewport.height / 2 },
      view.zoom * factor));
  };
  const fit = () => {
    setView(fitBounds(artboardWorldBounds(artboard),
      viewport.width, viewport.height));
  };
  // Brush/node overlays own the lower canvas while editing; pinch still works.
  if(tool==="brush"||editNodes||editing)return null;
  return (
    <div data-canvas-ui dir="ltr" aria-label="أدوات تكبير مساحة الرسم"
      className={`absolute left-2 z-20 flex items-center gap-0.5 rounded-xl border border-border bg-card/95 p-0.5 shadow-lg backdrop-blur-sm sm:hidden ${selected&&tool==="select"?"bottom-[4.75rem]":"bottom-3"}`}
      onPointerDown={event=>event.stopPropagation()} onPointerMove={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}>
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
