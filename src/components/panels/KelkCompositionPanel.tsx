import { useState, useMemo } from "react";
import { FreePathLayoutPanel } from "./FreePathLayoutPanel";
import { measureOpticalGaps, suggestOpticalArrangement } from "../../calligraphy/opticalSpacing";
import { Minimize2, Maximize2, Spline, Sparkles } from "lucide-react";
import { letteringTransform, safePath, safeColor, type LetteringItem } from "../../calligraphy/model";
import { letteringGroupBounds } from "../../calligraphy/morph";
import { outlineNodes } from "../../calligraphy/pathEditor";
import { buildRibbonPath } from "../../calligraphy/ribbonJoin";
import {
  KELK_SLANT_PRESETS,
  adjustGroupOverlap,
  arrangeWordAnchors,
  arrangeWordBounds,
  applyGroupSlant,
  composeWordLayout,
  createKashidaItem,
  buildKashidaOutline,
  createConnectedKashida,
  type KashidaStyle,
  type KelkLayoutStyle,
} from "../../calligraphy/kelkComposition";
import { useStudio } from "../../store/studioStore";
import { suggestRibbonCapFit } from "../../calligraphy/ribbonCapFit";

const btn = "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground hover:bg-accent active:scale-[.98] disabled:opacity-40";

const LAYOUT_OPTIONS: { id: KelkLayoutStyle; label: string }[] = [
  { id: "cascade", label: "تدرّج ثلثي" },
  { id: "interlock", label: "تراكب متداخل" },
  { id: "arch", label: "قوس خطّي" },
  { id: "vertical", label: "تركيب رأسي" },
  { id: "circle", label: "تركيب دائري" },
  { id: "ellipse", label: "تركيب بيضاوي" },
  { id: "reset", label: "تصفير الميل والارتفاع" },
];

const KASHIDA_STYLES: { id: KashidaStyle; label: string }[] = [
  { id: "flat", label: "مسطّحة" },
  { id: "arch", label: "مقوّسة" },
  { id: "wave", label: "متموّجة" },
];

