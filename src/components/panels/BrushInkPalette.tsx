import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { hexToInkHsl, inkHslToHex, inkToneSwatches, type InkHsl } from "../../core/tracing/inkColor";

const KEY = "logo-studio:ink-palette:v1";
const PALETTES = [
  { name:"الحبر الكلاسيكي", colors:["#151515","#ffffff","#50372b","#d1a95e","#783528","#142c50","#255244","#747474"] },
  { name:"ألوان الزخرفة", colors:["#d6b657","#ab7637","#8a303c","#254c86","#15847c","#527442","#70518a","#e4cdb2"] },
] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;
function loadColors():string[]{
  try {
    const raw:unknown=JSON.parse(localStorage.getItem(KEY)??"[]");
    return Array.isArray(raw)?[...new Set(raw.filter((v):v is string=>typeof v==="string"&&HEX.test(v)).map(v=>v.toLowerCase()))].slice(0,24):[];
  } catch { return []; }
}
export function BrushInkPalette({color,onChange}:{color:string;onChange:(value:string)=>void}){
  const [saved,setSaved]=useState<string[]>([]);
  const [draft,setDraft]=useState(color);
  const [message,setMessage]=useState("");
  const [hsl,setHsl]=useState<InkHsl>(()=>hexToInkHsl(color)??{h:0,s:0,l:0});
  useEffect(()=>{setSaved(loadColors());},[]);
  useEffect(()=>{setDraft(color);setHsl(old=>{const next=hexToInkHsl(color);if(!next)return old;if(inkHslToHex(old)===color.toLowerCase())return old;return next;});},[color]);
  const select=(value:string)=>{if(HEX.test(value)){onChange(value.toLowerCase());setDraft(value.toLowerCase());}};
  const updateHsl=(axis:keyof InkHsl,value:number)=>{
    const next={...hsl,[axis]:value};
    const hex=inkHslToHex(next);
    if(hex){setHsl(next);select(hex);}
  };
  const persist=(next:string[])=>{
    try{localStorage.setItem(KEY,JSON.stringify(next));setSaved(next);setMessage("تم تحديث ألوانك المخصصة");}
    catch{setMessage("تعذر حفظ الألوان على الجهاز");}
  };
  const swatch=(value:string)=>(
    <button key={value} type="button" aria-label={"اختيار الحبر "+value} aria-pressed={color.toLowerCase()===value}
      title={value} onClick={()=>select(value)} style={{backgroundColor:value}}
      className="relative aspect-square min-h-9 rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-primary">
      {color.toLowerCase()===value&&<span className="absolute inset-0 flex items-center justify-center"><Check className="h-5 w-5 rounded-full bg-white p-0.5 text-black"/></span>}
    </button>
  );
  return <section className="space-y-3 rounded-xl border border-border bg-background p-3" aria-label="لوحة ألوان الحبر">
    <h4 className="text-xs font-semibold">لوحة ألوان الحبر</h4>
    <div className="flex items-center gap-2">
      <input type="color" aria-label="منتقي لون الحبر" value={HEX.test(color)?color:"#000000"} onChange={e=>select(e.target.value)}
        className="h-11 w-14 shrink-0 rounded-lg border border-border bg-background p-1"/>
      <input aria-label="رمز اللون HEX" dir="ltr" value={draft} maxLength={7} onChange={e=>setDraft(e.target.value)}
        onBlur={()=>{if(HEX.test(draft))select(draft);else setDraft(color);}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(HEX.test(draft))select(draft);}}}
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs"/>
      <button type="button" aria-label="حفظ اللون الحالي" title="حفظ اللون الحالي"
        disabled={saved.length>=24||saved.includes(color.toLowerCase())||!HEX.test(color)}
        onClick={()=>persist([...saved,color.toLowerCase()])} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border disabled:opacity-35"><Plus className="h-5 w-5"/></button>
    </div>
    <details className="rounded-lg border border-border p-2">
      <summary className="cursor-pointer text-xs font-semibold">درجات اللون وضبط التشبع</summary>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-7 gap-1" aria-label="درجات اللون من الداكن إلى الفاتح">{inkToneSwatches(color).map(swatch)}</div>
        {([
          ["h","درجة اللون",360],["s","التشبع",100],["l","الإضاءة",100],
        ] as const).map(([axis,label,max])=><label key={axis} className="block space-y-1 text-xs">
          <span className="flex justify-between"><span>{label}</span><span dir="ltr">{Math.round(hsl[axis])}{axis==="h"?"°":"%"}</span></span>
          <input type="range" min={0} max={max} step={1} value={Math.round(hsl[axis])} onChange={e=>updateHsl(axis,Number(e.target.value))}
            className="min-h-9 w-full accent-[var(--color-primary)]"/>
        </label>)}
        <p className="text-[11px] text-muted-foreground">يظهر اللون مباشرة في معاينة القلم، ويمكن حفظه ضمن ألواني.</p>
      </div>
    </details>
    {PALETTES.map(p=><div key={p.name} className="space-y-1.5"><p className="text-[11px] text-muted-foreground">{p.name}</p><div className="grid grid-cols-4 gap-2">{p.colors.map(swatch)}</div></div>)}
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2"><p className="text-[11px] text-muted-foreground">ألواني ({saved.length}/24)</p>
        {saved.includes(color.toLowerCase())&&<button type="button" aria-label="حذف اللون المحدد من ألواني" onClick={()=>persist(saved.filter(c=>c!==color.toLowerCase()))} className="flex min-h-10 items-center gap-1 text-xs"><Trash2 className="h-4 w-4"/> حذف</button>}</div>
      {saved.length?<div className="grid grid-cols-4 gap-2">{saved.map(swatch)}</div>:<p className="text-[11px] text-muted-foreground">اختر لونًا واضغط + لحفظه.</p>}
    </div>
    <p role="status" className="text-[11px] text-muted-foreground">{message}</p>
  </section>;
}
