import {useState} from "react";
import type {PathGeometry} from "../../core/geometry/types";
import {geometryBounds} from "../../core/geometry/math";
import {geometryToPathData} from "../../objects/render";
import {cutOpenPath} from "../../editor/scissors";
import {useStudio} from "../../store/studioStore";

export function ScissorsPanel({objectId,path,disabled}:{objectId:string;path:PathGeometry;disabled:boolean}){
  const object=useStudio(s=>s.doc.objects.find(o=>o.id===objectId));
  const apply=useStudio(s=>s.cutSelectedOpenPath);
  const [edge,setEdge]=useState(0);
  const [percent,setPercent]=useState(50);
  const [proposal,setProposal]=useState<{source:PathGeometry;edge:number;percent:number;parts:[PathGeometry,PathGeometry]}|null>(null);
  const [notice,setNotice]=useState("");
  const index=Math.min(edge,path.points.length-2);
  const current=proposal?.source===path&&proposal.edge===index&&proposal.percent===percent?proposal:null;
  const bounds=geometryBounds(path);
  const pad=Math.max(4,(bounds.maxX-bounds.minX)*.08,(bounds.maxY-bounds.minY)*.08);
  const viewBox=[bounds.minX-pad,bounds.minY-pad,bounds.maxX-bounds.minX+pad*2,bounds.maxY-bounds.minY+pad*2].join(" ");
  if(path.closed||path.holes?.length||path.points.length<2||!object)return null;
  const filled=object.style.fill!=="none";
  const blocked=disabled||filled||object.locked||!object.visible||!!object.guide||object.cellKey!==undefined;
  const cut=current?.parts[0].points.at(-1);
  const segment:PathGeometry={kind:"path",closed:false,points:[path.points[index]!,path.points[index+1]!],...(path.cubicSegments?.[index]?{cubicSegments:[path.cubicSegments[index]!,null]}:{})};
  return <details className="rounded-lg border border-border p-2">
    <summary className="cursor-pointer py-1 text-xs font-semibold">أداة المقص — تقسيم المسار المفتوح</summary>
    <fieldset disabled={blocked} className="space-y-2 pt-2 disabled:opacity-50">
      <label className="block text-xs">المقطع
        <select value={index} className="min-h-11 w-full rounded border border-border bg-background px-2" onChange={e=>{setEdge(Number(e.target.value));setProposal(null);setNotice("");}}>
          {path.points.slice(1).map((_,i)=><option key={i} value={i}>{i+1} → {i+2}</option>)}
        </select>
      </label>
      <label className="block text-xs">معامل موضع القطع <span dir="ltr">{percent}%</span>
        <input type="range" min={0} max={100} step={1} value={percent} onChange={e=>{setPercent(Number(e.target.value));setProposal(null);setNotice("");}} className="min-h-10 w-full"/>
      </label>
      <svg viewBox={viewBox} className="h-40 w-full rounded border border-border bg-background" role="img" aria-label="معاينة قطع المسار">
        {current?current.parts.map((g,i)=><path key={i} d={geometryToPathData(g)} fill="none" stroke={i===0?"#0ea5e9":"#f59e0b"} strokeWidth="2" vectorEffect="non-scaling-stroke"/>):<>
          <path d={geometryToPathData(path)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".45" vectorEffect="non-scaling-stroke"/>
          <path d={geometryToPathData(segment)} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
        </>}
        {cut&&<circle cx={cut.x} cy={cut.y} r={pad*.18} fill="#ef4444"/>}
      </svg>
      <button type="button" className="min-h-11 w-full rounded border border-border text-xs" onClick={()=>{const parts=cutOpenPath(path,index,percent/100);setProposal(parts?{source:path,edge:index,percent,parts}:null);setNotice(parts?"":"اختر نقطة داخل المسار، وليست أحد طرفيه النهائيين.");}}>معاينة القطع</button>
      {current&&<div className="grid grid-cols-2 gap-1">
        <button type="button" className="min-h-11 rounded bg-primary text-xs text-primary-foreground" onClick={()=>{const state=useStudio.getState();if(state.selection.length!==1||state.selection[0]!==objectId||state.doc.objects.find(o=>o.id===objectId)?.geometry!==path){setProposal(null);setNotice("تغير المسار؛ أعد المعاينة.");return;}const result=apply(index,percent/100);setProposal(null);setNotice(result.ok?"تم تقسيم المسار إلى جزأين.":"تعذر اعتماد القطع.");}}>اعتماد القطع</button>
        <button type="button" className="min-h-11 rounded border border-border text-xs" onClick={()=>setProposal(null)}>إلغاء</button>
      </div>}
      {notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    </fieldset>
    {filled&&<p className="text-[11px] text-muted-foreground">ألغِ تعبئة المسار أولًا. قطع مسار مفتوح ذي تعبئة يغير مساحته.</p>}
    <p className="pt-1 text-[11px] text-muted-foreground">يحافظ التقسيم على المنحنى الأصلي رياضيًا. النسبة هي معامل المنحنى وليست نسبة طوله الفعلي.</p>
  </details>;
}
