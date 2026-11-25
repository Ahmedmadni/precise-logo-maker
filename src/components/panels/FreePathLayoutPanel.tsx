import { useMemo, useRef, useState, type PointerEvent } from "react";
import { type LetteringItem } from "../../calligraphy/model";
import { composeFreePath, DEFAULT_GUIDE, sampleGuide, splitGuideSegment, moveGuidePoint, GUIDE_PRESETS, validGuide, type GuideChain } from "../../calligraphy/freePathLayout";
import { useStudio } from "../../store/studioStore";

const STORAGE_KEY="logo-studio.free-path-presets.v1";
type SavedGuide={name:string;guide:GuideChain};
function readGuides():SavedGuide[]{
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)??"[]");
    return Array.isArray(raw)?raw.filter(p=>p&&typeof p.name==="string"&&p.name.length>0&&p.name.length<=60&&validGuide(p.guide)).slice(0,30):[];
  }catch{return [];}
}

export function FreePathLayoutPanel({siblings}:{siblings:LetteringItem[]}){
  const [guide,setGuide]=useState<GuideChain>(DEFAULT_GUIDE);
  const [scale,setScale]=useState(1);
  const [smooth,setSmooth]=useState(true);
  const [saved,setSaved]=useState<SavedGuide[]>(readGuides);
  const [presetName,setPresetName]=useState("");
  const [savedIndex,setSavedIndex]=useState("");
  const loadGuide=(g:GuideChain)=>{setGuide(g.map(p=>({...p})));setSegment(0);setNotice("");};
  const persist=(next:SavedGuide[])=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setSaved(next);return true;}
    catch{setNotice("تعذر الحفظ المحلي؛ تحقق من مساحة التخزين وإعدادات المتصفح.");return false;}
  };
  const saveGuide=()=>{
    const name=presetName.trim().slice(0,60);
    if(!name||!validGuide(guide))return;
    if(saved.some(p=>p.name===name)){setNotice("الاسم مستخدم؛ اختر اسمًا آخر.");return;}
    if(saved.length>=30){setNotice("الحد الأقصى 30 قالبًا محليًا.");return;}
    if(persist([...saved,{name,guide:guide.map(p=>({...p}))}])){setPresetName("");setNotice("تم حفظ قالب المسار محليًا.");}
  };
  const [segment,setSegment]=useState(0);
  const segmentCount=(guide.length-1)/3;
  const segmentIds=Array.from({length:segmentCount},(_,i)=>i);
  const guidePath=`M ${guide[0]!.x} ${guide[0]!.y} `+segmentIds.map(i=>`C ${guide.slice(i*3+1,i*3+4).map(p=>`${p.x} ${p.y}`).join(" ")}`).join(" ");
  const [margin,setMargin]=useState(0.05);
  const [reverse,setReverse]=useState(false);
  const [tangent,setTangent]=useState(false);
  const [upright,setUpright]=useState(true);
  const [notice,setNotice]=useState("");
  const [open,setOpen]=useState(false);
  const drag=useRef<number|null>(null);
  const svg=useRef<SVGSVGElement|null>(null);
  const count=siblings.filter(g=>!g.hidden&&(g.kind==="outline"||g.kind==="text")).length;
  const options={scale,margin,reverse,tangent,upright};
  const samples=useMemo(()=>open?sampleGuide(guide,count,margin,reverse):[],[open,guide,count,margin,reverse]);
  const canApply=open&&count>=2&&siblings.filter(g=>!g.hidden&&(g.kind==="outline"||g.kind==="text")).every(g=>g.kind==="outline"&&!!g.pathData)&&samples.length===count;
  const update=(i:number,axis:"x"|"y",value:number)=>{
    setGuide(old=>moveGuidePoint(old,i,{...old[i]!,[axis]:value},smooth));
    setNotice("");
  };
  const move=(event:PointerEvent<SVGSVGElement>)=>{
    if(drag.current===null||!svg.current)return;
    const matrix=svg.current.getScreenCTM();
    if(!matrix)return;
    const p=svg.current.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
    const q=p.matrixTransform(matrix.inverse());
    const i=drag.current;
    setGuide(old=>moveGuidePoint(old,i,q,smooth));
    setNotice("");
  };
  const apply=()=>{
    useStudio.getState().commitLetteringPreview();
    const ids=new Set(siblings.map(g=>g.id));
    const latest=(useStudio.getState().doc.lettering??[]).filter(g=>ids.has(g.id));
    const patches=composeFreePath(latest,guide,options);
    if(!patches.length){setNotice("تعذر توزيع الحروف على المسار الحالي.");return;}
    useStudio.getState().updateLetteringMany(patches,"تركيب على مسار حر");
    setNotice("تم تطبيق التركيب؛ يمكن التراجع بخطوة واحدة.");
  };
  return <details className="rounded-lg border border-border p-2" onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer py-2 text-xs font-medium">تركيب على مسار حر</summary>
    {open&&<div className="space-y-2 text-xs">
      <p className="text-muted-foreground">حرّك المراسي والمقابض؛ يمكن تقسيم أي منحنى إلى جزأين دون تغيير شكله. النقاط الصغيرة تمثل مراكز الحروف وليس شكلها النهائي.</p>
      <svg ref={svg} viewBox="-6 -6 112 112" className="block h-48 w-full touch-none rounded-lg border border-border bg-background" onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} role="img" aria-label="تحرير منحنى المسار الحر">
        {segmentIds.map(i=><path key={i} d={`M ${guide[i*3]!.x} ${guide[i*3]!.y} L ${guide[i*3+1]!.x} ${guide[i*3+1]!.y} M ${guide[i*3+2]!.x} ${guide[i*3+2]!.y} L ${guide[i*3+3]!.x} ${guide[i*3+3]!.y}`} stroke="currentColor" strokeOpacity={i===segment?".6":".25"} strokeDasharray="2 2" fill="none"/>)}
        <path d={guidePath} stroke="currentColor" strokeWidth="1.2" fill="none"/>
        {samples.map((s,i)=><circle key={i} cx={s.point.x} cy={s.point.y} r="1.4" fill="currentColor" opacity=".65"/>)}
        {guide.map((p,i)=><g key={i} onPointerDown={event=>{event.preventDefault();drag.current=i;svg.current?.setPointerCapture(event.pointerId);}} className="cursor-grab">
          <circle cx={p.x} cy={p.y} r="7" fill="transparent"/>
          <circle cx={p.x} cy={p.y} r="3" fill={i%3===0?"currentColor":"none"} stroke="currentColor"/>
        </g>)}
      </svg>
      <div className="grid grid-cols-2 gap-1">
        <label className="block">المنحنى المختار<select value={segment} onChange={e=>setSegment(Number(e.target.value))} className="min-h-10 w-full rounded border border-border bg-background">
          {segmentIds.map(i=><option key={i} value={i}>منحنى {i+1}</option>)}
        </select></label>
        <button type="button" disabled={segmentCount>=8} onClick={()=>{setGuide(old=>splitGuideSegment(old,segment));setNotice("");}} className="min-h-10 rounded-lg border border-border disabled:opacity-40">تقسيم المنحنى</button>
      </div>
      <p className="text-muted-foreground">عدد المنحنيات: {segmentCount} / 8.</p>
      <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={smooth} onChange={e=>setSmooth(e.target.checked)}/> ربط اتجاه المقابض عند المراسي المشتركة</label>
      <details className="rounded-lg border border-border p-2">
        <summary className="cursor-pointer py-1 font-medium">مكتبة المسارات</summary>
        <div className="grid grid-cols-2 gap-1 pt-2">
          {GUIDE_PRESETS.map(p=><button key={p.name} type="button" className="min-h-9 rounded border border-border" onClick={()=>loadGuide(p.guide)}>{p.name}</button>)}
        </div>
        <div className="space-y-1 pt-2">
          <label className="block">اسم القالب<input value={presetName} maxLength={60} onChange={e=>setPresetName(e.target.value)} className="min-h-9 w-full rounded border border-border bg-background px-2"/></label>
          <button type="button" disabled={!presetName.trim()} onClick={saveGuide} className="min-h-9 w-full rounded border border-border disabled:opacity-40">حفظ المسار كقالب محلي</button>
          <label className="block">القوالب المحفوظة ({saved.length}/30)<select value={savedIndex} onChange={e=>setSavedIndex(e.target.value)} className="min-h-9 w-full rounded border border-border bg-background">
            <option value="">اختر قالبًا</option>
            {saved.map((p,i)=><option key={p.name} value={String(i)}>{p.name}</option>)}
          </select></label>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" disabled={savedIndex===""||!saved[Number(savedIndex)]} onClick={()=>{const p=saved[Number(savedIndex)];if(p)loadGuide(p.guide);}} className="min-h-9 rounded border border-border disabled:opacity-40">تحميل</button>
            <button type="button" disabled={savedIndex===""||!saved[Number(savedIndex)]} onClick={()=>{if(persist(saved.filter((_,i)=>i!==Number(savedIndex)))){setSavedIndex("");setNotice("تم حذف القالب.");}}} className="min-h-9 rounded border border-border disabled:opacity-40">حذف</button>
          </div>
        </div>
        <p className="pt-1 text-muted-foreground">القوالب تحفظ شكل المسار فقط في تخزين المتصفح الحالي، لا إعدادات التوزيع أو ارتباط الحروف.</p>
      </details>
      <details><summary className="cursor-pointer py-1">ضبط النقاط بالأرقام</summary>
        {guide.map((p,i)=><div key={i} className="grid grid-cols-2 gap-1 pt-1">
          <label>{i%3===0?`مرساة ${i/3+1}`:`مقبض ${i}`} X<input type="number" min={0} max={100} value={Math.round(p.x)} onChange={e=>update(i,"x",Number(e.target.value))} className="w-full rounded border border-border bg-background p-1"/></label>
          <label>Y<input type="number" min={0} max={100} value={Math.round(p.y)} onChange={e=>update(i,"y",Number(e.target.value))} className="w-full rounded border border-border bg-background p-1"/></label>
        </div>)}
      </details>
      <label className="block"><span className="flex justify-between"><span>حجم المسار</span><span dir="ltr">{scale.toFixed(1)}×</span></span><input type="range" min={.5} max={3} step={.1} value={scale} onChange={e=>setScale(Number(e.target.value))} className="w-full"/></label>
      <label className="block"><span className="flex justify-between"><span>هامش الطرفين</span><span>{Math.round(margin*100)}%</span></span><input type="range" min={0} max={.4} step={.05} value={margin} onChange={e=>setMargin(Number(e.target.value))} className="w-full"/></label>
      <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={reverse} onChange={e=>setReverse(e.target.checked)}/> عكس ترتيب المسار</label>
      <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={tangent} onChange={e=>setTangent(e.target.checked)}/> تدوير وفق المماس</label>
      <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={upright} disabled={!tangent} onChange={e=>setUpright(e.target.checked)}/> إبقاء الحروف دون انقلاب</label>
      <div className="grid grid-cols-2 gap-1">
        <button type="button" onClick={()=>{setGuide(DEFAULT_GUIDE);setSegment(0);setNotice("");}} className="min-h-10 rounded-lg border border-border">إعادة المسار</button>
        <button type="button" disabled={!canApply} onClick={apply} className="min-h-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">تطبيق التركيب</button>
      </div>
      <p className="text-muted-foreground">المسار دليل مؤقت؛ تُحفظ مواضع الحروف فقط عند التطبيق. قد تتداخل الحروف أو تنفصل وصلاتها الطبيعية.</p>
      {notice&&<p role="status">{notice}</p>}
    </div>}
  </details>;
}
