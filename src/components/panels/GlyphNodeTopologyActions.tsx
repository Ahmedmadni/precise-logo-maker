import { useState } from "react";
import { CornerDownRight, GitBranchPlus, Minus, Spline, Waypoints } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";
import {
  changeOutlineAnchor, insertOutlineAnchor, outlineNodeActions,
  removeOutlineAnchor, type NodeEditMode,
} from "../../calligraphy/nodeTopology";
import { useStudio } from "../../store/studioStore";

/** Shared touch/desktop commands: never rewrite a separate dot or open a seam. */
export function GlyphNodeTopologyActions({ item, nodeId, compact = false }: {
  item: LetteringItem;
  nodeId: number;
  compact?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const path = item.pathData ?? "";
  const available = outlineNodeActions(path, nodeId);
  const setNode = useStudio((s) => s.setSelectedGlyphNodeId);
  const update = useStudio((s) => s.updateLettering);

  const execute = (action: "insert" | "remove" | NodeEditMode) => {
    // Commit an in-progress numerical/morph preview first, then re-read the
    // actual saved outline to prevent overwriting a newer edit.
    const state = useStudio.getState();
    state.commitLetteringPreview();
    const current = useStudio.getState().doc.lettering?.find((glyph) => glyph.id === item.id);
    if (current?.kind !== "outline" || !current.pathData) return;
    const result = action === "insert"
      ? insertOutlineAnchor(current.pathData, nodeId)
      : action === "remove"
        ? removeOutlineAnchor(current.pathData, nodeId)
        : changeOutlineAnchor(current.pathData, nodeId, action);
    if (!result) {
      setNotice("الإجراء غير متاح لهذا النوع من النقاط حفاظًا على شكل الحرف.");
      return;
    }
    update(item.id, { pathData: result.path });
    setNode(result.selectedNodeId);
    setNotice(action === "insert" ? "تمت إضافة عقدة دون تغيير المنحنى." :
      action === "remove" ? "حُذفت العقدة المستقيمة." :
        action === "corner" ? "تحولت إلى زاوية حادة." :
          action === "smooth" ? "تم تنعيم اتصال المماسات." :
            "أصبحت المقابض متقابلة ومتساوية الطول.");
  };
  const actions = [
    { id: "insert", title: "إضافة نقطة في منتصف المقطع المنتهي بالعقدة المحددة", label: "إضافة", icon: GitBranchPlus, ok: available.insert },
    { id: "remove", title: "حذف نقطة خطية وسيطة فقط", label: "حذف", icon: Minus, ok: available.remove },
    { id: "corner", title: "تحويل المماسات إلى زاوية حادة", label: "زاوية", icon: CornerDownRight, ok: available.corner },
    { id: "smooth", title: "تنعيم انحناء المماسين", label: "تنعيم", icon: Spline, ok: available.smooth },
    { id: "symmetric", title: "مقابض متناظرة ومتساوية الطول", label: "تناظر", icon: Waypoints, ok: available.symmetric },
  ] as const;
  return (
    <section dir="rtl" className="space-y-2" aria-label="تحرير بنية نقطة الخط العربي">
      {!compact && (
        <p className="text-[11px] leading-5 text-muted-foreground">
          أضف عقدة دون تشويه المنحنى، أو غيّر اتصال مقابضها. الحذف متاح للعقد الخطية الوسيطة الآمنة فقط.
        </p>
      )}
      <div className={"grid gap-1.5 " + (compact ? "grid-cols-5" : "grid-cols-3")}>
        {actions.map(({ id, label, title, icon: Icon, ok }) => (
          <button key={id} type="button" disabled={!ok} title={title}
            aria-label={title} onClick={() => execute(id)}
            className={"flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl border border-border bg-background px-1 text-[11px] font-semibold text-foreground hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30 " +
              (compact ? "flex-col py-1" : "")}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      {notice && <p role="status" className="text-[11px] leading-5 text-muted-foreground">{notice}</p>}
    </section>
  );
}
