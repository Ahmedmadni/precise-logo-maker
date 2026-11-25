import {useState,useMemo} from "react";
import {useStudio} from "../../store/studioStore";
import {composeGlyphTiers,type TierStyle} from "../../calligraphy/tieredComposition";
import {decorationBounds} from "../../calligraphy/decorationPlacement";
import {LetteringGlyph} from "./LetteringGlyph";

const styles:{id:TierStyle;label:string}[]=[{id:"balanced",label:"صفوف متوازنة"},{id:"pyramid",label:"هرمي"},{id:"cascade",label:"متدرج"}];
export function GlyphTierControls(){
  const doc=useStudio(s=>s.doc),source=doc.lettering;
  const ids=useStudio(s=>s.glyphMultiIds);
  const guideEdit=useStudio(s=>s.guideLayer.edit);
  const apply=useStudio(s=>s.composeGlyphMultiTiers);
  const [open,setOpen]=useState(false);
  const [rows,setRows]=useState(2);
  const [style,setStyle]=useState<TierStyle>("balanced");
  const [horizontalGap,setHorizontalGap]=useState(12);
  const [verticalGap,setVerticalGap]=useState(8);
  const [stagger,setStagger]=useState(25);
  const [notice,setNotice]=useState("");
  const options=useMemo(()=>({rows,style,horizontalGap,verticalGap,stagger}),[rows,style,horizontalGap,verticalGap,stagger]);
  const result=useMemo(()=>open&&source?composeGlyphTiers(source,ids,options):null,[open,source,ids,options]);
  const selected=new Set(ids);
  const belongs=(i:NonNullable<typeof source>[number])=>!i.hidden&&(selected.has(i.id)||i.kind==="haraka"&&!!i.attachedToGlyphId&&selected.has(i.attachedToGlyphId)||i.kind==="bridge"&&!!i.ribbon&&selected.has(i.ribbon.sourceGlyphId)&&selected.has(i.ribbon.targetGlyphId));
  const preview=result?.ok?result.items.filter(belongs):[];
  const bounds=result?.ok?preview.map(i=>decorationBounds(i,result.items)):[];
  const fits=result?.ok&&bounds.every(b=>!!b&&b.minX>=0&&b.minY>=0&&b.maxX<=doc.artboard.width&&b.maxY<=doc.artboard.height);
  return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)} className="mt-1 rounded border border-border p-2">
    <summary className="cursor-pointer py-1 text-xs font-semibold">التكوين متعدد المستويات</summary>
    {open&&<div className="max-h-[35dvh] space-y-2 overflow-y-auto">
      <div className="grid grid-cols-3 gap-1">{styles.map(v=><button key={v.id} type="button" aria-pressed={style===v.id} className={`min-h-10 rounded border text-xs ${style===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setStyle(v.id);setNotice("");}}>{v.label}</button>)}</div>
      <label className="block text-xs">عدد المستويات<select className="min-h-10 w-full rounded border border-border bg-background" value={rows} onChange={e=>setRows(Number(e.target.value))}>{[2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
      <label className="block text-xs">الفاصل الأفقي: {horizontalGap} px<input type="range" min={0} max={100} value={horizontalGap} className="w-full" onChange={e=>setHorizontalGap(Number(e.target.value))}/></label>
      <label className="block text-xs">الفاصل الرأسي: {verticalGap} px<input type="range" min={-50} max={100} value={verticalGap} className="w-full" onChange={e=>setVerticalGap(Number(e.target.value))}/></label>
      {style==="cascade"&&<label className="block text-xs">إزاحة المستوى: {stagger} px<input type="range" min={-100} max={100} value={stagger} className="w-full" onChange={e=>setStagger(Number(e.target.value))}/></label>}
      {result?.ok&&<>
        <svg viewBox={`0 0 ${doc.artboard.width} ${doc.artboard.height}`} className="h-36 w-full rounded border border-border bg-background" aria-label="معاينة التكوين متعدد المستويات">
          <path d={`M ${doc.artboard.width/2} 0 V ${doc.artboard.height}`} stroke="currentColor" strokeOpacity=".3" strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
          {preview.map(i=><LetteringGlyph key={i.id} item={i} selected={false} allItems={result.items}/>)}
        </svg>
        <p className="text-xs">{result.blocks} وحدات خطاطية · {result.rows} مستويات</p>
        {!fits&&<p className="text-xs text-muted-foreground">تتجاوز بعض العناصر حدود اللوحة؛ قلل الفواصل أو حرّك المجموعة أولًا.</p>}
        <button type="button" disabled={!source||!result.changed||!fits||guideEdit} className="min-h-11 w-full rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{if(source&&apply(source,ids,options)){setNotice("تم اعتماد التكوين.");setOpen(false);}else setNotice("تغير التحديد؛ أعد المعاينة.");}}>اعتماد التكوين</button>
      </>}
      {result&&!result.ok&&<p className="text-xs text-muted-foreground">{{selection:"حدد وحدات كاملة بعدد يكفي للمستويات المختارة (حتى 24 وحدة).","partial-word":"حدد جميع حروف الكلمة قبل توزيعها.",bridge:"الترتيب يشوه وصلة بين وحدتين؛ حافظ على الوصلة أو عدلها أولًا.",invalid:"المسارات أو الإعدادات غير صالحة.",overlap:"التراكب الرأسي كبير جدًا."}[result.reason]}</p>}
      {notice&&<p role="status" className="text-xs">{notice}</p>}
      <p className="text-[10px] text-muted-foreground">ترتيب مكاني من اليمين إلى اليسار يحافظ على الكلمة كوحدة واحدة. التراكب السالب مقصود، ولا يتم التحقق من اصطدام الحبر أو العناصر غير المحددة.</p>
    </div>}
  </details>;
}
