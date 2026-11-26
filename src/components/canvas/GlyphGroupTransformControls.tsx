import {useMemo,useState} from "react";
import {useStudio} from "../../store/studioStore";
import {glyphGroupPivot,groupMoveIds,transformGlyphSelection,arrangeGlyphSelection,spaceGlyphSelection,glyphOverlapCandidates,type GlyphArrangeAxis,type GlyphArrangeMode} from "../../calligraphy/groupSelection";
import {preciseGlyphBounds} from "../../calligraphy/morph";
import {analyzeGlyphInk,INK_CURVE_TOLERANCE,type InkAnalysis} from "../../calligraphy/bakeUnion";
import type {LetteringItem} from "../../calligraphy/model";
import {suggestGlyphSpacing,pickSpacingSuggestion,type SpacingSuggestionsResult} from "../../calligraphy/spacingSuggestions";
import {LetteringGlyph} from "./LetteringGlyph";
import {GlyphBalanceControls} from "./GlyphBalanceControls";
import {GlyphTierControls} from "./GlyphTierControls";

export function GlyphGroupTransformControls(){
  const source=useStudio(s=>s.doc.lettering);
  const ids=useStudio(s=>s.glyphMultiIds);
  const apply=useStudio(s=>s.transformGlyphMulti);
  const applyArrangement=useStudio(s=>s.arrangeGlyphMulti);
  const applySpacing=useStudio(s=>s.spaceGlyphMulti);
  const guideEdit=useStudio(s=>s.guideLayer.edit);
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<"transform"|"arrange"|"spacing"|"balance"|"tiers">("transform");
  const [axis,setAxis]=useState<GlyphArrangeAxis>("x");
  const [mode,setMode]=useState<GlyphArrangeMode>("distribute");
  const [gap,setGap]=useState("0");
  const [scale,setScale]=useState(100);
  const [degrees,setDegrees]=useState(0);
  const [notice,setNotice]=useState("");
  const [suggestions,setSuggestions]=useState<{source:LetteringItem[];key:string;result:SpacingSuggestionsResult}|null>(null);
  const [budget,setBudget]=useState(5);
  const [ink,setInk]=useState<{source:LetteringItem[];key:string;before:InkAnalysis;after:InkAnalysis|null}|null>(null);
  const items=source??[];
  const groupTab=open&&(tab==="transform"||tab==="arrange"||tab==="spacing");
  const allowed=useMemo(()=>groupMoveIds(items,ids),[source,ids]);
  const pivot=useMemo(()=>groupTab?glyphGroupPivot(items,ids):null,[source,ids,groupTab]);
  const arrangement=useMemo(()=>open&&tab==="arrange"?arrangeGlyphSelection(items,ids,axis,mode):null,[source,ids,open,tab,axis,mode]);
  const spacing=useMemo(()=>open&&tab==="spacing"?spaceGlyphSelection(items,ids,axis,gap.trim()?Number(gap):NaN):null,[source,ids,open,tab,axis,gap]);
  const beforeOverlaps=useMemo(()=>open&&tab==="spacing"?glyphOverlapCandidates(items,ids):[],[source,ids,open,tab]);
  const afterOverlaps=useMemo(()=>spacing?.ok?glyphOverlapCandidates(spacing.items,ids):[],[spacing,ids]);
  const suggestionKey=JSON.stringify([ids,axis]);
  const currentSuggestions=suggestions&&suggestions.source===source&&suggestions.key===suggestionKey?suggestions.result:null;
  const recommended=currentSuggestions?.ok?pickSpacingSuggestion(currentSuggestions.options,budget/100):null;
  const inkKey=JSON.stringify([ids,axis,gap]);
  const currentInk=ink&&ink.source===source&&ink.key===inkKey?ink:null;
  const shownInk=currentInk?(spacing?.ok?currentInk.after:currentInk.before):null;
  const next=useMemo(()=>groupTab?(tab==="spacing"?(spacing?.ok?spacing.items:null):tab==="arrange"?(arrangement?.ok?arrangement.items:null):allowed.ok?transformGlyphSelection(items,ids,{scale:scale/100,degrees}):null):null,[groupTab,tab,spacing,arrangement,allowed,source,ids,scale,degrees]);
  const selected=useMemo(()=>new Set(ids),[ids]);
  const visible=useMemo(()=>groupTab?(next??items).filter(i=>!i.hidden&&(selected.has(i.id)||i.kind==="haraka"&&!!i.attachedToGlyphId&&selected.has(i.attachedToGlyphId)||i.kind==="bridge"&&!!i.ribbon&&selected.has(i.ribbon.sourceGlyphId)&&selected.has(i.ribbon.targetGlyphId))):[],[groupTab,next,source,selected]);
  const boxes=useMemo(()=>groupTab?[...items,...(next??[])].filter(i=>selected.has(i.id)).map(preciseGlyphBounds).filter((b):b is NonNullable<typeof b>=>!!b):[],[groupTab,source,next,selected]);
  const minX=boxes.length?Math.min(...boxes.map(b=>b.x)):0,minY=boxes.length?Math.min(...boxes.map(b=>b.y)):0,maxX=boxes.length?Math.max(...boxes.map(b=>b.x+b.width)):1,maxY=boxes.length?Math.max(...boxes.map(b=>b.y+b.height)):1;
  const pad=Math.max(10,(maxX-minX)*.15,(maxY-minY)*.15,...visible.filter(i=>i.kind==="haraka").map(i=>i.size));
  const viewBox=[minX-pad,minY-pad,maxX-minX+2*pad,maxY-minY+2*pad].join(" ");
  if(!source||!ids.length)return null;
  return <div className="mt-1 border-t border-border pt-1">
    <button type="button" className="min-h-9 w-full rounded border border-border text-xs" aria-expanded={open} onClick={()=>{setOpen(!open);setNotice("");}}>تنسيق الحروف ({ids.length})</button>
    {open&&<div className="w-full max-w-[320px] space-y-2 pt-2">
      <div className="grid grid-cols-3 gap-1">{([{id:"transform",label:"التحويل"},{id:"arrange",label:"المحاذاة"},{id:"spacing",label:"التداخل"},{id:"balance",label:"التوازن"},{id:"tiers",label:"التكوين والقوالب"}] as const).map(v=><button type="button" key={v.id} aria-pressed={tab===v.id} className={`min-h-10 rounded border text-xs ${tab===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setTab(v.id);setNotice("");}}>{v.label}</button>)}</div>
      {tab==="balance"?<GlyphBalanceControls/>:tab==="tiers"?<GlyphTierControls/>:tab==="spacing"?<>
        <div className="grid grid-cols-2 gap-1">{([{id:"x",label:"أفقي"},{id:"y",label:"رأسي"}] as const).map(v=><button type="button" key={v.id} aria-pressed={axis===v.id} className={`min-h-10 rounded border text-xs ${axis===v.id?"border-primary bg-primary/10":"border-border"}`} onClick={()=>setAxis(v.id)}>{v.label}</button>)}</div>
        <label className="block text-xs">الفاصل بين الحدود (px)<input type="number" value={gap} step={1} min={-10000} max={10000} onChange={e=>{setGap(e.target.value);setNotice("");}} className="min-h-10 w-full rounded border border-border bg-background px-2" dir="ltr"/></label>
        <div className="grid grid-cols-3 gap-1">{[-5,0,5].map(v=><button type="button" key={v} className="min-h-9 rounded border border-border text-xs" onClick={()=>setGap(String(v))}>{v===-5?"تراكب":v===0?"تماس":"فصل"}</button>)}</div>
        <div className="space-y-1 rounded border border-border p-2">
          <button type="button" disabled={ids.length<2||ids.length>8} className="min-h-10 w-full rounded border border-border text-xs disabled:opacity-40" onClick={()=>setSuggestions({source,key:suggestionKey,result:suggestGlyphSpacing(source,ids,axis)})}>اقتراح تباعد بناءً على الحبر</button>
          <p className="text-[10px] text-muted-foreground">يفحص حتى 6 بدائل لمجموعة من 2 إلى 8 حروف.</p>
          {currentSuggestions?.ok&&<>
            <label className="block text-xs">أقصى تداخل للحرف الأصغر: {budget}%<select className="min-h-9 w-full rounded border border-border bg-background" value={budget} onChange={e=>setBudget(Number(e.target.value))}>{[0,5,10,20,35].map(v=><option key={v} value={v}>{v}%</option>)}</select></label>
            <div className="space-y-1">
              {currentSuggestions.options.map(o=><button type="button" key={o.gap} aria-pressed={Number(gap)===o.gap} className={`flex min-h-10 w-full items-center justify-between gap-1 rounded border px-2 text-xs ${recommended?.gap===o.gap?"border-primary bg-primary/10":"border-border"}`} onClick={()=>{setGap(String(o.gap));setNotice("");}}>
                <span dir="ltr">{o.gap.toFixed(2)} px</span><span>{o.inkPairs} تقاطع · {(o.maxRatio*100).toFixed(1)}%</span>{recommended?.gap===o.gap&&<span>مقترح</span>}
              </button>)}
            </div>
            {!recommended&&<p className="text-xs text-muted-foreground">لا يوجد بديل ضمن حد التداخل المختار.</p>}
            <p className="text-[10px] text-muted-foreground">المقترح هو الأضيق ضمن الحد المحدد من البدائل المفحوصة. اختره للمعاينة ثم اعتمد يدويًا.</p>
          </>}
          {currentSuggestions&&!currentSuggestions.ok&&<p className="text-xs text-muted-foreground">{{selection:"حدد من حرفين إلى ثمانية.",unsupported:"توجد حدود أو سماكات غير مدعومة.", "no-options":"لم يكتمل فحص بديل صالح؛ راجع الوصلات والمسارات."}[currentSuggestions.reason]}</p>}
        </div>
        {boxes.length>0&&<svg viewBox={viewBox} className="h-28 w-full rounded border border-border bg-background" aria-label="معاينة التداخل">
          {visible.map(i=><LetteringGlyph key={i.id} item={i} selected={false} allItems={next??source}/>)}
          {!shownInk&&(spacing?.ok?afterOverlaps:beforeOverlaps).slice(0,100).map((b,i)=><rect key={i} x={b.x} y={b.y} width={b.width} height={b.height} fill="#f59e0b" fillOpacity=".18" stroke="#f59e0b" strokeDasharray="3 2" vectorEffect="non-scaling-stroke"/>)}
          {shownInk?.pairs.slice(0,100).map((p,i)=><path key={i} d={p.path} fill="#ef4444" fillOpacity=".65" fillRule="evenodd" stroke="#ef4444" strokeWidth="1" vectorEffect="non-scaling-stroke"/>)}
        </svg>}
        <p className="text-xs">تداخلات الحدود: {beforeOverlaps.length}{spacing?.ok?` ← ${afterOverlaps.length}`:""}</p>
        <button type="button" disabled={ids.length<2||ids.length>400} className="min-h-10 w-full rounded border border-border text-xs disabled:opacity-40" onClick={()=>setInk({source,key:inkKey,before:analyzeGlyphInk(source,beforeOverlaps),after:spacing?.ok?analyzeGlyphInk(spacing.items,afterOverlaps):null})}>فحص تداخل الحبر</button>
        {currentInk&&<div className="space-y-1 text-xs" role="status">
          <p>أزواج الحبر المتداخل: {currentInk.before.pairs.length}{currentInk.after?` ← ${currentInk.after.pairs.length}`:""}</p>
          <p>مجموع مساحات التقاطع الزوجية: {currentInk.before.pairs.reduce((s,p)=>s+p.area,0).toFixed(2)}{currentInk.after?` ← ${currentInk.after.pairs.reduce((s,p)=>s+p.area,0).toFixed(2)}`:""} px²</p>
          {(currentInk.before.skipped>0||currentInk.before.limited||currentInk.after?.skipped||currentInk.after?.limited)?<p className="text-muted-foreground">الفحص غير مكتمل: مسارات غير مدعومة أو بلوغ حد الحساب (40 حرفًا / 120 زوجًا لكل فحص).</p>:null}
          <p className="text-muted-foreground">تقريب حدود الحبر ({INK_CURVE_TOLERANCE} px)، دون السماكة الإضافية أو التشكيلات والوصلات.</p>
        </div>}
        {spacing&&!spacing.ok&&<p className="text-xs text-muted-foreground">{{selection:"حدد حرفين على الأقل وحتى 400 حرف.",bridge:"التباعد يغير وصلة حية؛ ألغِ الوصلة أولًا أو حافظ على ترتيبها.",overlap:"التراكب كبير ويعكس ترتيب الحروف.",invalid:"أدخل مسافة صالحة."}[spacing.reason]}</p>}
        <div className="grid grid-cols-2 gap-1">
          <button type="button" disabled={!spacing?.ok||!spacing.changed||guideEdit} className="min-h-10 rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{if(applySpacing(source,ids,axis,Number(gap)))setOpen(false);else setNotice("تعذر اعتماد التباعد.");}}>اعتماد</button>
          <button type="button" className="min-h-10 rounded border border-border text-xs" onClick={()=>setOpen(false)}>إلغاء</button>
        </div>
        <p className="text-[10px] text-muted-foreground">القيم السالبة تراكب مقصود. البرتقالي تداخل الحدود المستطيلة؛ الأحمر تقاطع مساحات الحبر بعد الفحص. تبقى نقطة منتصف المجموعة ثابتة.</p>
      </>:tab==="arrange"?<>
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
