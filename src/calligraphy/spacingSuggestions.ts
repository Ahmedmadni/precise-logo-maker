import type {LetteringItem} from "./model";
import {preciseGlyphBounds} from "./morph";
import {spaceGlyphSelection,glyphOverlapCandidates,type GlyphArrangeAxis} from "./groupSelection";
import {analyzeGlyphInk} from "./bakeUnion";

export type SpacingSuggestion={gap:number;span:number;inkPairs:number;maxRatio:number;pairArea:number};
export type SpacingSuggestionsResult={ok:true;options:SpacingSuggestion[]}|{ok:false;reason:"selection"|"unsupported"|"no-options"};

/** Evaluate a small deterministic set of signed gaps, never auto-apply.
 * Only complete analyses qualify. Ratios refer to the smaller filled glyph
 * in each pair; they are geometric metrics, not aesthetic scores. */
export function suggestGlyphSpacing(items:LetteringItem[],ids:readonly string[],axis:GlyphArrangeAxis):SpacingSuggestionsResult{
  const selected=new Set(ids);
  if(selected.size<2||selected.size>8)return {ok:false,reason:"selection"};
  if(axis!=="x"&&axis!=="y")return {ok:false,reason:"unsupported"};
  const targets=items.filter(i=>selected.has(i.id)&&!i.hidden&&i.kind==="outline");
  if(targets.length!==selected.size||targets.some(i=>(i.weight??0)!==0||!i.pathData||i.pathData.length>20000))return {ok:false,reason:"unsupported"};
  const bounds=targets.map(preciseGlyphBounds);
  if(bounds.some(b=>!b||!Number.isFinite(b.width)||!Number.isFinite(b.height)||b.width<=0||b.height<=0))return {ok:false,reason:"unsupported"};
  const widths=bounds.map(b=>axis==="x"?b!.width:b!.height);
  const unit=Math.min(...widths);
  const gaps=[-.35,-.2,-.1,0,.1,.25].map(f=>Math.round(unit*f*100)/100);
  const options:SpacingSuggestion[]=[];
  for(const gap of [...new Set(gaps)]){
    const proposal=spaceGlyphSelection(items,ids,axis,gap);
    if(!proposal.ok)continue;
    const candidates=glyphOverlapCandidates(proposal.items,ids);
    const ink=analyzeGlyphInk(proposal.items,candidates);
    if(ink.limited||ink.skipped||ink.checked!==candidates.length)continue;
    options.push({gap,span:widths.reduce((s,w)=>s+w,0)+gap*(selected.size-1),inkPairs:ink.pairs.length,maxRatio:Math.max(0,...ink.pairs.map(p=>p.ratio)),pairArea:ink.pairs.reduce((s,p)=>s+p.area,0)});
  }
  return options.length?{ok:true,options:options.sort((a,b)=>a.span-b.span)}:{ok:false,reason:"no-options"};
}

/** Choose the tightest evaluated layout within a user-selected overlap budget. */
export function pickSpacingSuggestion(options:SpacingSuggestion[],maxRatio:number):SpacingSuggestion|null{
  if(!Number.isFinite(maxRatio)||maxRatio<0||maxRatio>1)return null;
  return [...options].filter(o=>o.maxRatio<=maxRatio+1e-9).sort((a,b)=>a.span-b.span||a.pairArea-b.pairArea)[0]??null;
}
