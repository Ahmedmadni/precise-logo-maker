import {useState} from "react";
import type {VectorObject,Point} from "../../core/geometry/types";
import {asOpenPath,eligibleJoinObject,joinOpenPaths,nearestPathEnds,type PathEnd,type JoinMode} from "../../editor/joinPaths";
import {geometryBounds,unionBounds} from "../../core/geometry/math";
import {geometryToPathData} from "../../objects/render";
import {useStudio} from "../../store/studioStore";

export function JoinPathsPanel({a,b}:{a:VectorObject;b:VectorObject}){
  const first=asOpenPath(a.geometry),second=asOpenPath(b.geometry);
  const [ends,setEnds]=useState(()=>first&&second?nearestPathEnds(first,second):{a:"end" as PathEnd,b:"start" as PathEnd});
  const [mode,setMode]=useState<JoinMode>("line");
  const [notice,setNotice]=useState("");
  const apply=useStudio(s=>s.joinSelectedPaths);
  if(!first||!second||!eligibleJoinObject(a)||!eligibleJoinObject(b))return null;
  const result=joinOpenPaths(a.geometry,b.geometry,ends.a,ends.b,mode);
  const bounds=unionBounds([geometryBounds(first),geometryBounds(second),...(result?[geometryBounds(result)]:[])]);
  const pad=Math.max(4,(bounds.maxX-bounds.minX)*.08,(bounds.maxY-bounds.minY)*.08);
  const viewBox=[bounds.minX-pad,bounds.minY-pad,bounds.maxX-bounds.minX+2*pad,bounds.maxY-bounds.minY+2*pad].join(" ");
  const endpoint=(p:Point[],end:PathEnd)=>p[end==="start"?0:p.length-1]!;
  const pa=endpoint(first.points,ends.a),pb=endpoint(second.points,ends.b);
  const gap=Math.hypot(pa.x-pb.x,pa.y-pb.y);
  return <details className="rounded-lg border border-border p-2">
    <summary className="cursor-pointer py-2 text-xs font-semibold">ربط المسارات المفتوحة</summary>
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(["a","b"] as const).map(id=><label key={id} className="min-w-0 text-xs"><span className="block truncate">{id==="a"?a.name:b.name}</span><select className="min-h-11 w-full rounded border border-border bg-background" value={ends[id]} onChange={e=>{setEnds(old=>({...old,[id]:e.target.value as PathEnd}));setNotice("");}}><option value="start">البداية</option><option value="end">النهاية</option></select></label>)}
      </div>
      <button type="button" className="min-h-11 w-full rounded border border-border text-xs" onClick={()=>{setEnds(nearestPathEnds(first,second));setNotice("");}}>اختيار أقرب طرفين</button>
      <div className="grid grid-cols-2 gap-1">{([{id:"line",label:"وصلة مستقيمة"},{id:"smooth",label:"وصلة منحنية"}] as const).map(v=><button key={v.id} type="button" aria-pressed={mode===v.id} onClick={()=>{setMode(v.id);setNotice("");}} className={`min-h-11 rounded border text-xs ${mode===v.id?"border-primary bg-primary/10":"border-border"}`}>{v.label}</button>)}</div>
      <svg viewBox={viewBox} className="h-40 w-full rounded border border-border bg-background" aria-label="معاينة وصل المسارات">
        {result&&<path d={geometryToPathData(result)} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>}
        <path d={geometryToPathData(first)} fill="none" stroke="#0ea5e9" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        <path d={geometryToPathData(second)} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        <circle cx={pa.x} cy={pa.y} r={pad*.16} fill="#0ea5e9"/><circle cx={pb.x} cy={pb.y} r={pad*.16} fill="#f59e0b"/>
      </svg>
      <p className="text-xs">المسافة بين الطرفين: <span dir="ltr">{gap.toFixed(2)} px</span></p>
      <p className="text-[11px] text-muted-foreground">النتيجة تستخدم لون وسمك وطبقة المسار الأول. الوصلة المنحنية تتبع اتجاه الطرفين وقد تحتاج ضبطًا عند الالتفاف الحاد.</p>
      <button type="button" disabled={!result} className="min-h-11 w-full rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{const state=useStudio.getState();if(state.doc.objects.find(o=>o.id===a.id)!==a||state.doc.objects.find(o=>o.id===b.id)!==b){setNotice("تغيرت المسارات؛ راجع المعاينة.");return;}const r=apply(a.id,b.id,ends.a,ends.b,mode);setNotice(r.ok?"تم الربط.":"تعذر الربط.");}}>اعتماد الربط</button>
      {notice&&<p role="status" className="text-xs">{notice}</p>}
    </div>
  </details>;
}
