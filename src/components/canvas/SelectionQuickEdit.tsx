import { Check, PencilRuler, SlidersHorizontal, Waypoints } from "lucide-react";
import { useStudio } from "../../store/studioStore";

export function SelectionQuickEdit({ panelOpen, openPanel }: { panelOpen: boolean; openPanel: () => void }) {
  const selectedId = useStudio((s) => s.selectedLetteringId);
  const lettering = useStudio((s) => s.doc.lettering);
  const geometryCount = useStudio((s) => s.selection.length);
  const editNodes = useStudio((s) => s.editGlyphNodes);
  const editContours=useStudio(s=>s.editGlyphContours);
  const glyphLasso=useStudio(s=>s.glyphLassoActive);
  const nodeLasso=useStudio(s=>s.nodeLassoTargetId);
  const knifeTarget=useStudio(s=>s.knifeTargetId);
  const editJoins = useStudio((s) => s.editJoinAnchors);
  const tool = useStudio((s) => s.tool);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  const setInspectorTab = useStudio((s) => s.setGlyphInspectorTab);
  const setEditNodes = useStudio((s) => s.setEditGlyphNodes);
  const setEditJoins = useStudio((s) => s.setEditJoinAnchors);
  const item = (lettering ?? []).find((glyph) => glyph.id === selectedId);
  if (panelOpen || editNodes || editContours || glyphLasso || nodeLasso || knifeTarget || tool !== "select" || (!item && geometryCount === 0)) return null;

  const isOutline = item?.kind === "outline"&&!item.hidden && !!item.pathData;
  const canJoin = isOutline && !item.catalogShapeId;
  const detailed = () => { setSection("edit"); openPanel(); };
  const openNodes = () => {
    setSection("edit");
    setInspectorTab("paths");
    setEditNodes(true);
  };
  const openJoins = () => {
    if (!canJoin) return;
    setSection("edit");
    setInspectorTab("joins");
    setEditJoins(true);
  };
  const buttonStyle = "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-[11px] font-semibold text-foreground active:bg-primary/15";
  return (
    <div dir="rtl" role="group" aria-label="أدوات سريعة للعنصر المحدد"
      className="absolute bottom-3 end-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-2xl border border-primary/40 bg-card/95 p-1.5 shadow-xl backdrop-blur-lg [@media(min-width:900px)_and_(orientation:landscape)]:hidden min-[1200px]:hidden">
      {editJoins && canJoin ? (
        <>
          <span className="max-w-24 truncate px-1 text-[11px] font-semibold text-primary">
            نقاط الوصل
          </span>
          <button type="button" onClick={() => setEditJoins(false)}
            aria-label="إنهاء تحرير نقاط الوصل" className={buttonStyle}>
            <Check className="h-4 w-4" aria-hidden /> إنهاء
          </button>
          <button type="button" onClick={detailed}
            aria-label="فتح تفاصيل نقاط الوصل" className={buttonStyle}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> تفاصيل
          </button>
        </>
      ) : (
        <>
          {isOutline && (
            <button type="button" onClick={openNodes}
              aria-label="فتح تحرير نقاط Bézier مباشرة على الرسم" className={buttonStyle}>
              <PencilRuler className="h-4 w-4" aria-hidden /> العقد
            </button>
          )}
          {canJoin && (
            <button type="button" onClick={openJoins}
              aria-label="فتح تحرير نقاط وصل الحروف على الرسم" className={buttonStyle}>
              <Waypoints className="h-4 w-4" aria-hidden /> الوصلات
            </button>
          )}
          <button type="button" onClick={detailed}
            aria-label={item?.kind === "bridge" ? "تحرير إعدادات الكشيدة" :
              item?.kind === "haraka" ? "تحرير حركة التشكيل" : "فتح أدوات تعديل العنصر"}
            className={buttonStyle+" border-primary/50 text-primary"}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {item?.kind === "bridge" ? "الكشيدة" :
              item?.kind === "haraka" ? "الحركة" : "تفاصيل"}
          </button>
        </>
      )}
    </div>
  );
}

