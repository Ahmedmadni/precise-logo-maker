import type {LetteringItem} from "./model";
import {preciseGlyphBounds} from "./morph";

export type TierStyle="balanced"|"pyramid"|"cascade";
export type TierOptions={rows:number;style:TierStyle;horizontalGap:number;verticalGap:number;stagger:number};
export type TierResult={ok:true;items:LetteringItem[];blocks:number;rows:number;changed:boolean}|{ok:false;reason:"selection"|"partial-word"|"bridge"|"invalid"|"overlap"};
type Block={id:string;glyphs:LetteringItem[];x:number;y:number;width:number;height:number};

export function composeGlyphTiers(items:LetteringItem[],ids:readonly string[],options:TierOptions):TierResult{
  const selected=new Set(ids), {rows,style,horizontalGap,verticalGap,stagger}=options;
  if(selected.size<2||selected.size>100)return {ok:false,reason:"selection"};
  if(!Number.isInteger(rows)||rows<2||rows>6||!["balanced","pyramid","cascade"].includes(style)||![horizontalGap,verticalGap,stagger].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000)||horizontalGap<0)return {ok:false,reason:"invalid"};
  const glyphs=items.filter(i=>!i.hidden&&i.kind==="outline"&&selected.has(i.id));
  if(glyphs.length!==selected.size)return {ok:false,reason:"selection"};
  const groups=new Map<string,LetteringItem[]>();
  for(const g of glyphs){
    if(g.groupId&&items.some(i=>i.groupId===g.groupId&&!i.hidden&&(i.kind==="outline"||i.kind==="text")&&!selected.has(i.id)))return {ok:false,reason:"partial-word"};
    const key=g.groupId?"word:"+g.groupId:"glyph:"+g.id;
    groups.set(key,[...(groups.get(key)??[]),g]);
  }
  if(groups.size<rows||groups.size>24)return {ok:false,reason:"selection"};
  const blocks:Block[]=[];
  for(const [id,members] of groups){
    const boxes=members.map(preciseGlyphBounds);
    if(boxes.some(b=>!b||!Number.isFinite(b.x)||!Number.isFinite(b.y)||b.width<=0||b.height<=0))return {ok:false,reason:"invalid"};
    const minX=Math.min(...boxes.map(b=>b!.x)),minY=Math.min(...boxes.map(b=>b!.y)),maxX=Math.max(...boxes.map(b=>b!.x+b!.width)),maxY=Math.max(...boxes.map(b=>b!.y+b!.height));
    blocks.push({id,glyphs:members,x:minX,y:minY,width:maxX-minX,height:maxY-minY});
  }
  // Read original spatial order from right to left; keep each word rigid.
  blocks.sort((a,b)=>(b.x+b.width/2)-(a.x+a.width/2)||a.y-b.y||a.id.localeCompare(b.id));
  const cx=(Math.min(...blocks.map(b=>b.x))+Math.max(...blocks.map(b=>b.x+b.width)))/2;
  const cy=(Math.min(...blocks.map(b=>b.y))+Math.max(...blocks.map(b=>b.y+b.height)))/2;
  const counts=Array(rows).fill(1) as number[];
  for(let i=rows;i<blocks.length;i++){
    if(style==="pyramid"){
      let best=rows-1;
      for(let j=rows-1;j>=0;j--)if(counts[j]!/(j+1)<counts[best]!/(best+1))best=j;
      counts[best]!++;
    }else counts[(i-rows)%rows]!++;
  }
  let cursor=0;
  const tiers=counts.map(n=>{const r=blocks.slice(cursor,cursor+n);cursor+=n;return {blocks:r,height:Math.max(...r.map(b=>b.height)),width:r.reduce((s,b)=>s+b.width,0)+horizontalGap*(n-1)};});
  if(tiers.slice(1).some((t,i)=>verticalGap<=-Math.min(t.height,tiers[i]!.height)))return {ok:false,reason:"overlap"};
  const height=tiers.reduce((s,t)=>s+t.height,0)+verticalGap*(rows-1);
  let y=cy-height/2;
  const offsets=new Map<string,{x:number;y:number}>();
  for(let r=0;r<tiers.length;r++){
    const tier=tiers[r]!,rowCenter=cx+(style==="cascade"?(r-(rows-1)/2)*stagger:0);
    let x=rowCenter+tier.width/2;
    for(const block of tier.blocks){
      const delta={x:x-block.width-block.x,y:y+(tier.height-block.height)/2-block.y};
      for(const g of block.glyphs)offsets.set(g.id,delta);
      x-=block.width+horizontalGap;
    }
    y+=tier.height+verticalGap;
  }
  for(const i of items)if(i.kind==="bridge"&&!i.hidden&&i.ribbon){
    const a=offsets.get(i.ribbon.sourceGlyphId)??{x:0,y:0},b=offsets.get(i.ribbon.targetGlyphId)??{x:0,y:0};
    if(Math.hypot(a.x-b.x,a.y-b.y)>1e-7)return {ok:false,reason:"bridge"};
  }
  const next=items.map(i=>{
    const d=offsets.get(i.id)??(i.kind==="haraka"&&i.attachedToGlyphId?offsets.get(i.attachedToGlyphId):undefined);
    return d&&Math.hypot(d.x,d.y)>1e-7?{...i,x:i.x+d.x,y:i.y+d.y}:i;
  });
  if(next.some(i=>!Number.isFinite(i.x)||!Number.isFinite(i.y)))return {ok:false,reason:"invalid"};
  return {ok:true,items:next,blocks:blocks.length,rows,changed:next.some((i,j)=>i!==items[j])};
}
