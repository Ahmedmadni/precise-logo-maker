import { linkedCubicControl, type ControlLinkMode } from "../../calligraphy/handleCoupling";
import { useStudio } from "../../store/studioStore";

/** The setting controls dragging, not the saved glyph. If no pair exists,
 * the canvas moves the selected handle freely without crossing contours. */
export function CubicHandleLinkControls({ path, nodeId }: { path: string; nodeId: number }) {
  const mode = useStudio(s => s.controlLinkMode);
  const setMode = useStudio(s => s.setControlLinkMode);
  const available = linkedCubicControl(path, nodeId) !== null;
  const options: { id: ControlLinkMode; label: string; title: string }[] = [
    { id: "free", label: "حر", title: "تحريك المقبض وحده" },
    { id: "smooth", label: "اتصال ناعم", title: "محاذاة المقبض المقابل مع الاحتفاظ بطوله" },
    { id: "symmetric", label: "تناظر", title: "مقبضان متعاكسان ومتساويا الطول" },
  ];
  return (
    <section className="space-y-1.5 rounded-xl border border-border bg-background p-2" dir="rtl"
      aria-label="ربط مقابض منحنى Bézier أثناء السحب">
      <p className="text-[11px] font-semibold">ترابط المماسات أثناء سحب المقبض</p>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="طريقة سحب المقبض">
        {options.map(option => (
          <button type="button" key={option.id}
            aria-pressed={mode === option.id} title={option.title}
            disabled={!available && option.id !== "free"}
            onClick={() => setMode(option.id)}
            className={"min-h-11 min-w-0 rounded-lg border px-1 text-[11px] font-semibold disabled:opacity-40 " +
              (mode === option.id ? "border-primary bg-primary/15 text-primary" : "border-border")}>
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {available
          ? "الاتصال الناعم يثبت طول المقبض المقابل، والتناظر يطابق الطولين. يمكن العودة للتحرير الحر."
          : "لا يوجد مقبض مكعّب مقابل في المسار نفسه؛ يتحرك هذا المقبض بحرية."}
      </p>
    </section>
  );
}
