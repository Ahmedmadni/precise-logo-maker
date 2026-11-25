import { useState } from "react";
import { DEFAULT_BRUSH, brushIsValid, brushPressureWidth, type BrushSettings } from "../../core/tracing/vectorBrush";
import { Circle, Compass, Grid3X3, Hand, Minus, MousePointer2, Paintbrush, PenLine, Ruler, Shapes, Spline, SlidersHorizontal, Gauge, BookOpen, Check, Lasso } from "lucide-react";
import type { ToolId } from "../../store/studioStore";
import { useStudio } from "../../store/studioStore";
import { BrushPresetPreview } from "./BrushPresetPreview";

const tools: { id: ToolId; label: string; description: string; icon: typeof PenLine }[] = [
  { id: "select", label: "تحديد وتحريك", description: "حدد الأشكال أو الحروف واسحبها", icon: MousePointer2 },
  { id: "pan", label: "تحريك اللوحة", description: "حرّك مساحة الرسم", icon: Hand },
  { id: "pen", label: "قلم المسارات", description: "ارسم خطًا يمكن تنعيمه وتحويله إلى فيكتور", icon: PenLine },
  { id: "brush", label: "الفرش الخطاطية", description: "فرش فيكتور بضغط القلم واتجاه سن القصبة", icon: Paintbrush },
  { id: "line", label: "خط مستقيم", description: "خطوط هندسية دقيقة", icon: Minus },
  { id: "circle", label: "دائرة", description: "أشكال دائرية", icon: Circle },
  { id: "arc", label: "قوس", description: "منحنيات وأقواس", icon: Spline },
  { id: "polygon", label: "شكل هندسي", description: "إنشاء أشكال مغلقة", icon: Shapes },
  { id: "cell", label: "تلوين الخلايا", description: "الرسم على الشبكات", icon: Grid3X3 },
  { id: "measure", label: "قياس", description: "الأطوال والزوايا", icon: Ruler },
];

const PEN_KEY = "logo-studio:custom-pens:v1";
type SavedPen = { name: string; settings: BrushSettings };
function readPens(): SavedPen[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PEN_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((p): p is SavedPen => !!p && typeof p.name === "string" && !!p.settings && brushIsValid(p.settings)).slice(0, 30) : [];
  } catch { return []; }
}

