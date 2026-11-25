import {useState} from "react";
import {useStudio,type DocumentState} from "../../store/studioStore";
import {suggestDecorationPositions,arrangeDecorations,type PlacementResult,type DecorationBatchResult,type DecorationBatchScope} from "../../calligraphy/decorationPlacement";
import type {LetteringItem} from "../../calligraphy/model";
import {geometryBounds} from "../../core/geometry/math";
import {LetteringGlyph} from "../canvas/LetteringGlyph";

export function DecorationPlacementPanel({selected}:{selected:LetteringItem}){
  const doc=useStudio(s=>s.doc);
  const apply=useStudio(s=>s.placeDecorationAtSuggestion);
  const applyBatch=useStudio(s=>s.arrangeDecorationBatch);
  const pending=useStudio(s=>s.letteringPreview);
  const [clearance,setClearance]=useState(4);
  const [proposal,setProposal]=useState<{doc:DocumentState;id:string;clearance:number;result:PlacementResult}|null>(null);
  const [choice,setChoice]=useState(0);
  const [scope,setScope]=useState<DecorationBatchScope>(selected.attachedToGlyphId?"owner":"all");
  const [includeManual,setIncludeManual]=useState(false);
  const [batch,setBatch]=useState<{doc:DocumentState;scope:DecorationBatchScope;includeManual:boolean;clearance:number;result:DecorationBatchResult}|null>(null);
  const currentBatch=batch?.doc===doc&&batch.scope===scope&&batch.includeManual===includeManual&&batch.clearance===clearance?batch.result:null;
  const [notice,setNotice]=useState("");
  const current=proposal?.doc===doc&&proposal.id===selected.id&&proposal.clearance===clearance?proposal.result:null;
  const option=current?.ok?current.options[choice]:undefined;
  const items=doc.lettering??[];
  const obstacles=doc.objects.filter(o=>o.visible&&!o.guide).map(o=>{
    const b=geometryBounds(o.geometry),p=Math.max(0,o.style.strokeWidth)/2;
    return {minX:b.minX-p,minY:b.minY-p,maxX:b.maxX+p,maxY:b.maxY+p};
  });
  const preview=option?items.map(i=>i.id===selected.id?{...i,x:option.x,y:option.y}:i):items;
  return <details className="rounded-lg border border-border p-2">
    <summary className="cursor-pointer py-2 text-xs font-semibold">اقتراح موضع في الفراغات</summary>
    <div className="space-y-2">
      <label className="block text-xs">مسافة الأمان <span dir="ltr">{clearance} px</span><input className="min-h-10 w-full" type="range" min={0} max={30} value={clearance} onChange={e=>{setClearance(Number(e.target.value));setNotice("");}}/></label>
      <button type="button" disabled={!!pending} className="min-h-11 w-full rounded border border-border text-xs disabled:opacity-40" onClick={()=>{setProposal({doc,id:selected.id,clearance,result:suggestDecorationPositions(items,selected.id,doc.artboard,clearance,obstacles)});setChoice(0);setNotice("");}}>البحث عن مواضع متاحة</button>
      {current?.ok&&<>
        <svg viewBox={`0 0 ${doc.artboard.width} ${doc.artboard.height}`} className="h-36 w-full rounded border border-border bg-background" aria-label="معاينة الموضع المقترح">
          {obstacles.map((b,i)=><rect key={i} x={b.minX} y={b.minY} width={b.maxX-b.minX} height={b.maxY-b.minY} fill="currentColor" opacity=".12"/>)}
          {preview.filter(i=>!i.hidden).map(i=><LetteringGlyph key={i.id} item={i} selected={i.id===selected.id} allItems={preview}/>)}
          {current.options.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={Math.max(3,doc.artboard.width*.006)} fill={i===choice?"#0ea5e9":"#94a3b8"}/>)}
        </svg>
        <div className="grid grid-cols-3 gap-1">{current.options.map((_,i)=><button type="button" key={i} aria-pressed={choice===i} className={`min-h-10 rounded border text-xs ${choice===i?"border-primary bg-primary/10":"border-border"}`} onClick={()=>setChoice(i)}>موضع {i+1}</button>)}</div>
        <button type="button" disabled={!option||!!pending} className="min-h-11 w-full rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{if(option&&apply(doc,selected.id,option.x,option.y,clearance)){setProposal(null);setNotice("تم اعتماد الموضع.");}else setNotice("تغير التصميم؛ أعد البحث.");}}>اعتماد الموضع</button>
      </>}
      {current&&!current.ok&&<p className="text-xs text-muted-foreground">{{selection:"حدد حركة أو زخرفة ظاهرة.",unsupported:"لا يمكن فحص جميع العناصر؛ حوّل النصوص إلى مسارات أو قلل عدد العناصر.",space:"لا توجد مواضع آمنة ضمن نطاق البحث؛ قلل الحجم أو مسافة الأمان."}[current.reason]}</p>}
      <details className="space-y-2 rounded border border-border p-2">
        <summary className="cursor-pointer py-2 text-xs font-semibold">ترتيب مجموعة التشكيلات والزخارف</summary>
        <label className="block text-xs">نطاق الترتيب<select value={scope} className="min-h-11 w-full rounded border border-border bg-background" onChange={e=>{setScope(e.target.value as DecorationBatchScope);setNotice("");}}><option value="owner" disabled={!selected.attachedToGlyphId}>تشكيلات الحرف المرتبط</option><option value="all">كل التشكيلات والزخارف الظاهرة</option></select></label>
        <label className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={includeManual} onChange={e=>setIncludeManual(e.target.checked)}/> إعادة ترتيب الحركات المثبتة يدويًا</label>
        <button type="button" disabled={!!pending} className="min-h-11 w-full rounded border border-border text-xs disabled:opacity-40" onClick={()=>{setBatch({doc,scope,includeManual,clearance,result:arrangeDecorations(items,selected.id,doc.artboard,scope,includeManual,clearance,obstacles)});setNotice("");}}>معاينة الترتيب الجماعي</button>
        {currentBatch?.ok&&<>
          <div className="grid grid-cols-2 gap-1">{([{label:"قبل",list:items},{label:"بعد",list:currentBatch.items}]).map(v=><div key={v.label}><p className="text-xs">{v.label}</p><svg viewBox={`0 0 ${doc.artboard.width} ${doc.artboard.height}`} className="h-28 w-full rounded border border-border bg-background" aria-label={v.label}>
            {obstacles.map((b,i)=><rect key={i} x={b.minX} y={b.minY} width={b.maxX-b.minX} height={b.maxY-b.minY} fill="currentColor" opacity=".12"/>)}
            {v.list.filter(i=>!i.hidden).map(i=><LetteringGlyph key={i.id} item={i} selected={false} allItems={v.list}/>)}
          </svg></div>)}</div>
          <p className="text-xs">العناصر المفحوصة: {currentBatch.count} · المتحركة: {currentBatch.moved}</p>
          <div className="grid grid-cols-2 gap-1"><button type="button" disabled={!currentBatch.moved||!!pending} className="min-h-11 rounded bg-primary text-xs text-primary-foreground disabled:opacity-40" onClick={()=>{if(applyBatch(doc,selected.id,scope,includeManual,clearance)){setBatch(null);setProposal(null);setNotice("تم اعتماد الترتيب الجماعي.");}else setNotice("تغير التصميم؛ أعد المعاينة.");}}>اعتماد الكل</button><button type="button" className="min-h-11 rounded border border-border text-xs" onClick={()=>setBatch(null)}>إلغاء</button></div>
        </>}
        {currentBatch&&!currentBatch.ok&&<p className="text-xs text-muted-foreground">{{selection:"يلزم وجود عنصرين مؤهلين على الأقل.",unsupported:"الترتيب يدعم حتى 24 عنصرًا ومسارات قابلة للقياس.",space:"لم يوجد موضع متاح لأحد العناصر؛ لم يتغير أي عنصر."}[currentBatch.reason]}</p>}
        <p className="text-[10px] text-muted-foreground">تُرتب الحركات المرتبطة أولًا، وتُثبت في مواضعها الجديدة. الحركات اليدوية لا تتحرك إلا عند اختيار ذلك.</p>
      </details>
      {notice&&<p role="status" className="text-xs">{notice}</p>}
      <p className="text-[10px] text-muted-foreground">تقدير محافظ يعتمد على حدود العناصر، وليس قواعد التشكيل اللغوية أو اصطدام الحبر الدقيق. الحركة تبقى مرتبطة بحرفها مع تثبيت الموضع يدويًا.</p>
    </div>
  </details>;
}
