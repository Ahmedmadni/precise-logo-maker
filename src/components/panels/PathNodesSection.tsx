import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PathGeometry, Point } from "../../core/geometry/types";
import { insertPathNode, deletePathNode, movePathNode, arrangePathNodes, nudgePathNodes, smoothSelectedPathNodes, simplifySelectedPathNodes, setPathEdgeCurved, movePathControl, type PathControl, type PathControlMode } from "../../editor/path-nodes";
import { useStudio } from "../../store/studioStore";
import { useT } from "../../i18n";
import { Button } from "../ui/button";
import { ScissorsPanel } from "./ScissorsPanel";

export function PathNodesSection({ objectId, path, disabled, onChange }: { objectId:string; path: PathGeometry; disabled: boolean; onChange: (path: PathGeometry) => void }) {
  const t = useT();
  const [node, setNode] = useState(0);
  const shared=useStudio(s=>s.pathNodeSelection);
  const nodeLassoTarget=useStudio(s=>s.nodeLassoTargetId);
  const setNodeLassoTarget=useStudio(s=>s.setNodeLassoTarget);
  const multi=shared?.objectId===objectId&&shared.geometry===path?shared.indices:[];
  const setMulti=(next:number[]|((old:number[])=>number[]))=>{
    const state=useStudio.getState(),current=state.pathNodeSelection;
    const old=current?.objectId===objectId&&current.geometry===path?current.indices:[];
    const indices=typeof next==="function"?next(old):next;
    state.setPathNodeSelection(indices.length?{objectId,geometry:path,indices}:null);
  };
  const [multiAxis,setMultiAxis]=useState<"x"|"y">("x");
  const [step,setStep]=useState(5);
  const [multiNotice,setMultiNotice]=useState("");
  const [nodeFilter,setNodeFilter]=useState("");
  const [strength,setStrength]=useState(50);
  const [tolerance,setTolerance]=useState(0.5);
  const [proposal,setProposal]=useState<{source:PathGeometry;result:PathGeometry;label:string}|null>(null);
  const selectedNodes=multi.filter(i=>Number.isInteger(i)&&i>=0&&i<path.points.length);
  const changeMany=(next:PathGeometry)=>{
    if(next===path){setMultiNotice("لا يوجد تعديل قابل للتطبيق.");return;}
    onChange(next);
    const state=useStudio.getState();
    if(state.doc.objects.find(o=>o.id===objectId)?.geometry===next&&next.points.length===path.points.length)state.setPathNodeSelection({objectId,geometry:next,indices:selectedNodes});
    else state.setPathNodeSelection(null);
    setMultiNotice("تم تعديل النقاط المحددة دفعة واحدة.");
  };
  const [mode,setMode]=useState<PathControlMode>("free");
  const canvasControl=useStudio(s=>s.pathControlSelection);
  const setCanvasControl=useStudio(s=>s.setPathControlSelection);
  const [preview,setPreview]=useState<{control:PathControl;point:Point}|null>(null);
  const drag=useRef<{control:PathControl;index:number;point:Point;inverse:DOMMatrix}|null>(null);
  const svg=useRef<SVGSVGElement|null>(null);
  const index = Math.min(node, path.points.length - 1);
  const point = path.points[index];
  if (!point) return null;
  const end=path.points[index+1]??(path.closed?path.points[0]:undefined);
  const curve=path.cubicSegments?.[index];
  const canvasActive=canvasControl?.objectId===objectId&&canvasControl.edge===index;
  const edited=curve&&preview?{...curve,[preview.control]:preview.point}:curve;
  const bounds=curve&&end?[point,end,curve.control1,curve.control2]:[];
  const left=Math.min(...bounds.map(p=>p.x)),top=Math.min(...bounds.map(p=>p.y));
  const right=Math.max(...bounds.map(p=>p.x)),bottom=Math.max(...bounds.map(p=>p.y));
  const pad=Math.max(4,Math.max(right-left,bottom-top)*.2);
  const viewBox=bounds.length?[left-pad,top-pad,right-left+pad*2,bottom-top+pad*2].join(" "):"0 0 100 100";
  const update = (axis: "x" | "y", value: string) => {
    if (!value.trim()) return;
    const number = Number(value);
    if (Number.isFinite(number)) onChange(movePathNode(path,index,{...point,[axis]:number}));
  };
  return (
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
      <legend className="mb-2 text-xs font-semibold">{t("Path nodes")}</legend>
      {!path.holes?.length&&<button type="button" aria-pressed={nodeLassoTarget===objectId} className="min-h-11 w-full rounded-lg border border-primary text-xs font-semibold" onClick={()=>setNodeLassoTarget(nodeLassoTarget===objectId?null:objectId)}>{nodeLassoTarget===objectId?"إنهاء تحديد النقاط الحر":"تحديد النقاط على اللوحة (Lasso)"}</button>}
      {nodeLassoTarget===objectId&&<p className="text-xs text-muted-foreground">ارسم حول النقاط ثم اسحب إحدى النقاط المحددة لتحريك المجموعة. على الهاتف أغلق لوحة الخصائص أولًا.</p>}
      {!path.closed&&<ScissorsPanel objectId={objectId} path={path} disabled={disabled}/>}
      <label className="flex items-center gap-2 text-xs">
        {t("Node")}
        <select aria-label={t("Node")} className="min-w-0 flex-1 rounded-md border border-border bg-background p-1.5" value={index} onChange={(e) => {setNode(Number(e.target.value));drag.current=null;setPreview(null);if(canvasControl?.objectId===objectId)setCanvasControl(null);}}>
          {path.points.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y"] as const).map((axis) => <label key={axis} className="space-y-1 text-xs">{axis.toUpperCase()}<input aria-label={`${t("Node")} ${axis.toUpperCase()}`} type="number" step="0.5" value={Number(point[axis].toFixed(4))} className="w-full rounded-md border border-border bg-background p-1.5" onChange={(e) => update(axis, e.target.value)} /></label>)}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" title={t("Add node")} aria-label={t("Add node")} disabled={disabled || (!path.closed && index === path.points.length - 1)} onClick={() => { if(canvasControl?.objectId===objectId)setCanvasControl(null);setMulti([]);setMultiNotice("");setProposal(null);onChange(insertPathNode(path, index)); setNode(index + 1); }}><Plus /></Button>
        <Button variant="outline" size="icon" title={t("Delete node")} aria-label={t("Delete node")} disabled={disabled || path.points.length <= (path.closed ? 3 : 2)} onClick={() => { if(canvasControl?.objectId===objectId)setCanvasControl(null);setMulti([]);setMultiNotice("");onChange(deletePathNode(path, index)); setNode(Math.max(0, index - 1)); }}><Trash2 /></Button>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={path.closed} disabled={disabled || path.points.length < 3} onChange={(e) => onChange({ ...path, closed: e.target.checked })} />{t("Closed path")}</label>
      </div>
      <details className="rounded-lg border border-border p-2">
        <summary className="cursor-pointer py-2 text-xs font-semibold">تحرير جماعي للنقاط</summary>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs"><span>النقاط المحددة</span><span dir="ltr">{selectedNodes.length} / {path.points.length}</span></div>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" className="min-h-11 rounded border border-border text-xs" onClick={()=>{setMulti(path.points.map((_,i)=>i));setMultiNotice("");setProposal(null);}}>تحديد الكل</button>
            <button type="button" className="min-h-11 rounded border border-border text-xs" onClick={()=>{setMulti([]);setMultiNotice("");}}>إلغاء التحديد</button>
          </div>
          <input type="search" aria-label="البحث برقم النقطة" placeholder="رقم النقطة" value={nodeFilter} onChange={e=>setNodeFilter(e.target.value)} className="min-h-10 w-full rounded border border-border bg-background px-2 text-xs"/>
          <div className="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto overscroll-contain">
            {path.points.map((_,i)=>i).filter(i=>!nodeFilter.trim()||String(i+1).includes(nodeFilter.trim())).map(i=><button key={i} type="button" aria-label={`تحديد نقطة ${i+1}`} aria-pressed={selectedNodes.includes(i)} onClick={()=>{setMulti(old=>old.includes(i)?old.filter(n=>n!==i):[...old,i]);setMultiNotice("");setProposal(null);}} className={`min-h-10 rounded border text-xs ${selectedNodes.includes(i)?"border-primary bg-primary/15 font-bold":"border-border"}`}>{i+1}</button>)}
          </div>
          <label className="block text-xs">محور المحاذاة والتوزيع
            <select value={multiAxis} onChange={e=>setMultiAxis(e.target.value as "x"|"y")} className="min-h-11 w-full rounded border border-border bg-background px-2">
              <option value="x">أفقي X</option><option value="y">رأسي Y</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-1">
            {([{id:"min",label:"محاذاة للحد الأدنى"},{id:"center",label:"محاذاة للمنتصف"},{id:"max",label:"محاذاة للحد الأعلى"},{id:"distribute",label:"توزيع متساوٍ"}] as const).map(op=><button type="button" key={op.id} disabled={selectedNodes.length<(op.id==="distribute"?3:2)} className="min-h-11 rounded border border-border px-1 text-xs disabled:opacity-40" onClick={()=>changeMany(arrangePathNodes(path,selectedNodes,multiAxis,op.id))}>{op.label}</button>)}
          </div>
          <label className="block text-xs">خطوة الإزاحة
            <select value={step} onChange={e=>setStep(Number(e.target.value))} className="min-h-11 w-full rounded border border-border bg-background px-2">{[1,2,5,10,25,50].map(s=><option key={s} value={s}>{s} px</option>)}</select>
          </label>
          <div className="grid grid-cols-4 gap-1">
            {([{label:"يمين",x:1,y:0,icon:"→"},{label:"يسار",x:-1,y:0,icon:"←"},{label:"أعلى",x:0,y:-1,icon:"↑"},{label:"أسفل",x:0,y:1,icon:"↓"}]).map(d=><button key={d.label} type="button" aria-label={d.label} disabled={!selectedNodes.length} onClick={()=>changeMany(nudgePathNodes(path,selectedNodes,d.x*step,d.y*step))} className="min-h-11 rounded border border-border disabled:opacity-40">{d.icon}</button>)}
          </div>
          <p className="text-[11px] text-muted-foreground">تتحرك مقابض المنحنيات مع نقاطها. قد يؤدي تغيير مواضع عدة نقاط إلى تغيير هيئة المسار أو تقاطع حدوده؛ راجع التصميم بعد التطبيق.</p>
          <details className="rounded-lg border border-border p-2">
            <summary className="cursor-pointer py-1 text-xs font-semibold">تنعيم وتبسيط النقاط</summary>
            <div className="space-y-2 pt-2">
              <label className="block text-xs">شدة التنعيم <span dir="ltr">{strength}%</span>
                <input type="range" min={10} max={100} step={10} value={strength} onChange={e=>{setStrength(Number(e.target.value));setProposal(null);}} className="min-h-10 w-full"/>
              </label>
              <label className="block text-xs">حد الإزاحة / الانحراف لكل تمريرة <span dir="ltr">{tolerance.toFixed(2)} px</span>
                <input type="range" min={.25} max={5} step={.25} value={tolerance} onChange={e=>{setTolerance(Number(e.target.value));setProposal(null);}} className="min-h-10 w-full"/>
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button type="button" disabled={!selectedNodes.length} onClick={()=>{const result=smoothSelectedPathNodes(path,selectedNodes,strength/100,tolerance);setProposal({source:path,result,label:"تنعيم"});}} className="min-h-11 rounded border border-border text-xs disabled:opacity-40">اقتراح تنعيم</button>
                <button type="button" disabled={!selectedNodes.length} onClick={()=>{const result=simplifySelectedPathNodes(path,selectedNodes,tolerance);setProposal({source:path,result,label:"تبسيط"});}} className="min-h-11 rounded border border-border text-xs disabled:opacity-40">اقتراح تبسيط</button>
              </div>
              {proposal?.source===path&&<div className="space-y-2 rounded-lg border border-border p-2">
                <p className="text-xs">{proposal.label}: {proposal.result===path?"لا توجد نقاط مناسبة":`${path.points.length} ← ${proposal.result.points.length} نقطة`}</p>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" disabled={proposal.result===path} onClick={()=>{if(canvasControl?.objectId===objectId)setCanvasControl(null);changeMany(proposal.result);setMulti([]);setProposal(null);setNode(0);}} className="min-h-11 rounded bg-primary text-xs text-primary-foreground disabled:opacity-40">اعتماد التعديل</button>
                  <button type="button" onClick={()=>setProposal(null)} className="min-h-11 rounded border border-border text-xs">إلغاء</button>
                </div>
              </div>}
              <p className="text-[11px] text-muted-foreground">تُحمى نهايات المسارات المفتوحة والزوايا الحادة والمقاطع المنحنية الحالية. الحدود تخص تمريرة واحدة؛ لا تضمن منع التقاطع.</p>
            </div>
          </details>
          {multiNotice&&<p role="status" className="text-xs text-muted-foreground">{multiNotice}</p>}
        </div>
      </details>
      {end&&<details className="rounded-lg border border-border p-2">
        <summary className="cursor-pointer py-2 text-xs font-semibold">تحرير منحنى المقطع التالي</summary>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1">
            <button type="button" aria-pressed={!curve} onClick={()=>{if(canvasActive)setCanvasControl(null);onChange(setPathEdgeCurved(path,index,false));}} className={`min-h-11 rounded-lg border text-xs ${!curve?"border-primary bg-primary/10":"border-border"}`}>مستقيم</button>
            <button type="button" aria-pressed={!!curve} onClick={()=>onChange(setPathEdgeCurved(path,index,true))} className={`min-h-11 rounded-lg border text-xs ${curve?"border-primary bg-primary/10":"border-border"}`}>Bézier</button>
          </div>
          {edited&&<>
            <label className="block text-xs">ربط المقابض
              <select value={mode} onChange={e=>{const next=e.target.value as PathControlMode;setMode(next);if(canvasActive)setCanvasControl({objectId,edge:index,mode:next});}} className="min-h-11 w-full rounded-lg border border-border bg-background px-2">
                <option value="free">حر (زاوية مستقلة)</option><option value="aligned">محاذاة (اتجاه مشترك)</option><option value="symmetric">متماثل (اتجاه وطول)</option>
              </select>
            </label>
            <button type="button" aria-pressed={canvasActive} onClick={()=>setCanvasControl(canvasActive?null:{objectId,edge:index,mode})} className={`min-h-11 w-full rounded-lg border text-xs ${canvasActive?"border-primary bg-primary/10":"border-border"}`}>{canvasActive?"إخفاء مقابض اللوحة":"إظهار مقابض المقطع على اللوحة"}</button>
            <svg ref={svg} viewBox={viewBox} className="block h-40 w-full touch-none rounded-lg border border-border bg-background" role="img" aria-label="تحرير مقابض المقطع المحدد"
              onPointerMove={e=>{const d=drag.current;if(!d||!svg.current)return;const p=svg.current.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(d.inverse);d.point={x:q.x,y:q.y};setPreview({control:d.control,point:d.point});}}
              onPointerUp={()=>{const d=drag.current;drag.current=null;setPreview(null);if(d&&d.index===index&&!disabled)onChange(movePathControl(path,index,d.control,d.point,mode));}}
              onPointerCancel={()=>{drag.current=null;setPreview(null);}}
              onLostPointerCapture={()=>{drag.current=null;setPreview(null);}}>
              <path d={`M ${point.x} ${point.y} L ${edited.control1.x} ${edited.control1.y} M ${end.x} ${end.y} L ${edited.control2.x} ${edited.control2.y}`} stroke="currentColor" opacity=".45" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" fill="none"/>
              <path d={`M ${point.x} ${point.y} C ${edited.control1.x} ${edited.control1.y} ${edited.control2.x} ${edited.control2.y} ${end.x} ${end.y}`} stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none"/>
              {([point,end] as const).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={pad*.12} fill="currentColor"/>)}
              {(["control1","control2"] as const).map(control=><g key={control} className="cursor-grab" onPointerDown={e=>{if(disabled||!svg.current)return;const matrix=svg.current.getScreenCTM();if(!matrix)return;e.preventDefault();drag.current={control,index,point:edited[control],inverse:matrix.inverse()};svg.current.setPointerCapture(e.pointerId);}}>
                <circle cx={edited[control].x} cy={edited[control].y} r={pad*.4} fill="transparent"/>
                <circle cx={edited[control].x} cy={edited[control].y} r={pad*.16} fill="var(--color-background)" stroke="currentColor" vectorEffect="non-scaling-stroke"/>
              </g>)}
            </svg>
            {(["control1","control2"] as const).map((control,i)=><div key={control}><p className="text-xs">مقبض {i+1}</p><div className="grid grid-cols-2 gap-2">
              {(["x","y"] as const).map(axis=><label key={axis} className="text-xs">{axis.toUpperCase()}<input type="number" step=".5" className="min-h-10 w-full rounded border border-border bg-background p-1" value={Number(edited[control][axis].toFixed(3))} onChange={e=>{if(e.target.value.trim()&&Number.isFinite(Number(e.target.value)))onChange(movePathControl(path,index,control,{...edited[control],[axis]:Number(e.target.value)},mode));}}/></label>)}
            </div></div>)}
            <p className="text-[11px] text-muted-foreground">اسحب المقابض في المعاينة أو اضبط الإحداثيات. الربط يؤثر على المقبض المقابل إن وجد في المقطع المجاور. يُعتمد السحب عند رفع القلم.</p>
          </>}
        </div>
      </details>}
    </fieldset>
  );
}