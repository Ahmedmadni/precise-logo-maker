import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Link2, Move, Waypoints } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";
import {
  alignGlyphJoin, getJoinAnchor, moveOutlineContour, outlineContours,
  type ContourRole, type JoinSide,
} from "../../calligraphy/contourComposer";
import { useStudio } from "../../store/studioStore";

const field = "min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground";
const btn = "flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border bg-secondary px-3 text-xs text-foreground hover:bg-accent";
const roles: { value: ContourRole; label: string }[] = [
  { value: "unassigned", label: "غير مصنف" },
  { value: "head", label: "رأس" },
  { value: "body", label: "جسم" },
  { value: "tail", label: "ذيل" },
  { value: "join", label: "وصلة" },
  { value: "dot", label: "نقطة" },
  { value: "counter", label: "فراغ داخلي" },
];

export function GlyphContoursJoinPanel({ selected, siblings }: {
  selected: LetteringItem; siblings: LetteringItem[];
}) {
  const update = useStudio((s) => s.updateLettering);
  const editContours = useStudio((s) => s.editGlyphContours);
  const setEditContours = useStudio((s) => s.setEditGlyphContours);
  const contourIndex = useStudio((s) => s.selectedContourIndex);
  const setContourIndex = useStudio((s) => s.setSelectedContourIndex);
  const editJoin = useStudio((s) => s.editJoinAnchors);
  const setEditJoin = useStudio((s) => s.setEditJoinAnchors);
  const [moveStep, setMoveStep] = useState(10);
  const [targetId, setTargetId] = useState("");
  const [mySide, setMySide] = useState<JoinSide>("entry");
  const [targetSide, setTargetSide] = useState<JoinSide>("exit");
  const [notice, setNotice] = useState("");
  const contours = outlineContours(selected.pathData ?? "");
  const selectedContour = contours.find((c) => c.index === contourIndex) ?? null;
  const targets = siblings.filter((item) => item.id !== selected.id && item.kind === "outline");
  const target = targets.find((item) => item.id === targetId) ?? targets[0];

  useEffect(() => {
    if (!targets.find((item) => item.id === targetId)) setTargetId(targets[0]?.id ?? "");
  }, [selected.id, siblings.map((item) => item.id).join("|")]);

  if (selected.kind !== "outline" || !selected.pathData) return null;

  const offsetContour = (dx: number, dy: number) => {
    if (contourIndex === null) return;
    const path = moveOutlineContour(selected.pathData!, contourIndex, dx, dy);
    if (path) update(selected.id, { pathData: path });
  };
  const changeRole = (role: ContourRole) => {
    if (contourIndex === null) return;
    update(selected.id, { contourRoles: {
      ...selected.contourRoles, [String(contourIndex)]: role,
    } });
  };
  const moveToJoin = () => {
    if (!target) return;
    const point = alignGlyphJoin(selected, mySide, target, targetSide);
    if (!point) {
      setNotice("تعذر حساب المحاذاة بهذه النقاط");
      return;
    }
    update(selected.id, point);
    setNotice("تمت محاذاة نقطتي الاتصال هندسيا. افحص شكل الوصلة بصريا قبل التصدير.");
  };
  const setAnchorNumber = (side: JoinSide, axis: "x" | "y", number: number) => {
    if (!Number.isFinite(number) || Math.abs(number) > 100000) return;
    const current = getJoinAnchor(selected, side);
    if (!current) return;
    update(selected.id, {
      joinAnchors: {
        ...selected.joinAnchors,
        [side]: { ...current, [axis]: number },
      },
    });
  };

  return (
    <section className="space-y-3" dir="rtl">
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">6. أجزاء مسارات الحرف — النقاط والذيل</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            هنا يمكنك اختيار كل مسار مغلق داخل الحرف وتحريكه أو تسميته (رأس، جسم، ذيل، نقطة...).
            هذه المسارات مستخرجة من الخط نفسه؛ قد يكون الحرف رسما متصلا واحدا، وليس أجزاء جاهزة مستقلة.
          </p>
          <button type="button" className={btn + (editContours ? " w-full border-primary bg-primary/15" : " w-full")}
            aria-pressed={editContours} onClick={() => setEditContours(!editContours)}>
            <Move className="h-4 w-4" />
            {editContours ? "إنهاء تحديد أجزاء الحرف على الرسم" : "تحديد أجزاء الحرف وتحريكها على الرسم"}
          </button>
          <label className="block space-y-1 text-xs">
            المسار / الجزء
            <select className={field} value={contourIndex ?? ""} onChange={(e) => {
              setContourIndex(e.target.value === "" ? null : Number(e.target.value));
              if (e.target.value !== "") setEditContours(true);
            }}>
              <option value="">اختر جزءا من الحرف</option>
              {contours.map((contour) => <option key={contour.index} value={contour.index}>
                مسار {contour.index + 1} ({contour.pointCount} نقطة) — {
                  roles.find((role) => role.value === selected.contourRoles?.[String(contour.index)])?.label ?? "غير مصنف"
                }
              </option>)}
            </select>
          </label>
          {selectedContour && <>
            <label className="block space-y-1 text-xs">
              تصنيف الجزء يدويًا
              <select className={field} value={selected.contourRoles?.[String(selectedContour.index)] ?? "unassigned"}
                onChange={(e) => changeRole(e.target.value as ContourRole)}>
                {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 items-center justify-between gap-2 text-xs">
              مقدار التحريك بوحدات الخط
              <select className={field + " max-w-28"} value={moveStep} onChange={(e) => setMoveStep(Number(e.target.value))}>
                {[1, 5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {([
                [ArrowRight, moveStep, 0, "يمين"],
                [ArrowLeft, -moveStep, 0, "يسار"],
                [ArrowUp, 0, moveStep, "أعلى"],
                [ArrowDown, 0, -moveStep, "أسفل"],
              ] as const).map(([Icon, dx, dy, label]) =>
                <button key={label} type="button" className={btn} aria-label={"تحريك الجزء " + label}
                  onClick={() => offsetContour(dx, dy)}><Icon className="h-5 w-5" /></button>)}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              تغيير موضع مسار داخلي قد يؤثر في الفراغات والنقاط، لذلك راجع الحرف في المعاينة واستخدم «تراجع» عند الحاجة.
            </p>
          </>}
        </div>
      </details>
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">7. نقاط الدخول والخروج واتصال الحروف</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            حدد نقطتي دخول وخروج الحرف بدقة، ثم قرّب الحروف من بعضها بالمحاذاة الهندسية.
            الربط هنا لا يرسم وصلة بخطاط تلقائي ولا يغير تشكيل OpenType.
          </p>
          <button type="button" className={btn + (editJoin ? " w-full border-primary bg-primary/15" : " w-full")}
            aria-pressed={editJoin} onClick={() => setEditJoin(!editJoin)}>
            <Waypoints className="h-4 w-4" />
            {editJoin ? "إنهاء تعديل نقاط الاتصال على الرسم" : "إظهار نقاط الاتصال وسحبها"}
          </button>
          {(["entry", "exit"] as const).map((side) => {
            const anchor = getJoinAnchor(selected, side);
            return <div key={side} className="space-y-2 rounded-lg border border-border p-2">
              <p className="text-xs font-semibold">{side === "entry" ? "نقطة دخول الحرف" : "نقطة خروجه"}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y"] as const).map((axis) => (
                  <label key={axis} className="space-y-1 text-[11px]">
                    {axis.toUpperCase()}
                    <input className={field} type="number" step={1} value={Math.round((anchor?.[axis] ?? 0) * 10) / 10}
                      onChange={(e) => setAnchorNumber(side, axis, Number(e.target.value))} />
                  </label>
                ))}
              </div>
            </div>;
          })}
          {targets.length > 0 && <div className="space-y-2 rounded-lg bg-background p-2">
            <label className="block space-y-1 text-xs">الاتصال بحرف آخر داخل الكلمة
              <select className={field} value={target?.id ?? ""} onChange={(e) => setTargetId(e.target.value)}>
                {targets.map((item, i) => <option value={item.id} key={item.id}>
                  الجزء الحرفي {item.glyphIndex !== undefined ? item.glyphIndex + 1 : i + 1}
                </option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs">من نقطتي
                <select className={field} value={mySide} onChange={(e) => setMySide(e.target.value as JoinSide)}>
                  <option value="entry">الدخول</option><option value="exit">الخروج</option>
                </select>
              </label>
              <label className="space-y-1 text-xs">إلى نقطة الحرف الآخر
                <select className={field} value={targetSide} onChange={(e) => setTargetSide(e.target.value as JoinSide)}>
                  <option value="exit">الخروج</option><option value="entry">الدخول</option>
                </select>
              </label>
            </div>
            <button type="button" onClick={moveToJoin} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
              <Link2 className="h-4 w-4" /> محاذاة النقطتين ونقل الحرف
            </button>
          </div>}
          {targets.length === 0 && <p className="text-xs text-muted-foreground">
            أضف أو اختر كلمة تحتوي على شكلين حرفيين على الأقل لتفعيل المحاذاة مع الحروف المجاورة.
          </p>}
          {notice && <p role="status" className="text-xs leading-5 text-primary">{notice}</p>}
        </div>
      </details>
    </section>
  );
}