export function StudioDrawingPanel({ onChoose }: { onChoose?: (() => void) | undefined }) {
  const selected = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const lasso=useStudio(s=>s.lassoActive);
  const setLasso=useStudio(s=>s.setLassoActive);
  const brush = useStudio((s) => s.brush);
  const setBrush = useStudio((s) => s.setBrush);
  const [pens, setPens] = useState<SavedPen[]>(readPens);
  const [penName, setPenName] = useState("");
  const [penMessage, setPenMessage] = useState("");
  const [brushTab,setBrushTab]=useState<"presets"|"shape"|"dynamics">("presets");
  const persistPens = (next: SavedPen[]) => {
    try { localStorage.setItem(PEN_KEY, JSON.stringify(next)); setPens(next); setPenMessage("تم تحديث مكتبة الأقلام"); return true; }
    catch { setPenMessage("تعذر حفظ المكتبة على الجهاز"); return false; }
  };
  const showGrids = useStudio((s) => s.showGrids);
  const setShowGrids = useStudio((s) => s.setShowGrids);
  const guideDraw = useStudio((s) => s.guideDraw);
  const setGuideDraw = useStudio((s) => s.setGuideDraw);
  const setSection = useStudio((s) => s.setWorkspaceSection);
  return (
    <div className="space-y-4 pb-6" dir="rtl">
      <div>
        <h3 className="text-sm font-semibold">أدوات الرسم الفيكتور</h3>
        <p className="mt-1 text-xs text-muted-foreground">اختر أداة ثم ارسم مباشرة على المساحة. للتعديل في الأشكال اختر «تحديد وتحريك».</p>
      </div>
      {([
        {title:"التحديد والتنقل",ids:["select","pan","measure"]},
        {title:"الأقلام والفرش",ids:["pen","brush","cell"]},
        {title:"الأشكال الهندسية",ids:["line","circle","arc","polygon"]},
      ] as const).map(group=><section key={group.title} className="space-y-1.5">
        <h4 className="text-xs font-semibold text-muted-foreground">{group.title}</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {group.ids.map(id=>{
            const item=tools.find(t=>t.id===id)!;
            const Icon=item.icon;
            return <button key={id} type="button" aria-pressed={selected===id&&!lasso} title={item.description}
              className={`flex min-h-12 min-w-0 items-center gap-2 rounded-lg border px-2 text-start text-xs ${selected===id&&!lasso?"border-primary bg-primary/10 font-semibold":"border-border bg-background hover:bg-accent"}`}
              onClick={()=>{setTool(id);if(id!=="brush")onChoose?.();}}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true"/><span className="min-w-0 flex-1">{item.label}</span>{selected===id&&!lasso&&<Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/>}
            </button>;
          })}
          {group.title==="التحديد والتنقل"&&<button type="button" aria-pressed={lasso} title="التحديد الحر بالقلم أو الفأرة" className={`flex min-h-12 min-w-0 items-center gap-2 rounded-lg border px-2 text-xs ${lasso?"border-primary bg-primary/10 font-semibold":"border-border bg-background hover:bg-accent"}`} onClick={()=>{setLasso(!lasso);if(!lasso)onChoose?.();}}><Lasso className="h-5 w-5 shrink-0" aria-hidden="true"/><span>تحديد حر</span></button>}
        </div>
      </section>)}
      {selected === "brush" && (
        <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Paintbrush className="h-4 w-4" /> إعدادات الفرش الفيكتور
          </h4>
          <p className="text-xs leading-5 text-muted-foreground">
            ارسم بالإصبع أو القلم. يتم حفظ كل ضربة كشكل فيكتور مغلق يمكن تغيير حجمه ولونه وتصديره.
          </p>
          <div className="rounded-xl border border-border bg-background p-2">
            <p className="text-xs font-semibold">معاينة القلم الحالي</p>
            <BrushPresetPreview preset={brush.preset} settings={brush} live />
            <p className="text-[11px] text-muted-foreground">عينة متجهية بضغط متدرج، تتحدث مع إعدادات القلم.</p>
          </div>
          {onChoose&&<button type="button" onClick={onChoose} className="min-h-11 w-full rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground">ابدأ الرسم بالقلم الحالي</button>}
          <nav className="grid grid-cols-3 gap-1" aria-label="إعدادات القلم">
            {([{id:"presets",label:"الأقلام",icon:BookOpen},{id:"shape",label:"السن والحبر",icon:SlidersHorizontal},{id:"dynamics",label:"الضغط",icon:Gauge}] as const).map(({id,label,icon:Icon})=><button key={id} type="button" aria-pressed={brushTab===id} onClick={()=>setBrushTab(id)} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] ${brushTab===id?"border-primary bg-primary/10 font-semibold":"border-border bg-background"}`}><Icon className="h-4 w-4" aria-hidden="true"/>{label}</button>)}
          </nav>
          <div className={brushTab==="presets"?"space-y-3":"hidden"}>
          <div className="space-y-2">
            <p className="text-xs font-semibold">إعدادات قلم سريعة</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: "قصبة عريضة", preset: "qalam", size: 24, angle: 45, smoothing: 0.35, endStyle: "flat" },
                { label: "قصبة دقيقة", preset: "qalam", size: 8, angle: 35, smoothing: 0.45, endStyle: "flat" },
                { label: "قلم مرن", preset: "taper", size: 14, angle: 0, smoothing: 0.5, endStyle: "sharp" },
                { label: "قلم دائري", preset: "round", size: 6, angle: 0, smoothing: 0.3, endStyle: "soft" },
              ] as const).map(({ label, ...settings }) => (
                <button key={label} type="button" className="min-h-11 rounded-lg border border-border bg-background px-2 text-xs hover:border-primary"
                  onClick={() => setBrush({ ...DEFAULT_BRUSH, pressureCurve:"linear", pressureFloor:.3, smoothCurves:false, nibRatio:.18, ...settings, color:brush.color })}>{label}</button>
              ))}
            </div>
          </div>
          <details className="rounded-xl border border-border bg-background p-3">
            <summary className="cursor-pointer text-xs font-semibold">أقلامي المخصصة ({pens.length})</summary>
            <div className="mt-3 space-y-2">
              <input aria-label="اسم القلم" placeholder="اسم القلم الجديد" maxLength={40} value={penName} onChange={(e) => setPenName(e.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-background px-2 text-xs" />
              <button type="button" disabled={!penName.trim() || pens.length >= 30} className="min-h-11 w-full rounded-lg border border-border text-xs disabled:opacity-40" onClick={() => { if(pens.some(p=>p.name===penName.trim())){setPenMessage("الاسم مستخدم بالفعل");return;} if(persistPens([...pens, { name: penName.trim(), settings: { ...brush } }]))setPenName(""); }}>حفظ إعدادات القلم الحالي</button>
              {pens.map((pen, i) => <div key={i} className="flex items-center gap-2">
                <button type="button" className="min-h-11 min-w-0 flex-1 truncate rounded-lg border border-border px-2 text-xs" onClick={() => setBrush({ ...pen.settings, pressureCurve: pen.settings.pressureCurve ?? "linear", pressureFloor:pen.settings.pressureFloor??.3, smoothCurves:pen.settings.smoothCurves??false, nibRatio: pen.settings.nibRatio ?? 0.18, endStyle: pen.settings.endStyle ?? "flat" })}>{pen.name}</button>
                <button type="button" aria-label={"حذف " + pen.name} className="min-h-11 rounded-lg border border-border px-2 text-xs" onClick={() => persistPens(pens.filter((_, index) => index !== i))}>حذف</button>
              </div>)}
              <p role="status" className="text-[11px] text-muted-foreground">{penMessage}</p>
            </div>
          </details>
          </div>
          <div className={brushTab==="shape"?"space-y-3":"hidden"}>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="شكل سن القلم">
            {([
              ["round", "دائرية"], ["qalam", "سن قصبة"], ["taper", "مدببة"],
            ] as const).map(([preset, label]) => (
              <button key={preset} type="button" aria-pressed={brush.preset === preset}
                onClick={() => setBrush({ preset })} title={"معاينة: " + label}
                className={"flex min-h-[92px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary " +
                  (brush.preset === preset
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background hover:border-primary/40")}>
                <BrushPresetPreview preset={preset} settings={brush} />
                <span className="text-center leading-4">{label}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-background p-2">
            <p className="text-[11px] font-semibold">شكل بداية الضربة ونهايتها</p>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="نوع أطراف الضربة">
              {([
                ["flat", "مسطحة"], ["soft", "ناعمة"], ["sharp", "مدببة"],
              ] as const).map(([style, label]) => (
                <button key={style} type="button" aria-pressed={(brush.endStyle ?? "flat") === style}
                  onClick={() => setBrush({ endStyle: style })}
                  className={"min-h-11 min-w-0 rounded-lg border px-1 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-primary " +
                    ((brush.endStyle ?? "flat") === style ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-primary/40")}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              يؤثر التدرج على أول الضربة وآخرها فقط؛ ويظل شكل سن القصبة وزاويته تحت تحكمك.
            </p>
          </div>
          <label className="block space-y-1 text-xs">
            <span className="flex justify-between"><span>عرض الفرشاة</span><span dir="ltr">{brush.size} px</span></span>
            <input className="w-full accent-[var(--color-primary)]" type="range" min={1} max={100}
              value={brush.size} onChange={(e) => setBrush({ size: Number(e.target.value) })} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-xs">
            لون الحبر
            <input className="h-10 w-20 rounded-lg border border-border bg-background p-1"
              type="color" value={brush.color} onChange={(e) => setBrush({ color: e.target.value })} />
          </label>
          {brush.preset === "qalam" && <div className="space-y-2">
            <label className="block space-y-1 text-xs">نسبة سماكة السن <span dir="ltr">{Math.round((brush.nibRatio ?? 0.18) * 100)}%</span>
              <input type="range" min={5} max={80} step={1} value={Math.round((brush.nibRatio ?? 0.18) * 100)} className="w-full accent-[var(--color-primary)]" onChange={(e) => setBrush({ nibRatio: Number(e.target.value) / 100 })} />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="flex justify-between">
                <span>زاوية حافة سن القصبة</span><span dir="ltr">{brush.angle}°</span>
              </span>
              <input className="min-h-11 w-full accent-[var(--color-primary)]" type="range" min={-90} max={90}
                value={brush.angle} onChange={(e) => setBrush({ angle: Number(e.target.value) })} />
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <svg viewBox="0 0 70 48" className="h-12 w-20 shrink-0" role="img"
                aria-label={"شكل حافة سن القصبة بزاوية " + brush.angle + " درجة"}>
                <g transform={"translate(35 24) rotate(" + brush.angle + ")"}>
                  <rect x="-26" y="-4" width="52" height="8" rx="2"
                    fill="currentColor" className="text-primary" />
                </g>
              </svg>
              <p className="text-[11px] leading-5 text-muted-foreground">
                عرض الضربة أكبر عند الحركة عموديًا على حافة السن،
                وأنحف عند الحركة في اتجاه الحافة.
              </p>
            </div>
          </div>}
          </div>
          <div className={brushTab==="dynamics"?"space-y-3":"hidden"}>
          <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-xs">تنعيم الحدود بمنحنيات Bézier<input type="checkbox" checked={brush.smoothCurves??false} onChange={e=>setBrush({smoothCurves:e.target.checked})}/></label>
          <p className="text-[11px] text-muted-foreground">يُحفظ التنعيم مع الضربات الجديدة في المسار المتجهي. الزوايا الحادة تبقى خطية؛ الضربات السابقة لا تتغير.</p>
          <label className="block space-y-1 text-xs">
            <span className="flex justify-between"><span>تنعيم حركة اليد</span><span dir="ltr">{Math.round(brush.smoothing * 100)}%</span></span>
            <input className="w-full accent-[var(--color-primary)]" type="range" min={0} max={80}
              value={Math.round(brush.smoothing * 100)}
              onChange={(e) => setBrush({ smoothing: Number(e.target.value) / 100 })} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-xs">
            حساسية ضغط القلم الإلكتروني
            <input type="checkbox" checked={brush.pressure}
              onChange={(e) => setBrush({ pressure: e.target.checked })} className="h-5 w-5" />
          </label>
          {brush.pressure&&<div className="space-y-2 rounded-lg border border-border bg-background p-2">
            <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>الحد الأدنى النسبي للسماكة</span><span dir="ltr">{Math.round((brush.pressureFloor??.3)*100)}%</span></span>
              <input className="min-h-10 w-full accent-[var(--color-primary)]" type="range" min={5} max={100} step={5} value={Math.round((brush.pressureFloor??.3)*100)} onChange={e=>setBrush({pressureFloor:Number(e.target.value)/100})}/>
            </label>
            <svg viewBox="0 0 160 90" role="img" aria-label="منحنى الضغط وعرض الضربة" className="block h-24 w-full text-foreground">
              <path d="M12 6 V78 H150" fill="none" stroke="currentColor" strokeOpacity=".3"/>
              <path d={Array.from({length:21},(_,i)=>`${i===0?"M":"L"} ${12+i*6.9} ${78-brushPressureWidth(i/20,brush)*72}`).join(" ")} stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
            <p className="text-[11px] text-muted-foreground">المحور الأفقي ضغط القلم، والرأسي نسبة عرض الضربة قبل تأثير سن القصبة والأطراف. القيمة 100% تعني عرضًا ثابتًا.</p>
          </div>}
          {brush.pressure && <label className="block space-y-1 text-xs">استجابة الضغط
            <select className="min-h-11 w-full rounded-lg border border-border bg-background px-2" value={brush.pressureCurve ?? "linear"} onChange={(e) => setBrush({ pressureCurve: e.target.value as "soft" | "linear" | "firm" })}>
              <option value="soft">ناعمة</option><option value="linear">متوازنة</option><option value="firm">قوية</option>
            </select>
          </label>}
          <p className="text-[11px] leading-5 text-muted-foreground">
            الضغط الفعلي يحتاج قلمًا وجهازًا يدعمان Pointer Events. الرسم بالإصبع يستخدم ضغطًا افتراضيًا ثابتًا.
            نقرة القصبة المفردة تترك بصمة سن مائلة بدل دائرة. الأطراف المدببة تعتمد على المسافة لا سرعة العينات. هذه فرش فيكتور وليست ضربات ثلث أصيلة جاهزة.
          </p>
          </div>
        </section>
      )}
      <details className="rounded-xl border border-border bg-background p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold"><Compass className="h-4 w-4 text-primary" /> إعدادات الرسم المساعدة</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setShowGrids(!showGrids)} aria-pressed={showGrids}
            className={`min-h-11 rounded-lg border px-2 text-xs ${showGrids ? "border-primary bg-primary/10" : "border-border"}`}>
            {showGrids ? "إخفاء الشبكة" : "إظهار الشبكة"}
          </button>
          <button type="button" onClick={() => setGuideDraw(!guideDraw)} aria-pressed={guideDraw}
            className={`min-h-11 rounded-lg border px-2 text-xs ${guideDraw ? "border-primary bg-primary/10" : "border-border"}`}>
            {guideDraw ? "إيقاف خطوط الدليل" : "خطوط الدليل"}
          </button>
          <button type="button" onClick={() => setSection("advanced")}
            className="col-span-2 min-h-11 rounded-lg border border-border px-2 text-xs">
            فتح الإعدادات الهندسية المتقدمة
          </button>
        </div>
      </details>
    </div>
  );
}
