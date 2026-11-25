import {useState} from "react";
import type {VectorObject} from "../../core/geometry/types";
import {geometryBounds} from "../../core/geometry/math";
import {geometryToPathData} from "../../objects/render";
import {splitShapeAtAngle,angledCutGuide,splitShapeCurved,curvedCutGuide,type SplitAxis,type SplitResult} from "../../objects/splitShape";
import {useStudio} from "../../store/studioStore";

export function SplitShapePanel({object}:{object:VectorObject}){
  const [axis,setAxis]=useState<SplitAxis|"angle"|"curve">("x");
  const [percent,setPercent]=useState(50);
  const [angle,setAngle]=useState(45);
  const [bend,setBend]=useState(65);
  const degrees=axis==="x"?0:axis==="y"?90:angle;
  const [preview,setPreview]=useState<{source:VectorObject;axis:SplitAxis|"angle"|"curve";percent:number;degrees:number;bend:number;result:SplitResult}|null>(null);
  const [notice,setNotice]=useState("");
  const apply=useStudio(s=>s.splitSelectedShape);
  const knife=useStudio(s=>s.knifeTargetId);
  const setKnife=useStudio(s=>s.setKnifeTargetId);
  const eligible=(object.geometry.kind==="circle"||(object.geometry.kind==="path"&&object.geometry.closed))&&!object.locked&&object.visible&&!object.guide&&object.cellKey===undefined;
  const current=preview?.source===object&&preview.axis===axis&&preview.percent===percent&&preview.degrees===degrees&&preview.bend===bend?preview.result:null;
  const b=geometryBounds(object.geometry),pad=Math.max(2,(b.maxX-b.minX)*.08,(b.maxY-b.minY)*.08);
  const viewBox=[b.minX-pad,b.minY-pad,b.maxX-b.minX+2*pad,b.maxY-b.minY+2*pad].join(" ");
  const guide=angledCutGuide(object.geometry,degrees,percent/100);
  const curved=axis==="curve"?curvedCutGuide(object.geometry,degrees,percent/100,bend/100):null;
  const error={invalid:"الشكل أو موضع القص غير صالح.",empty:"القص لا ينتج مساحة على الجانبين.",complexity:"النتيجة معقدة؛ لم تتغير الأشكال.",selection:"حدد شكلًا واحدًا.",protected:"الشكل محمي."};
  if(!eligible)return null;
  return <details className="rounded-lg border border-border p-2">
    <summary className="cursor-pointer py-2 text-xs font-semibold">تقسيم الشكل</summary>
    <div className="space-y-2">
      <button type="button" aria-pressed={knife===object.id} onClick={()=>{setPreview(null);setKnife(knife===object.id?null:object.id);}} className="min-h-11 w-full rounded-lg border border-primary text-xs font-semibold">{knife===object.id?"إلغاء أداة السكين":"أداة السكين — ارسم خط القص على اللوحة"}</button>
      {knife===object.id&&<p className="text-xs text-muted-foreground">أغلق لوحة الخصائص على الهاتف، ثم اسحب خطًا عبر الشكل المحدد.</p>}
      <div className="grid grid-cols-2 gap-1">{([{id:"x",label:"رأسي"},{id:"y",label:"أفقي"},{id:"angle",label:"مائل"},{id:"curve",label:"منحني"}] as const).map(v=><button type="button" key={v.id} aria-pressed={axis===v.id} className={`min-h-11 rounded border text-xs ${axis===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setAxis(v.id);setPreview(null);setNotice("");}}>{v.label}</button>)}</div>
      {(axis==="angle"||axis==="curve")&&<label className="block text-xs">زاوية القص من الرأسي <span dir="ltr">{angle}°</span><input type="range" min={-90} max={90} step={1} value={angle} className="min-h-11 w-full" onChange={e=>{setAngle(Number(e.target.value));setPreview(null);setNotice("");}}/></label>}
      {axis==="curve"&&<label className="block text-xs">اتجاه وشدة الانحناء <span dir="ltr">{bend}%</span><input type="range" min={-100} max={100} step={5} value={bend} className="min-h-11 w-full" onChange={e=>{setBend(Number(e.target.value));setPreview(null);setNotice("");}}/></label>}
      <label className="block text-xs">موضع القص من الحد الأدنى <span dir="ltr">{percent}%</span><input className="min-h-11 w-full" type="range" min={5} max={95} step={1} value={percent} onChange={e=>{setPercent(Number(e.target.value));setPreview(null);setNotice("");}}/></label>
      <svg viewBox={viewBox} className="h-40 w-full rounded border border-border bg-background" aria-label="معاينة التقسيم">
        {current?.ok?current.parts.map((g,i)=><path key={i} d={geometryToPathData(g)} fill="currentColor" fillOpacity={i<current.firstCount ? .35 : .7} fillRule="evenodd" stroke="currentColor" vectorEffect="non-scaling-stroke"/>):<path d={geometryToPathData(object.geometry)} fill="currentColor" fillOpacity=".4" fillRule="evenodd"/>}
        {axis!=="curve"&&guide&&<line x1={guide.start.x} y1={guide.start.y} x2={guide.end.x} y2={guide.end.y} stroke="currentColor" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>}
        {curved&&<polyline points={curved.curve.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="currentColor" strokeDasharray="4 3" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>}
      </svg>
      <button type="button" className="min-h-11 w-full rounded border border-border text-xs" onClick={()=>{setNotice("");setPreview({source:object,axis,percent,degrees,bend,result:axis==="curve"?splitShapeCurved(object.geometry,degrees,percent/100,bend/100):splitShapeAtAngle(object.geometry,degrees,percent/100)});}}>حساب الأجزاء</button>
      {current&&!current.ok&&<p className="text-xs">{error[current.reason]}</p>}
      {current?.ok&&<><p className="text-xs">{current.parts.length} جزء مستقل · {current.parts.reduce((sum,p)=>sum+(p.holes?.length??0),0)} فراغ مغلق</p><div className="grid grid-cols-2 gap-1">
        <button type="button" className="min-h-11 rounded bg-primary text-xs text-primary-foreground" onClick={()=>{const state=useStudio.getState();if(state.selection.length!==1||state.selection[0]!==object.id||state.doc.objects.find(o=>o.id===object.id)!==object){setPreview(null);setNotice("تغير الشكل؛ أعد المعاينة.");return;}const r=apply(axis,percent/100,degrees,bend/100);setPreview(null);setNotice(r.ok?`تم إنشاء ${r.count} أجزاء.`:error[r.reason]);}}>اعتماد التقسيم</button>
        <button type="button" className="min-h-11 rounded border border-border text-xs" onClick={()=>setPreview(null)}>إلغاء</button>
      </div></>}
      {notice&&<p role="status" className="text-xs">{notice}</p>}
      <p className="text-[11px] text-muted-foreground">تتحول المنحنيات إلى حدود مضلعة تقريبية. تقسيم الفراغ عبر خط القص يحوله إلى فتحة على الحد. يمكن التراجع عن العملية كاملة.</p>
    </div>
  </details>;
}
