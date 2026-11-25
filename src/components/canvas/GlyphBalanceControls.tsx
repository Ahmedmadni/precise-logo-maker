import {useState} from "react";
import {useStudio,type DocumentState} from "../../store/studioStore";
import {analyzeInkBalance,type InkBalance} from "../../calligraphy/bakeUnion";
import {groupMoveIds,translateGlyphSelection} from "../../calligraphy/groupSelection";
import {decorationBounds} from "../../calligraphy/decorationPlacement";
import {LetteringGlyph} from "./LetteringGlyph";

export function GlyphBalanceControls(){
  const doc=useStudio(s=>s.doc);
  const ids=useStudio(s=>s.glyphMultiIds);
  const guideEdit=useStudio(s=>s.guideLayer.edit);
  const [report,setReport]=useState<{doc:DocumentState;key:string;result:InkBalance}|null>(null);
  const [optical,setOptical]=useState(true);
  const [notice,setNotice]=useState("");
  const source=doc.lettering??[];
  const key=JSON.stringify(ids);
  const current=report?.doc===doc&&report.key===key?report.result:null;
  const b=current?.ok?current.bounds:null;
  const w=doc.artboard.width,h=doc.artboard.height;
  const center=b?{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2}:null;
  const anchor=current?.ok?(optical?current.centroid:center):null;
  const dx=anchor?w/2-anchor.x:0,dy=anchor?h/2-anchor.y:0;
  const allowed=current?.ok?groupMoveIds(source,ids):null;
  const next=allowed?.ok?translateGlyphSelection(source,ids,dx,dy):null;
  const moved=(next??[]).filter(i=>!i.hidden&&(allowed?.ok&&allowed.ids.has(i.id)||i.kind==="bridge"&&i.ribbon&&ids.includes(i.ribbon.sourceGlyphId)&&ids.includes(i.ribbon.targetGlyphId)));
  const fits=!!next&&moved.every(i=>{const box=decorationBounds(i,next);return !!box&&box.minX>=0&&box.minY>=0&&box.maxX<=w&&box.maxY<=h;});
  const show=(items:typeof source,label:string,offsetX:number,offsetY:number)=><div><p className="text-xs">{label}</p><svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full rounded border border-border bg-background" aria-label={label}>
    <path d={`M ${w/2} 0 V ${h} M 0 ${h/2} H ${w}`} stroke="currentColor" strokeOpacity=".35" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
    {items.filter(i=>!i.hidden&&ids.includes(i.id)).map(i=><LetteringGlyph key={i.id} item={i} selected={false} allItems={items}/>)}
    {current?.ok&&<circle cx={current.centroid.x+offsetX} cy={current.centroid.y+offsetY} r={Math.max(w,h)*.009} fill="#ef4444"/>}
  </svg></div>;
  return <details className="mt-1 rounded border border-border p-2">
    <summary className="cursor-pointer py-1 text-xs font-semibold">التوازن البصري</summary>
    <div className="max-h-[35dvh] space-y-2 overflow-y-auto">
      <button type="button" disabled={!ids.length||ids.length>20} className="min-h-10 w-full rounded border border-border text-xs disabled:opacity-40" onClick={()=>{setReport({doc,key,result:analyzeInkBalance(source,ids)});setNotice("");}}>تحليل كثافة الحبر</button>
      {current?.ok&&<>
        <p className="text-xs">مساحة الحبر: {current.area.toFixed(1)} px² · الكثافة: {(current.density*100).toFixed(1)}%</p>
        <div dir="ltr" className="grid grid-cols-2 gap-1">{current.quadrants.map((q,i)=><div key={i} className="relative flex h-10 items-center justify-center overflow-hidden rounded border border-border text-xs"><div className="absolute inset-0 bg-primary" style={{opacity:Math.min(.7,q)}}/><span className="relative">{(q*100).toFixed(1)}%</span></div>)}</div>
        <p className="text-[10px] text-muted-foreground">الأرباع بالنسبة إلى مركز حدود الحبر. النسب ليست معيارًا لجمال الخط.</p>
        <div className="grid grid-cols-2 gap-1">{[{value:true,label:"مركز الحبر"},{value:false,label:"مركز الحدود"}].map(v=><button key={v.label} type="button" aria-pressed={optical===v.value} className={`min-h-10 rounded border text-xs ${optical===v.value?"border-primary bg-primary/10":"border-border"}`} onClick={()=>setOptical(v.value)}>{v.label}</button>)}</div>
        <div className="grid grid-cols-2 gap-1">{show(source,"قبل",0,0)}{show(next??source,"بعد",next?dx:0,next?dy:0)}</div>
        <button type="button" disabled={!fits||guideEdit||Math.hypot(dx,dy)<.01} className="min-h-10 w-full rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{const s=useStudio.getState();if(s.doc===doc&&s.doc.lettering&&fits&&s.moveGlyphMulti(s.doc.lettering,ids,dx,dy)){setReport(null);setNotice("تم التمركز.");}else setNotice("تعذر التطبيق؛ أعد التحليل.");}}>توسيط المجموعة على اللوحة</button>
        {!fits&&<p className="text-xs text-muted-foreground">لا يمكن اعتماد التمركز: وصلة خارج المجموعة أو تجاوز حدود اللوحة أو لا يلزم التحريك.</p>}
        <p className="text-[10px] text-muted-foreground">التحليل للحروف المحددة فقط دون التشكيلات والوصلات والسماكات الإضافية. التوسيط يحافظ على التكوين، ولا يفحص تصادمه مع العناصر غير المحددة.</p>
      </>}
      {current&&!current.ok&&<p className="text-xs text-muted-foreground">{{selection:"حدد حتى 20 حرفًا.",unsupported:"مسارات أو سماكات غير مدعومة.",complexity:"التكوين معقد؛ قلل عدد الحروف."}[current.reason]}</p>}
      {notice&&<p role="status" className="text-xs">{notice}</p>}
    </div>
  </details>;
}
