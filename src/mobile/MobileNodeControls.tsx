import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Move } from "lucide-react";
import { moveOutlineNodeWithHandles, outlineNodes } from "../calligraphy/pathEditor";
import { moveLinkedCubicControl } from "../calligraphy/handleCoupling";
import { CubicHandleLinkControls } from "../components/panels/CubicHandleLinkControls";
import { GlyphNodeTopologyActions } from "../components/panels/GlyphNodeTopologyActions";
import { useStudio } from "../store/studioStore";

/**
 * Touch-first, compact point controls directly above the mobile tool dock.
 * The canvas/editor remain usable while the properties drawer is closed.
 * A tap/nudge is one undoable edit; pointer drags still use canvas previews.
 */
export function MobileNodeControls({ panelOpen }: { panelOpen: boolean }) {
  const [step, setStep] = useState(2);
  const [notice, setNotice] = useState("");
  const doc = useStudio((state) => state.doc);
  const selectedId = useStudio((state) => state.selectedLetteringId);
  const selectedNodeId = useStudio((state) => state.selectedGlyphNodeId);
  const editNodes = useStudio((state) => state.editGlyphNodes);
  const setEditNodes = useStudio((state) => state.setEditGlyphNodes);
  const moveHandles = useStudio((state) => state.moveGlyphNodeHandles);
  const controlLinkMode = useStudio((state) => state.controlLinkMode);
  const setMoveHandles = useStudio((state) => state.setMoveGlyphNodeHandles);
  const tool = useStudio((state) => state.tool);
  const update = useStudio((state) => state.updateLettering);
  const item = (doc.lettering ?? []).find((entry) => entry.id === selectedId);
  const node = item?.kind === "outline" && item.pathData
    ? outlineNodes(item.pathData).find((entry) => entry.id === selectedNodeId) : undefined;

  if (panelOpen || !editNodes || tool !== "select" || item?.kind !== "outline" || !item.pathData) return null;

  const move = (dx: number, dy: number) => {
    if (!node || !item.pathData) return;
    const changed = node.role === "control" && controlLinkMode !== "free"
      ? moveLinkedCubicControl(
          item.pathData, node.id, node.x + dx, node.y + dy, controlLinkMode,
        ) ?? moveOutlineNodeWithHandles(item.pathData, node.id,
          node.x + dx, node.y + dy, moveHandles)
      : moveOutlineNodeWithHandles(
          item.pathData, node.id, node.x + dx, node.y + dy, moveHandles,
        );
    if (changed && changed !== item.pathData) {
      update(item.id, { pathData: changed });
      setNotice("");
    }
  };
  return (
    <aside dir="rtl" aria-label="تحكم دقيق بنقاط Bézier"
      className="absolute inset-x-2 bottom-2 z-20 max-h-[min(55dvh,calc(100%-1rem),26rem)] space-y-2 overflow-y-auto overscroll-contain touch-pan-y rounded-2xl border border-primary/40 bg-card/95 p-2 text-foreground shadow-xl backdrop-blur-lg sm:inset-x-auto sm:end-3 sm:w-[min(26rem,calc(100%-1.5rem))] [@media(min-width:900px)_and_(orientation:landscape)]:hidden min-[1200px]:hidden">
      <div className="flex min-h-11 items-center gap-1.5">
        <Move className="mx-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {node ? "نقطة " + (node.id + 1) + " · " + (node.role === "anchor" ? "تثبيت" : "مقبض منحنى")
            : "اختر نقطة من الرسم"}
        </span>
        <button type="button" title="إنهاء تحرير النقاط" aria-label="إنهاء تحرير نقاط Bézier"
          onClick={() => setEditNodes(false)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
          <Check className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {node && (
        <>
          <div className="grid grid-cols-5 gap-1" role="group" aria-label="إزاحة نقطة Bézier بوحدات الخط">
            {([
              [ArrowRight, "يمين", step, 0], [ArrowLeft, "يسار", -step, 0],
              [ArrowUp, "أعلى", 0, step], [ArrowDown, "أسفل", 0, -step],
            ] as const).map(([Icon, label, dx, dy]) => (
              <button type="button" key={label} title={"تحريك " + label}
                aria-label={"تحريك النقطة " + label + " بمقدار " + step + " وحدة"}
                onClick={() => move(dx, dy)}
                className="flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-border bg-background active:bg-primary/15">
                <Icon className="h-5 w-5" aria-hidden />
              </button>
            ))}
            <label className="min-w-0">
              <span className="sr-only">مقدار الحركة بوحدات الخط</span>
              <select className="h-11 w-full rounded-xl border border-primary/30 bg-background px-0.5 text-center text-xs font-semibold tabular-nums"
                aria-label="مقدار حركة النقطة" value={step}
                onChange={(event) => setStep(Number(event.target.value))}>
                {[1, 2, 5, 10].map((value) =>
                  <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          {node.role === "control" && (
            <CubicHandleLinkControls path={item.pathData} nodeId={node.id} />
          )}
          {node.role === "anchor" && (
            <>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 text-[11px]">
                <span className="min-w-0 leading-5">تحريك المقابض مع نقطة التثبيت</span>
                <input type="checkbox" checked={moveHandles}
                  onChange={(event) => setMoveHandles(event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
              </label>
              <details className="rounded-xl border border-border bg-background p-2">
                <summary className="min-h-11 cursor-pointer px-2 py-2 text-[11px] font-semibold">
                  إضافة وحذف العقد وتعديل الزوايا
                </summary>
                <GlyphNodeTopologyActions item={item} nodeId={node.id} compact />
              </details>
            </>
          )}
        </>
      )}
      {notice && <p role="status" className="px-2 text-[11px] leading-5 text-muted-foreground">{notice}</p>}
    </aside>
  );
}
