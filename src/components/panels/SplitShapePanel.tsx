import {useState} from "react";
import type {VectorObject} from "../../core/geometry/types";
import {geometryBounds} from "../../core/geometry/math";
import {geometryToPathData} from "../../objects/render";
import {splitShape,type SplitAxis,type SplitResult} from "../../objects/splitShape";
import {useStudio} from "../../store/studioStore";

export function SplitShapePanel({object}:{object:VectorObject}){
  const [axis,setAxis]=useState<SplitAxis>("x");
  const [percent,setPercent]=useState(50);
  const [preview,setPreview]=useState<{source:VectorObject;axis:SplitAxis;percent:number;result:SplitResult}|null>(null);
  const [notice,setNotice]=useState("");
  const apply=useStudio(s=>s.splitSelectedShape);
  const eligible=(object.geometry.kind==="circle"||(object.geometry.kind==="path"&&object.geometry.closed))&&!object.locked&&object.visible&&!object.guide&&object.cellKey===undefined;
  const current=preview?.source===object&&preview.axis===axis&&preview.percent===percent?preview.result:null;
  const b=geometryBounds(object.geometry),pad=Math.max(2,(b.maxX-b.minX)*.08,(b.maxY-b.minY)*.08);
  const viewBox=[b.minX-pad,b.minY-pad,b.maxX-b.minX+2*pad,b.maxY-b.minY+2*pad].join(" ");
  const cut=axis==="x"?b.minX+(b.maxX-b.minX)*percent/100:b.minY+(b.maxY-b.minY)*percent/100;
  const error={invalid:"الشكل أو موضع القص غير صالح.",empty:"القص لا ينتج مساحة على الجانبين.",complexity:"النتيجة معقدة؛ لم تتغير الأشكال.",selection:"حدد شكلًا واحدًا.",protected:"الشكل محمي."};
  if(!eligible)return null;
  return <details className="rounded-lg border border-border p-2">
    <summary className="cursor-pointer py-2 text-xs font-semibold">تقسيم الشكل</summary>
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">{([{id:"x",label:"قص رأسي"},{id:"y",label:"قص أفقي"}] as const).map(v=><button type="button" key={v.id} aria-pressed={axis===v.id} className={`min-h-11 rounded border text-xs ${axis===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setAxis(v.id);setPreview(null);setNotice("");}}>{v.label}</button>)}</div>
      <label className="block text-xs">موضع القص من الحد الأدنى <span dir="ltr">{percent}%</span><input className="min-h-11 w-full" type="range" min={5} max={95} step={1} value={percent} onChange={e=>{setPercent(Number(e.target.value));setPreview(null);setNotice("");}}/></label>
      <svg viewBox={viewBox} className="h-40 w-full rounded border border-border bg-background" aria-label="معاينة التقسيم">
        {current?.ok?current.parts.map((g,i)=><path key={i} d={geometryToPathData(g)} fill="currentColor" fillOpacity={i<current.firstCount?.35:.7} fillRule="evenodd" stroke="currentColor" vectorEffect="non-scaling-stroke"/>):<path d={geometryToPathData(object.geometry)} fill="currentColor" fillOpacity=".4" fillRule="evenodd"/>}
        <line x1={axis==="x"?cut:b.minX-pad} x2={axis==="x"?cut:b.maxX+pad} y1={axis==="y"?cut:b.minY-pad} y2={axis==="y"?cut:b.maxY+pad} stroke="currentColor" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
      </svg>
      <button type="button" className="min-h-11 w-full rounded border border-border text-xs" onClick={()=>{setNotice("");setPreview({source:object,axis,percent,result:splitShape(object.geometry,axis,percent/100)});}}>حساب الأجزاء</button>
      {current&&!current.ok&&<p className="text-xs">{error[current.reason]}</p>}
      {current?.ok&&<><p className="text-xs">{current.parts.length} جزء مستقل · {current.parts.reduce((sum,p)=>sum+(p.holes?.length??0),0)} فراغ مغلق</p><div className="grid grid-cols-2 gap-1">
        <button type="button" className="min-h-11 rounded bg-primary text-xs text-primary-foreground" onClick={()=>{const state=useStudio.getState();if(state.selection.length!==1||state.selection[0]!==object.id||state.doc.objects.find(o=>o.id===object.id)!==object){setPreview(null);setNotice("تغير الشكل؛ أعد المعاينة.");return;}const r=apply(axis,percent/100);setPreview(null);setNotice(r.ok?`تم إنشاء ${r.count} أجزاء.`:error[r.reason]);}}>اعتماد التقسيم</button>
        <button type="button" className="min-h-11 rounded border border-border text-xs" onClick={()=>setPreview(null)}>إلغاء</button>
      </div></>}
      {notice&&<p role="status" className="text-xs">{notice}</p>}
      <p className="text-[11px] text-muted-foreground">تتحول المنحنيات إلى حدود مضلعة تقريبية. تقسيم الفراغ عبر خط القص يحوله إلى فتحة على الحد. يمكن التراجع عن العملية كاملة.</p>
    </div>
  </details>;
}
