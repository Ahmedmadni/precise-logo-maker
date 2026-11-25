import {useState} from "react";
import type {PathGeometry} from "../../core/geometry/types";
import {geometryBounds} from "../../core/geometry/math";
import {geometryToPathData} from "../../objects/render";
import {replaceCompoundHole,translateCompoundHole,scaleCompoundHole,type RingEditResult} from "../../editor/compoundRings";

export function CompoundRingsPanel({path,disabled,onChange}:{path:PathGeometry;disabled:boolean;onChange:(next:PathGeometry)=>void}){
  const [hole,setHole]=useState(0);
  const [node,setNode]=useState(0);
  const [step,setStep]=useState(5);
  const [factor,setFactor]=useState(110);
  const [notice,setNotice]=useState("");
  const [proposal,setProposal]=useState<{source:PathGeometry;next:PathGeometry}|null>(null);
  const holes=path.holes??[];
  const index=Math.min(hole,holes.length-1);
  const ring=holes[index];
  const nodeIndex=Math.min(node,(ring?.length??0)-1);
  const point=ring?.[nodeIndex];
  const [dx,setDx]=useState("0");
  const [dy,setDy]=useState("0");
  const candidate=proposal?.source===path?proposal.next:null;
  const unsupported=!!path.cubicSegments?.some(Boolean)||path.points.length+holes.reduce((s,r)=>s+r.length,0)>1600;
  const propose=(result:RingEditResult)=>{
    setProposal(null);
    if(!result.ok){
      const messages={unsupported:"لا يدعم المحرر الحالي هذه البنية أو عدد نقاطها.",invalid:"الحلقة غير صالحة أو تتقاطع مع نفسها.",outside:"يجب أن يبقى الفراغ داخل الحد الخارجي دون ملامسته.",overlap:"لا يمكن تداخل الفراغات أو احتواء أحدها للآخر."};
      setNotice(messages[result.reason]);return;
    }
    setNotice("");setProposal({source:path,next:result.path});
  };
  const box=geometryBounds(path);
  const pad=Math.max(2,(box.maxX-box.minX)*.08,(box.maxY-box.minY)*.08);
  const viewBox=[box.minX-pad,box.minY-pad,box.maxX-box.minX+2*pad,box.maxY-box.minY+2*pad].join(" ");
  if(!ring||!point)return null;
  const shown=candidate?.holes?.[index]??ring;
  const size=Math.max(pad*.12,.3);
  const numeric=(s:string)=>s.trim()?Number(s):NaN;
  return <fieldset disabled={disabled||unsupported} className="space-y-2 rounded-lg border border-border p-2 disabled:opacity-60">
    <legend className="px-1 text-xs font-semibold">الفراغات الداخلية ({holes.length})</legend>
    {unsupported&&<p className="text-xs text-muted-foreground">التحرير المستقل متاح للحلقات الخطية حتى 1600 نقطة إجمالًا.</p>}
    <label className="block text-xs">الحلقة المحددة
      <select className="min-h-11 w-full rounded border border-border bg-background px-2" value={index} onChange={e=>{setHole(Number(e.target.value));setNode(0);setProposal(null);setNotice("");}}>
        {holes.map((r,i)=><option key={i} value={i}>فراغ {i+1} · {r.length} نقطة</option>)}
      </select>
    </label>
    <svg viewBox={viewBox} className="h-44 w-full rounded-lg border border-border bg-background" role="img" aria-label="معاينة الفراغ المحدد">
      <path d={geometryToPathData(candidate??path)} fill="currentColor" fillRule="evenodd" fillOpacity=".35"/>
      <path d={geometryToPathData({kind:"path",closed:true,points:shown})} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="3 2"/>
      {shown.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===nodeIndex?size*1.6:size} fill={i===nodeIndex?"var(--color-primary)":"currentColor"}/>)}
    </svg>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs">خطوة التحريك<select className="min-h-10 w-full rounded border border-border bg-background" value={step} onChange={e=>setStep(Number(e.target.value))}>{[1,2,5,10,25].map(v=><option key={v} value={v}>{v} px</option>)}</select></label>
      <label className="block text-xs">تغيير الحجم<select className="min-h-10 w-full rounded border border-border bg-background" value={factor} onChange={e=>setFactor(Number(e.target.value))}>{[50,75,90,95,105,110,125,150,200].map(v=><option key={v} value={v}>{v}%</option>)}</select></label>
    </div>
    <div className="grid grid-cols-4 gap-1">
      {[{label:"يمين",arrow:"→",x:1,y:0},{label:"يسار",arrow:"←",x:-1,y:0},{label:"أعلى",arrow:"↑",x:0,y:-1},{label:"أسفل",arrow:"↓",x:0,y:1}].map(d=><button type="button" key={d.label} aria-label={d.label} className="min-h-11 rounded border border-border" onClick={()=>propose(translateCompoundHole(path,index,d.x*step,d.y*step))}>{d.arrow}</button>)}
    </div>
    <button type="button" className="min-h-11 w-full rounded border border-border text-xs" onClick={()=>propose(scaleCompoundHole(path,index,factor/100))}>اقتراح تغيير حجم الفراغ</button>
    <details className="rounded border border-border p-2">
      <summary className="cursor-pointer text-xs font-semibold">تعديل نقطة من الحلقة</summary>
      <label className="block pt-2 text-xs">النقطة<select className="min-h-10 w-full rounded border border-border bg-background" value={nodeIndex} onChange={e=>{setNode(Number(e.target.value));setProposal(null);}}>
        {ring.map((_,i)=><option key={i} value={i}>{i+1}</option>)}
      </select></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">إزاحة X<input className="min-h-10 w-full rounded border border-border bg-background px-1" type="number" value={dx} onChange={e=>setDx(e.target.value)}/></label>
        <label className="text-xs">إزاحة Y<input className="min-h-10 w-full rounded border border-border bg-background px-1" type="number" value={dy} onChange={e=>setDy(e.target.value)}/></label>
      </div>
      <button type="button" className="mt-2 min-h-11 w-full rounded border border-border text-xs" onClick={()=>propose(replaceCompoundHole(path,index,ring.map((p,i)=>i===nodeIndex?{x:p.x+numeric(dx),y:p.y+numeric(dy)}:p)))}>معاينة إزاحة النقطة</button>
    </details>
    {candidate&&<div className="grid grid-cols-2 gap-1">
      <button type="button" className="min-h-11 rounded bg-primary text-xs text-primary-foreground" onClick={()=>{onChange(candidate);setProposal(null);setNotice("تم تعديل الفراغ المحدد.");}}>اعتماد</button>
      <button type="button" className="min-h-11 rounded border border-border text-xs" onClick={()=>setProposal(null)}>إلغاء</button>
    </div>}
    {notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    <p className="text-[11px] text-muted-foreground">المعاينة لا تغير التصميم حتى الاعتماد. التعديلات تخص الحلقة المحددة فقط.</p>
  </fieldset>;
}