export function KelkCompositionPanel({ selected, siblings }: {
  selected: LetteringItem;
  siblings: LetteringItem[];
}) {
  const updateMany = useStudio((s) => s.updateLetteringMany);
  const addLettering = useStudio((s) => s.addLettering);
  const commitPreview = useStudio((s) => s.commitLetteringPreview);
  const moveScope = useStudio((s) => s.letteringMoveScope);
  const [kashidaStyle, setKashidaStyle] = useState<KashidaStyle>("arch");
  const [kashidaLength, setKashidaLength] = useState(650);
  const [kashidaArch, setKashidaArch] = useState(110);
  const [kashidaThickness, setKashidaThickness] = useState(72);

  const targets = moveScope === "word" && siblings.length > 1 ? siblings : [selected];
  const hasWordGroup = siblings.filter(item => !item.hidden && (item.kind === "outline" || item.kind === "text")).length > 1;
  const [layoutIntensity, setLayoutIntensity] = useState(1);
  const [orbitAspect, setOrbitAspect] = useState(1.5);
  const [orbitRadius, setOrbitRadius] = useState(1);
  const [orbitStart, setOrbitStart] = useState(-90);
  const [orbitClockwise, setOrbitClockwise] = useState(false);
  const [orbitTangent, setOrbitTangent] = useState(false);
  const [orbitEqualArc, setOrbitEqualArc] = useState(true);
  const [orbitUpright, setOrbitUpright] = useState(true);
  const [spacingStep, setSpacingStep] = useState(6);
  const kashidaOptions = {
    length: kashidaLength,
    arch: kashidaStyle === "flat" ? 0 : kashidaArch,
    thickness: kashidaThickness,
    style: kashidaStyle,
  };
  const kashidaPath = buildKashidaOutline(kashidaOptions);
  const [targetId, setTargetId] = useState("");
  const eligibleTargets = siblings.filter(item => item.id !== selected.id && item.kind === "outline" && !item.hidden && !!item.pathData);
  const target = eligibleTargets.find(item => item.id === targetId);
  const [connectionError, setConnectionError] = useState(false);
  const [autoFitCaps, setAutoFitCaps] = useState(false);
  const [nibAngle, setNibAngle] = useState(35);
  const [nibContrast, setNibContrast] = useState(0);
  const prepareConnection = (source: LetteringItem, destination: LetteringItem, all: LetteringItem[]) => {
    const item = createConnectedKashida(source, destination, { ...kashidaOptions, nibAngle, nibContrast: nibContrast / 100 });
    if (!item) return null;
    const fit = autoFitCaps ? suggestRibbonCapFit(item, all) : null;
    return { item: fit ? { ...item, ribbon: fit.ribbon } : item, fitted: !!fit };
  };
  const connection = target ? prepareConnection(selected, target, siblings) : null;
  const previewGlyphs = target ? [selected, target] : [];
  const previewPath = connection ? buildRibbonPath(connection.item, previewGlyphs) : null;
  const glyphBounds = letteringGroupBounds(previewGlyphs);
  const previewNodes = previewPath ? outlineNodes(previewPath) : [];
  const previewBounds = glyphBounds && previewNodes.length ? (() => {
    const left = Math.min(glyphBounds.x, ...previewNodes.map(n => n.x));
    const top = Math.min(glyphBounds.y, ...previewNodes.map(n => n.y));
    const right = Math.max(glyphBounds.x + glyphBounds.width, ...previewNodes.map(n => n.x));
    const bottom = Math.max(glyphBounds.y + glyphBounds.height, ...previewNodes.map(n => n.y));
    const pad = Math.max(4, Math.max(right-left,bottom-top)*0.1);
    return [left-pad,top-pad,right-left+2*pad,bottom-top+2*pad].join(" ");
  })() : null;
  const insertConnected = () => {
    commitPreview();
    const latest = useStudio.getState().doc.lettering ?? [];
    const source = latest.find(item => item.id === selected.id);
    const destination = latest.find(item => item.id === targetId);
    const prepared = source && destination ? prepareConnection(source, destination, latest) : null;
    setConnectionError(!prepared);
    if (prepared) addLettering(prepared.item);
  };

  const onSlant = (preset: { skewX: number; rotation: number; label: string }) => {
    commitPreview();
    const patches = applyGroupSlant(targets.filter(item => !item.hidden), preset);
    if (patches.length) updateMany(patches, `ميل ${preset.label}`);
  };

  const onLayout = (style: KelkLayoutStyle, label: string) => {
    commitPreview();
    const latest = useStudio.getState().doc.lettering ?? [];
    const ids = new Set((hasWordGroup ? siblings : [selected]).map(item => item.id));
    const patches = composeWordLayout(latest.filter(item => ids.has(item.id) && !item.hidden), style, layoutIntensity, { aspect:orbitAspect, radiusScale:orbitRadius, startAngle:orbitStart, clockwise:orbitClockwise, tangent:orbitTangent, equalArc:orbitEqualArc, keepUpright:orbitUpright });
    if (patches.length) updateMany(patches, label);
  };

  const [arrangementNotice, setArrangementNotice] = useState("");
  const [showGapAnalysis, setShowGapAnalysis] = useState(false);
  const [opticalStrength, setOpticalStrength] = useState(100);
  const opticalProposal = useMemo(() => showGapAnalysis ? suggestOpticalArrangement(siblings, opticalStrength/100) : null, [showGapAnalysis, siblings, opticalStrength]);
  const applyOpticalArrangement = () => {
    commitPreview();
    const ids = new Set(siblings.map(item => item.id));
    const latest = (useStudio.getState().doc.lettering ?? []).filter(item => ids.has(item.id));
    const proposed = suggestOpticalArrangement(latest, opticalStrength/100);
    if (!proposed) { setArrangementNotice("لا يوجد اقتراح آمن يحسن توزيع الفراغات."); return; }
    updateMany(proposed.patches, "موازنة الفراغات بين الحروف");
    setArrangementNotice("تم تطبيق توزيع قابل للتراجع.");
  };
  const opticalGaps = useMemo(() => showGapAnalysis ? measureOpticalGaps(siblings) : [], [showGapAnalysis, siblings]);
  const onArrange = (mode: "equal-spacing" | "baseline" | "bounds") => {
    commitPreview();
    const latest = useStudio.getState().doc.lettering ?? [];
    const ids = new Set(siblings.map(item => item.id));
    const group = latest.filter(item => ids.has(item.id));
    const patches = mode === "bounds" ? arrangeWordBounds(group) : arrangeWordAnchors(group, mode);
    setArrangementNotice(patches.length ? "" : "لا يوجد تعديل آمن مطلوب ضمن حدود التركيب الحالي.");
    if (patches.length) updateMany(patches, mode === "baseline" ? "محاذاة السطر" : mode === "bounds" ? "توزيع حدود الحروف" : "توزيع الحروف");
  };

  const onOverlap = (deltaPx: number) => {
    commitPreview();
    const patches = adjustGroupOverlap(siblings.filter(item => !item.hidden), deltaPx);
    if (patches.length) updateMany(patches, deltaPx < 0 ? "تقريب الحروف" : "تبعيد الحروف");
  };

  const onInsertKashida = () => {
    commitPreview();
    const item = createKashidaItem(selected, kashidaOptions);
    if (item) addLettering(item);
  };

  return (
    <details open className="space-y-2.5 rounded-lg border border-border bg-card/70 p-2.5">
      <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        تركيب كيلك: الميل والتراكب والكشيدة
      </summary>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          قوالب ميل الخط ({moveScope === "word" && hasWordGroup ? "الكلمة كاملة" : "الحرف المحدد"})
        </span>
        <div className="grid grid-cols-4 gap-1">
          {KELK_SLANT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={btn}
              onClick={() => onSlant(preset)}
              title={`ميل ${preset.skewX}° ودوران ${preset.rotation}°`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border pt-2">
        <span className="text-[11px] font-medium text-muted-foreground">تراكب وتداخل الكلمة</span>
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>شدة التركيب</span><span dir="ltr">{layoutIntensity.toFixed(2)}×</span>
          </span>
          <input type="range" min={0.25} max={3} step={0.25} value={layoutIntensity} onChange={e => setLayoutIntensity(Number(e.target.value))} disabled={!hasWordGroup} className="w-full" />
        </label>
        <p className="text-[11px] text-muted-foreground">التركيب الرأسي والدائري والبيضاوي يعيد توزيع الحروف كعناصر زخرفية مستقلة؛ قد يفصل الوصلات الطبيعية للكلمة. لاستعادة المواضع السابقة استخدم التراجع.</p>
        <details className="rounded-lg border border-border p-2">
          <summary className="cursor-pointer py-2 text-xs font-medium">إعدادات المسار الدائري والبيضاوي</summary>
          <div className="space-y-2 text-xs">
            <label className="block space-y-1">
              <span className="flex justify-between"><span>نسبة عرض البيضاوي إلى ارتفاعه</span><span dir="ltr">{orbitAspect.toFixed(1)}×</span></span>
              <input type="range" min={0.5} max={2.5} step={0.1} value={orbitAspect} onChange={e=>setOrbitAspect(Number(e.target.value))} className="w-full"/>
            </label>
            <label className="block space-y-1">
              <span className="flex justify-between"><span>اتساع نصف القطر</span><span dir="ltr">{orbitRadius.toFixed(1)}×</span></span>
              <input type="range" min={1} max={3} step={0.1} value={orbitRadius} onChange={e=>setOrbitRadius(Number(e.target.value))} className="w-full"/>
            </label>
            <label className="block space-y-1">
              <span className="flex justify-between"><span>زاوية البداية</span><span dir="ltr">{orbitStart}°</span></span>
              <input type="range" min={-180} max={180} step={5} value={orbitStart} onChange={e=>setOrbitStart(Number(e.target.value))} className="w-full"/>
            </label>
            <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={orbitClockwise} onChange={e=>setOrbitClockwise(e.target.checked)}/> مع عقارب الساعة</label>
            <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={orbitTangent} onChange={e=>setOrbitTangent(e.target.checked)}/> تدوير الحروف وفق مماس المسار</label>
            <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={orbitEqualArc} onChange={e=>setOrbitEqualArc(e.target.checked)}/> توزيع متساوٍ حسب طول القوس البيضاوي</label>
            <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={orbitUpright} disabled={!orbitTangent} onChange={e=>setOrbitUpright(e.target.checked)}/> منع دوران الحروف رأسًا على عقب</label>
            <p className="text-[11px] text-muted-foreground">تطبق الإعدادات عند اختيار التركيب الدائري أو البيضاوي. مساواة طول القوس لا تعني مساواة الفراغ بين حواف الحروف المختلفة.</p>
          </div>
        </details>
        <div className="grid grid-cols-2 gap-1">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={btn}
              disabled={!hasWordGroup && opt.id !== "reset"}
              onClick={() => onLayout(opt.id, opt.label)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {hasWordGroup && <FreePathLayoutPanel siblings={siblings}/>}
        <div className="grid grid-cols-2 gap-1">
          <button type="button" className={btn} disabled={!hasWordGroup} onClick={() => onArrange("baseline")}>محاذاة السطر</button>
          <button type="button" className={btn} disabled={siblings.filter(item => !item.hidden && (item.kind === "outline" || item.kind === "text")).length < 3} onClick={() => onArrange("equal-spacing")}>توزيع المراسي</button>
        </div>
        <button type="button" className={`${btn} w-full`} disabled={siblings.filter(item => !item.hidden && item.kind === "outline" && !!item.pathData).length < 3} onClick={() => onArrange("bounds")}>توزيع المسافات بين حدود الحروف</button>
        <p className="text-[11px] text-muted-foreground">توزيع الحدود يراعي العرض الهندسي لكل حرف مع تثبيت طرفي التركيب. لا يقيس الفراغ البصري بين المنحنيات مباشرة.</p>
        {arrangementNotice && <p role="status" className="text-xs text-muted-foreground">{arrangementNotice}</p>}
        <button type="button" className={`${btn} w-full`} disabled={!hasWordGroup} aria-expanded={showGapAnalysis} onClick={() => setShowGapAnalysis(v => !v)}>
          {showGapAnalysis ? "إخفاء فحص الفراغات" : "فحص الفراغات بين المنحنيات"}
        </button>
        {showGapAnalysis && <div className="space-y-2 rounded-lg border border-border p-2 text-[11px]">
          <p className="text-muted-foreground">قياس تقريبي عبر 32 مقطعًا أفقيًا لكل زوج متجاور. القيم السالبة تشير إلى تداخل الامتداد الأفقي، وليس بالضرورة تصادم المسارات.</p>
          {opticalGaps.length === 0 && <p>لا توجد أزواج ذات مقاطع مشتركة قابلة للقياس.</p>}
          <label className="block space-y-1">
            <span className="flex justify-between"><span>شدة موازنة الفراغات</span><span dir="ltr">{opticalStrength}%</span></span>
            <input type="range" min={10} max={100} step={5} value={opticalStrength} onChange={e => setOpticalStrength(Number(e.target.value))} className="w-full"/>
          </label>
          {opticalProposal && <div className="rounded-md bg-secondary/50 p-2">
            <p>تفاوت وسيط الفراغات قبل وبعد الاقتراح</p>
            <p dir="ltr" className="font-mono">{opticalProposal.beforeSpread.toFixed(1)} → {opticalProposal.afterSpread.toFixed(1)} px</p>
            <p>الشدة الممكنة هندسيًا: {Math.round(opticalProposal.appliedStrength*100)}%</p>
          </div>}
          <button type="button" className={`${btn} w-full`} disabled={!opticalProposal} onClick={applyOpticalArrangement}>تطبيق موازنة الفراغات</button>
          {!opticalProposal && <p className="text-muted-foreground">لا يتوفر توزيع محسّن ضمن القيود الحالية.</p>}
          {opticalGaps.map((gap,i) => <div key={gap.rightId+"-"+gap.leftId} className="rounded-md bg-secondary/50 p-2">
            <p className="font-medium">الزوج {i+1}</p>
            <div className="grid grid-cols-2 gap-1">
              <span>وسيط الفراغ <b dir="ltr">{gap.median.toFixed(1)} px</b></span>
              <span>أقل فراغ <b dir="ltr">{gap.minimum.toFixed(1)} px</b></span>
            </div>
            <p className="text-muted-foreground">مقاطع متداخلة: {gap.overlapRows} / {gap.samples}</p>
          </div>)}
        </div>}
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>خطوة التباعد</span><span dir="ltr">{spacingStep} px</span>
          </span>
          <input type="range" min={1} max={24} step={1} value={spacingStep} onChange={e => setSpacingStep(Number(e.target.value))} disabled={!hasWordGroup} className="w-full" />
        </label>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" className={btn} disabled={!hasWordGroup} onClick={() => onOverlap(-spacingStep)}>
            <Minimize2 className="h-3.5 w-3.5" /> تقريب التداخل
          </button>
          <button type="button" className={btn} disabled={!hasWordGroup} onClick={() => onOverlap(spacingStep)}>
            <Maximize2 className="h-3.5 w-3.5" /> تبعيد الحروف
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Spline className="h-3.5 w-3.5" /> كشيدة خطّية قابلة للتعديل
        </span>
        <div className="grid grid-cols-3 gap-1">
          {KASHIDA_STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              aria-pressed={kashidaStyle === st.id}
              className={`${btn} ${kashidaStyle === st.id ? "border-foreground bg-foreground text-background hover:bg-foreground/90" : ""}`}
              onClick={() => setKashidaStyle(st.id)}
            >
              {st.label}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>طول الكشيدة</span>
            <span className="font-mono" dir="ltr">{kashidaLength}</span>
          </span>
          <input type="range" min={200} max={1600} step={25} value={kashidaLength} onChange={(e) => setKashidaLength(Number(e.target.value))} className="w-full" />
        </label>
        {kashidaStyle !== "flat" && (
          <label className="block space-y-1">
            <span className="flex justify-between text-[11px] text-muted-foreground">
              <span>تقوّس الكشيدة</span>
              <span className="font-mono" dir="ltr">{kashidaArch}</span>
            </span>
            <input type="range" min={-240} max={240} step={10} value={kashidaArch} onChange={(e) => setKashidaArch(Number(e.target.value))} className="w-full" />
          </label>
        )}
        <label className="block space-y-1">
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>سماكة الكشيدة</span>
            <span className="font-mono" dir="ltr">{kashidaThickness}</span>
          </span>
          <input type="range" min={30} max={160} step={4} value={kashidaThickness} onChange={(e) => setKashidaThickness(Number(e.target.value))} className="w-full" />
        </label>
        <div className="rounded-lg border border-border bg-background px-2 py-1">
          <p className="text-[11px] text-muted-foreground">معاينة الكشيدة</p>
          <svg role="img" aria-label="معاينة شكل الكشيدة" viewBox={`${-kashidaLength / 2 - 40} -400 ${kashidaLength + 80} 800`} preserveAspectRatio="xMidYMid meet" className="block h-24 w-full text-foreground">
            <path d={`M ${-kashidaLength / 2 - 40} 0 H ${kashidaLength / 2 + 40}`} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
            {kashidaPath && <path d={kashidaPath} transform="scale(1 -1)" fill="currentColor" />}
          </svg>
        </div>
        <button type="button" disabled={!kashidaPath} className={`${btn} w-full font-semibold`} onClick={onInsertKashida}>
          إدراج كشيدة مستقلة
        </button>
        {eligibleTargets.length > 0 && <div className="space-y-2 rounded-lg border border-border p-2">
          <label className="block space-y-1 text-xs">
            <span>كشيدة مرتبطة بحرف آخر</span>
            <select className="min-h-11 w-full rounded-lg border border-border bg-background px-2 text-xs" value={target?.id ?? ""} onChange={e => { setTargetId(e.target.value); setConnectionError(false); }}>
              <option value="">اختر الحرف المستهدف</option>
              {eligibleTargets.map((item, i) => <option key={item.id} value={item.id}>{item.sourceText ?? "حرف"} · {i + 1}</option>)}
            </select>
          </label>
          <p className="text-[11px] leading-5 text-muted-foreground">الطول حسب المسافة بين نقطتي الخروج والدخول. تبقى الوصلة مرتبطة بالحرفين عند تحريكهما.</p>
          <details className="rounded-lg border border-border p-2">
            <summary className="cursor-pointer py-2 text-xs font-medium">سن القلم وتفاوت السماكة</summary>
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-1">
                {[{label:"محايد",angle:35,contrast:0},{label:"قلم عريض",angle:45,contrast:45},{label:"قلم مائل",angle:60,contrast:60}].map(preset => (
                  <button type="button" key={preset.label} className={btn}
                    aria-pressed={nibAngle === preset.angle && nibContrast === preset.contrast}
                    onClick={() => { setNibAngle(preset.angle); setNibContrast(preset.contrast); }}>{preset.label}</button>
                ))}
              </div>
              <label className="block space-y-1 text-xs">
                <span className="flex justify-between"><span>زاوية السن</span><span dir="ltr">{nibAngle}°</span></span>
                <input type="range" min={-180} max={180} step={5} value={nibAngle} onChange={e => setNibAngle(Number(e.target.value))} className="w-full" />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="flex justify-between"><span>تفاوت السماكة</span><span dir="ltr">{nibContrast}%</span></span>
                <input type="range" min={0} max={80} step={5} value={nibContrast} onChange={e => setNibContrast(Number(e.target.value))} className="w-full" />
              </label>
              <p className="text-[11px] leading-5 text-muted-foreground">يؤثر سن القلم على عرض الوصلة بين طرفيها دون تغيير السماكة المحددة عند الاتصال. هذه الإعدادات تخص الوصلة المرتبطة فقط.</p>
            </div>
          </details>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-2 text-xs">
            <input type="checkbox" checked={autoFitCaps} onChange={e => setAutoFitCaps(e.target.checked)} />
            مطابقة سُمك واتجاه الطرفين تلقائيًا
          </label>
          {autoFitCaps && <p className="text-[11px] leading-5 text-muted-foreground">يُستخدم قياس حدود الحرف فقط إذا توفر اقتراح هندسي موثوق ولم يزد مخاطر التقاطع. وإلا تُحفظ الإعدادات اليدوية؛ قد تتغير السماكة والزاوية عند نجاح المطابقة.</p>}
          {target && <div className="rounded-lg border border-border bg-background p-2">
            <p className="text-[11px] font-medium">معاينة الوصلة بين الحرفين</p>
            {previewPath && previewBounds && connection ? <>
              <svg role="img" aria-label="معاينة الحرفين والكشيدة المرتبطة" viewBox={previewBounds} className="block h-32 w-full" preserveAspectRatio="xMidYMid meet">
                <path d={previewPath} fill={safeColor(connection.item.color)} />
                {previewGlyphs.map(glyph => {
                  const scale = glyph.size / (glyph.unitsPerEm || 1000);
                  return <g key={glyph.id} transform={letteringTransform(glyph)} fill={safeColor(glyph.color)}>
                    <path d={safePath(glyph.pathData)} transform={`scale(${scale} ${-scale})`} fillRule={glyph.fillRule ?? "nonzero"} stroke={safeColor(glyph.color)} strokeWidth={scale > 0 ? (glyph.weight ?? 0)/scale : 0} strokeLinejoin="round" />
                  </g>;
                })}
              </svg>
              {autoFitCaps && <p className="text-[11px] text-muted-foreground">{connection.fitted ? "تم اقتراح مطابقة الأطراف." : "لا توجد مطابقة إضافية موثوقة؛ الإعدادات الحالية محفوظة."}</p>}
            </> : <p className="py-2 text-xs text-muted-foreground">لا تتوفر معاينة صالحة. تحقق من نقاط الاتصال.</p>}
          </div>}
          <button type="button" className={`${btn} w-full`} disabled={!connection || !previewPath} onClick={insertConnected}>إنشاء وصلة مرتبطة</button>
          {connectionError && <p role="alert" className="text-xs text-destructive">تعذر إنشاء الوصلة. راجع نقطتي الاتصال والمسافة بين الحرفين.</p>}
        </div>}
      </div>
    </details>
  );
}