import {useState} from "react";
import {useStudio} from "../../store/studioStore";
import {glyphGroupPivot,groupMoveIds,transformGlyphSelection,arrangeGlyphSelection,type GlyphArrangeAxis,type GlyphArrangeMode} from "../../calligraphy/groupSelection";
import {preciseGlyphBounds} from "../../calligraphy/morph";
import {LetteringGlyph} from "./LetteringGlyph";

export function GlyphGroupTransformControls(){
  const source=useStudio(s=>s.doc.lettering);
  const ids=useStudio(s=>s.glyphMultiIds);
  const apply=useStudio(s=>s.transformGlyphMulti);
  const applyArrangement=useStudio(s=>s.arrangeGlyphMulti);
  const guideEdit=useStudio(s=>s.guideLayer.edit);
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<"transform"|"arrange">("transform");
  const [axis,setAxis]=useState<GlyphArrangeAxis>("x");
  const [mode,setMode]=useState<GlyphArrangeMode>("distribute");
  const [scale,setScale]=useState(100);
  const [degrees,setDegrees]=useState(0);
  const [notice,setNotice]=useState("");
  if(!source||!ids.length)return null;
  const allowed=groupMoveIds(source,ids);
  const pivot=glyphGroupPivot(source,ids);
  const arrangement=open&&tab==="arrange"?arrangeGlyphSelection(source,ids,axis,mode):null;
  const next=open?(tab==="arrange"?(arrangement?.ok?arrangement.items:null):allowed.ok?transformGlyphSelection(source,ids,{scale:scale/100,degrees}):null):null;
  const visible=(next??source).filter(i=>!i.hidden&&((ids.includes(i.id)||i.kind==="haraka"&&!!i.attachedToGlyphId&&ids.includes(i.attachedToGlyphId))||i.kind==="bridge"&&i.ribbon&&ids.includes(i.ribbon.sourceGlyphId)&&ids.includes(i.ribbon.targetGlyphId)));
  const boxes=[...source,...(next??[])].filter(i=>ids.includes(i.id)).map(preciseGlyphBounds).filter((b):b is NonNullable<typeof b>=>!!b);
  const minX=Math.min(...boxes.map(b=>b.x)),minY=Math.min(...boxes.map(b=>b.y)),maxX=Math.max(...boxes.map(b=>b.x+b.width)),maxY=Math.max(...boxes.map(b=>b.y+b.height));
  const pad=Math.max(10,(maxX-minX)*.15,(maxY-minY)*.15,...visible.filter(i=>i.kind==="haraka").map(i=>i.size));
  const viewBox=[minX-pad,minY-pad,maxX-minX+2*pad,maxY-minY+2*pad].join(" ");
  return <div className="mt-1 border-t border-border pt-1">
    <button type="button" className="min-h-9 w-full rounded border border-border text-xs" aria-expanded={open} onClick={()=>{setOpen(!open);setNotice("");}}>تنسيق الحروف ({ids.length})</button>
    {open&&<div className="max-h-[35dvh] w-full max-w-[300px] space-y-1 overflow-y-auto pt-2">
      <div className="grid grid-cols-2 gap-1">{([{id:"transform",label:"التحويل"},{id:"arrange",label:"المحاذاة والتوزيع"}] as const).map(v=><button type="button" key={v.id} aria-pressed={tab===v.id} className={`min-h-10 rounded border text-xs ${tab===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setTab(v.id);setNotice("");}}>{v.label}</button>)}</div>
      {tab==="arrange"?<>
        <div className="grid grid-cols-2 gap-1">{([{id:"x",label:"أفقي"},{id:"y",label:"رأسي"}] as const).map(v=><button type="button" key={v.id} aria-pressed={axis===v.id} className={`min-h-10 rounded border text-xs ${axis===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setAxis(v.id);setNotice("");}}>{v.label}</button>)}</div>
        <div className="grid grid-cols-2 gap-1">{([{id:"min",label:axis==="x"?"يسار":"أعلى"},{id:"center",label:"منتصف"},{id:"max",label:axis==="x"?"يمين":"أسفل"},{id:"distribute",label:"مسافات متساوية"}] as const).map(v=><button type="button" key={v.id} aria-pressed={mode===v.id} disabled={ids.length<(v.id==="distribute"?3:2)} className={`min-h-10 rounded border text-xs disabled:opacity-40 ${mode===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setMode(v.id);setNotice("");}}>{v.label}</button>)}</div>
        {boxes.length>0&&<svg viewBox={viewBox} className="h-24 w-full rounded border border-border bg-background" aria-label="معاينة المحاذاة والتوزيع">
          {source.filter(i=>ids.includes(i.id)&&!i.hidden).map(i=>{const b=preciseGlyphBounds(i);return b?<rect key={i.id} x={b.x} y={b.y} width={b.width} height={b.height} fill="none" stroke="currentColor" strokeOpacity=".35" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"/>:null;})}
          {visible.map(i=><LetteringGlyph key={i.id} item={i} selected={false} allItems={next??source}/>)}
        </svg>}
        {arrangement?.ok? <p className="text-xs">{arrangement.gap!==null?`المسافة بين الحدود: ${arrangement.gap.toFixed(2)} px`:arrangement.changed?"معاينة المحاذاة جاهزة.":"الحروف محاذاة بالفعل."}</p>:arrangement&&<p className="text-xs text-muted-foreground">{{selection:"حدد حرفين للمحاذاة أو ثلاثة للتوزيع.",bridge:"الترتيب يغير وصلة حية؛ حافظ على اتجاهها ومسافتها.",overlap:"المساحة الحالية لا تكفي لتوزيع بلا تداخل.",invalid:"تعذر حساب حدود الحروف."}[arrangement.reason]}</p>}
        <div className="grid grid-cols-2 gap-1">
          <button type="button" disabled={!arrangement?.ok||!arrangement.changed||guideEdit} className="min-h-10 rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{if(applyArrangement(source,ids,axis,mode))setOpen(false);else setNotice("تعذر اعتماد الترتيب.");}}>اعتماد</button>
          <button type="button" className="min-h-10 rounded border border-border text-xs" onClick={()=>setOpen(false)}>إلغاء</button>
        </div>
        <p className="text-[10px] text-muted-foreground">يعتمد التوزيع على حدود الحروف دون التشكيلات؛ تبقى المساحة الكلية ثابتة.</p>
      </>:!allowed.ok?<p className="text-xs text-muted-foreground">حدد طرفي كل وصلة خطاطية معًا.</p>:<>
        <label className="block text-xs">الحجم <span dir="ltr">{scale}%</span><input type="range" min={25} max={200} step={5} value={scale} onChange={e=>{setScale(Number(e.target.value));setNotice("");}} className="w-full"/></label>
        <label className="block text-xs">الدوران <span dir="ltr">{degrees}°</span><input type="range" min={-180} max={180} step={5} value={degrees} onChange={e=>{setDegrees(Number(e.target.value));setNotice("");}} className="w-full"/></label>
        {pivot&&boxes.length>0&&<svg viewBox={viewBox} className="h-24 w-full rounded border border-border bg-background" aria-label="معاينة التحويل الجماعي">
          {visible.map(i=><LetteringGlyph key={i.id} item={i} selected={false} allItems={next??source}/>)}
          <circle cx={pivot.x} cy={pivot.y} r={Math.max(1,pad*.08)} fill="#ef4444"/>
        </svg>}
        {!next&&<p className="text-xs text-muted-foreground">تتجاوز النتيجة حدود الأحجام أو الوصلات المدعومة.</p>}
        <div className="grid grid-cols-2 gap-1">
          <button type="button" disabled={!next||guideEdit||(scale===100&&degrees===0)} className="min-h-10 rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{if(apply(source,ids,{scale:scale/100,degrees})){setScale(100);setDegrees(0);setOpen(false);}else setNotice("تغير التحديد أو تعذر تطبيق التحويل.");}}>اعتماد</button>
          <button type="button" className="min-h-10 rounded border border-border text-xs" onClick={()=>{setScale(100);setDegrees(0);setOpen(false);}}>إلغاء</button>
        </div>
        <p className="text-[10px] text-muted-foreground">المحور هو مركز حدود الحروف المحددة؛ التشكيلات تتبع الحروف.</p>
      </>}
      {notice&&<p role="status" className="text-xs">{notice}</p>}
    </div>}
  </div>;
}
