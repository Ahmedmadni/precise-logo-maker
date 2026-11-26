import {useState,useMemo,useEffect} from "react";
import {useStudio} from "../../store/studioStore";
import {composeGlyphTiers,tierSelectionFits,type TierStyle} from "../../calligraphy/tieredComposition";
import {LetteringGlyph} from "./LetteringGlyph";
import {BUILTIN_TIER_PRESETS,decodeTierPresets,saveTierPreset,TIER_PRESET_KEY,type TierPreset} from "../../calligraphy/tierPresets";

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
  const [presets,setPresets]=useState<TierPreset[]>([]);
  const [name,setName]=useState("");
  useEffect(()=>{try{setPresets(decodeTierPresets(localStorage.getItem(TIER_PRESET_KEY)??"[]"));}catch{setNotice("تعذر قراءة القوالب المحلية.");}},[]);
  const persist=(next:TierPreset[])=>{
    try{localStorage.setItem(TIER_PRESET_KEY,JSON.stringify(next));setPresets(next);return true;}
    catch{setNotice("تعذر حفظ القوالب محليًا.");return false;}
  };
  const load=(p:TierPreset)=>{
    setRows(p.options.rows);setStyle(p.options.style);setHorizontalGap(p.options.horizontalGap);setVerticalGap(p.options.verticalGap);setStagger(p.options.stagger);setNotice("تم تحميل إعدادات القالب للمعاينة.");
  };
  const save=()=>{
    const existing=presets.find(p=>p.name===name.trim());
    if(existing){setNotice("الاسم مستخدم؛ اختر اسمًا مختلفًا أو حدّث القالب.");return;}
    const next=saveTierPreset(presets,crypto.randomUUID(),name,options);
    if(!next){setNotice("تحقق من الاسم أو حد المكتبة (30 قالبًا).");return;}
    if(persist(next)){setName("");setNotice("تم حفظ القالب محليًا.");}
  };
  const options=useMemo(()=>({rows,style,horizontalGap,verticalGap,stagger}),[rows,style,horizontalGap,verticalGap,stagger]);
  const result=useMemo(()=>open&&source?composeGlyphTiers(source,ids,options):null,[open,source,ids,options]);
  const selected=new Set(ids);
  const belongs=(i:NonNullable<typeof source>[number])=>!i.hidden&&(selected.has(i.id)||i.kind==="haraka"&&!!i.attachedToGlyphId&&selected.has(i.attachedToGlyphId)||i.kind==="bridge"&&!!i.ribbon&&selected.has(i.ribbon.sourceGlyphId)&&selected.has(i.ribbon.targetGlyphId));
  const preview=result?.ok?result.items.filter(belongs).sort((a,b)=>Number(b.kind==="bridge")-Number(a.kind==="bridge")):[];
  const fits=!!result?.ok&&tierSelectionFits(result.items,ids,doc.artboard);
  return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)} className="mt-1 rounded border border-border p-2">
    <summary className="cursor-pointer py-1 text-xs font-semibold">التكوين متعدد المستويات</summary>
    {open&&<div className="space-y-2">
      <details className="rounded border border-border p-2">
        <summary className="cursor-pointer py-2 text-xs font-semibold">مكتبة قوالب التكوين</summary>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1">{BUILTIN_TIER_PRESETS.map(p=><button type="button" key={p.id} className="min-h-11 rounded border border-border px-1 text-xs" onClick={()=>load(p)}>{p.name}</button>)}</div>
          <label className="block text-xs">اسم القالب الشخصي<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} className="min-h-10 w-full rounded border border-border bg-background px-2" placeholder="اسم التكوين"/></label>
          <button type="button" disabled={!name.trim()} className="min-h-10 w-full rounded border border-border text-xs disabled:opacity-40" onClick={save}>حفظ الإعدادات الحالية</button>
          <p className="text-xs text-muted-foreground">قوالبي ({presets.length}/30)</p>
          {presets.map(p=><div key={p.id} className="space-y-1 rounded border border-border p-1">
            <button type="button" className="min-h-9 w-full truncate text-start text-xs font-medium" onClick={()=>load(p)}>{p.name} · {p.options.rows} مستويات</button>
            <div className="grid grid-cols-2 gap-1"><button type="button" className="min-h-9 rounded border border-border text-xs" onClick={()=>{const next=saveTierPreset(presets,p.id,p.name,options);if(next&&persist(next))setNotice("تم تحديث إعدادات القالب.");}}>تحديث بالإعدادات</button><button type="button" className="min-h-9 rounded border border-border text-xs" onClick={()=>{if(persist(presets.filter(v=>v.id!==p.id)))setNotice("تم حذف القالب.");}}>حذف</button></div>
          </div>)}
          <p className="text-[10px] text-muted-foreground">تُحفظ الإعدادات فقط في هذا المتصفح، ولا تُحفظ الحروف أو بيانات المشروع. تحميل القالب لا يغيّر اللوحة قبل الاعتماد.</p>
        </div>
      </details>
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
      <p className="text-[10px] text-muted-foreground">ترتيب مكاني من أعلى إلى أسفل، ومن اليمين إلى اليسار داخل المستوى يحافظ على الكلمة كوحدة واحدة. التراكب السالب مقصود، ولا يتم التحقق من اصطدام الحبر أو العناصر غير المحددة.</p>
    </div>}
  </details>;
}
