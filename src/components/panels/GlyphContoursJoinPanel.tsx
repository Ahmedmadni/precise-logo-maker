import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Link2, Move, Waypoints } from "lucide-react";
import type { LetteringItem } from "../../calligraphy/model";
import {
  getJoinAnchor, moveOutlineContour, outlineContours,
  type ContourRole, type JoinSide,
} from "../../calligraphy/contourComposer";
import { alignJoinWithClearance, analyzeJoin } from "../../calligraphy/joinAssistant";
import { createRibbonLink } from "../../calligraphy/ribbonJoin";
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

export function GlyphContoursJoinPanel({ selected, siblings, part }: {
  selected: LetteringItem; siblings: LetteringItem[]; part: "contours" | "joins";
}) {
  const update = useStudio((s) => s.updateLettering);
  const addLink = useStudio((s) => s.addLettering);
  const editContours = useStudio((s) => s.editGlyphContours);
  const setEditContours = useStudio((s) => s.setEditGlyphContours);
  const contourIndex = useStudio((s) => s.selectedContourIndex);
  const setContourIndex = useStudio((s) => s.setSelectedContourIndex);
  const editJoin = useStudio((s) => s.editJoinAnchors);
  const setEditJoin = useStudio((s) => s.setEditJoinAnchors);
  const setJoinGuide = useStudio((s) => s.setJoinGuide);
  const [moveStep, setMoveStep] = useState(10);
  const [targetId, setTargetId] = useState("");
  const [mySide, setMySide] = useState<JoinSide>("entry");
  const [targetSide, setTargetSide] = useState<JoinSide>("exit");
  const [notice, setNotice] = useState("");
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const contours = outlineContours(selected.pathData ?? "");
  const selectedContour = contours.find((c) => c.index === contourIndex) ?? null;
  const targets = siblings.filter((item) => item.id !== selected.id && item.kind === "outline");
  const target = targets.find((item) => item.id === targetId) ?? targets[0];
  const analysis = target ? analyzeJoin(selected, mySide, target, targetSide) : null;

  useEffect(() => {
    if (!targets.find((item) => item.id === targetId)) setTargetId(targets[0]?.id ?? "");
  }, [selected.id, siblings.map((item) => item.id).join("|")]);

  useEffect(() => {
    if (part !== "joins" || !editJoin || !target) {
      setJoinGuide(null);
      return;
    }
    setJoinGuide({
      sourceId: selected.id, targetId: target.id,
      sourceSide: mySide, targetSide,
    });
    return () => setJoinGuide(null);
  }, [part, editJoin, selected.id, target?.id, mySide, targetSide, setJoinGuide]);

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
  const createJoin = () => {
    if (!target) return;
    const ribbon = createRibbonLink(selected, target, mySide, targetSide);
    if (!ribbon) {
      setNotice("تعذر إنشاء الوصلة. يجب اختيار حرفين منفصلين ونقطتي اتصال بينهما فجوة لا تقل عن وحدتين.");
      return;
    }
    addLink(ribbon);
    setNotice("");
  };
  const moveToJoin = () => {
    if (!target) return;
    const point = alignJoinWithClearance(selected, mySide, target, targetSide, offsetX, offsetY);
    if (!point) {
      setNotice("تعذر حساب المحاذاة بهذه النقاط");
      return;
    }
    update(selected.id, point);
    setNotice("تمت المحاذاة مع الإزاحة المحددة. افحص شكل الضربات بصريا؛ لم يتم توليد وصلة تلقائية.");
  };
  const resetAnchor = (side: JoinSide) => {
    if (!selected.joinAnchors?.[side]) return;
    const anchors = { ...selected.joinAnchors };
    delete anchors[side];
    update(selected.id, { joinAnchors: anchors });
    setNotice("تمت استعادة نقطة الاتصال الهندسية الافتراضية؛ يمكن سحبها لتحديد موضعها بدقة.");
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
      {part === "contours" && <details open className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">أجزاء الحرف والمسارات الداخلية</summary>
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
      </details>}
      {part === "joins" && <details open className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-xs font-bold">نقاط الدخول والخروج بين الحروف</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            حدد نقطتي دخول وخروج الحرف بدقة، ثم قرّب الحروف من بعضها بالمحاذاة الهندسية.
            نقاط الدخول والخروج الافتراضية تقديرات هندسية وليست مواضع اتصال خطاطية معتمدة.
            اسحبها يدويًا لتحديد نقاط الاتصال الصحيحة. الربط لا يغير تشكيل OpenType.
          </p>
          <button type="button" className={btn + (editJoin ? " w-full border-primary bg-primary/15" : " w-full")}
            aria-pressed={editJoin} onClick={() => setEditJoin(!editJoin)}>
            <Waypoints className="h-4 w-4" />
            {editJoin ? "إخفاء نقاط الاتصال ومعاينة الفجوة" : "إظهار نقاط الاتصال ومعاينة الفجوة"}
          </button>
          {(["entry", "exit"] as const).map((side) => {
            const anchor = getJoinAnchor(selected, side);
            return <div key={side} className="space-y-2 rounded-lg border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">{side === "entry" ? "نقطة دخول الحرف" : "نقطة خروجه"}</p>
                <button type="button" className={btn + " px-2"} disabled={!selected.joinAnchors?.[side]}
                  onClick={() => resetAnchor(side)}
                  aria-label={side === "entry" ? "إعادة ضبط نقطة الدخول" : "إعادة ضبط نقطة الخروج"}>
                  إعادة الضبط
                </button>
              </div>
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
            {analysis && <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <h4 className="text-xs font-semibold">قياس الفجوة الحالية بين النقطتين</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                {([
                  ["أفقي", analysis.deltaX],
                  ["رأسي", analysis.deltaY],
                  ["إجمالي", analysis.distance],
                ] as const).map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-lg bg-background p-2">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p dir="ltr" className="mt-1 truncate font-mono text-xs font-semibold" title={value.toFixed(1)}>
                      {value.toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                القياسات بوحدات اللوحة. الإشارة الموجبة تعني أن النقطة المستهدفة جهة اليمين أو الأسفل.
                إنها مسافة بين نقطتين اختارتهما، وليست قياسا لجودة الوصلة الخطية.
              </p>
            </div>}
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold">ضبط إزاحة بعد المحاذاة (اختياري)</summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  ["أفقي X", offsetX, setOffsetX],
                  ["رأسي Y", offsetY, setOffsetY],
                ] as const).map(([label, val, setter]) => (
                  <label key={label} className="space-y-1 text-xs">
                    {label}
                    <input type="number" className={field} min={-200} max={200} step={1}
                      value={val} onChange={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next) && Math.abs(next) <= 200) setter(next);
                      }} />
                  </label>
                ))}
              </div>
              <button type="button" className={btn + " mt-3 w-full"} onClick={() => {
                setOffsetX(0); setOffsetY(0);
              }}>إعادة الإزاحة إلى صفر</button>
            </details>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <h4 className="text-xs font-semibold">إنشاء وصلة فيكتور بين الحرفين</h4>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                ينشئ شريطًا منحنيًا مستقلًا مرتبطًا بالحرفين، يمكن تعديل سمك بدايته
                ونهايته وانحنائه ثم تصديره كمسار SVG حقيقي. يحتاج فراغًا بين النقطتين.
              </p>
              <button type="button" onClick={createJoin}
                disabled={!analysis || analysis.distance < 2}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                <Link2 className="h-4 w-4" /> إنشاء وصلة منحنية قابلة للتعديل
              </button>
              {analysis && analysis.distance < 2 && <p className="mt-2 text-[11px] text-muted-foreground">
                النقطتان متطابقتان تقريبًا. أبعد الحرفين قليلاً لإنشاء امتداد ظاهر.
              </p>}
            </div>
            <button type="button" onClick={moveToJoin} disabled={!analysis}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground disabled:opacity-40">
              <Link2 className="h-4 w-4" /> محاذاة النقطتين دون إنشاء وصلة
            </button>
          </div>}
          {targets.length === 0 && <p className="text-xs text-muted-foreground">
            أضف أو اختر كلمة تحتوي على شكلين حرفيين على الأقل لتفعيل المحاذاة مع الحروف المجاورة.
          </p>}
          {notice && <p role="status" className="text-xs leading-5 text-primary">{notice}</p>}
        </div>
      </details>}
    </section>
  );
}
