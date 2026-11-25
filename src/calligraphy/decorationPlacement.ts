import {HARAKAT,ORNAMENTS,type LetteringItem} from "./model";
import {glyphPointToWorld,outlineNodes} from "./pathEditor";
import {isBelowMark} from "./harakaAnchoring";
import {buildRibbonPath} from "./ribbonJoin";
import type {Bounds,Point} from "../core/geometry/types";

const boundsOf=(points:Point[]):Bounds|null=>{
  if(!points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  return points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),minY:Math.min(b.minY,p.y),maxX:Math.max(b.maxX,p.x),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
};
const inflate=(b:Bounds,p:number):Bounds=>({minX:b.minX-p,minY:b.minY-p,maxX:b.maxX+p,maxY:b.maxY+p});
const shifted=(b:Bounds,x:number,y:number):Bounds=>({minX:b.minX+x,minY:b.minY+y,maxX:b.maxX+x,maxY:b.maxY+y});
const overlap=(a:Bounds,b:Bounds)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;
const center=(b:Bounds):Point=>({x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2});

/** Conservative control-hull envelopes, including rotated/skewed symbols.
 * Unknown live text cannot be measured reliably without font rendering. */
export function decorationBounds(item:LetteringItem,all:LetteringItem[]):Bounds|null{
  if(item.kind==="text")return null;
  if(item.kind==="bridge"){
    const d=buildRibbonPath(item,all);
    return d?boundsOf(outlineNodes(d)):null;
  }
  if(item.kind==="outline"){
    if(!item.pathData)return null;
    const b=boundsOf(outlineNodes(item.pathData).map(p=>glyphPointToWorld(item,p.x,p.y)));
    return b?inflate(b,Math.max(0,item.weight??0)*Math.max(1,Math.abs(item.scaleX??1),Math.abs(item.scaleY??1))*(1+Math.abs(Math.tan((item.skewX??0)*Math.PI/180)))*(1+Math.abs(Math.tan((item.skewY??0)*Math.PI/180)))):null;
  }
  const d=item.kind==="haraka"?(item.markPathData||HARAKAT.find(m=>m.id===item.mark)?.path):ORNAMENTS.find(m=>m.id===item.ornament)?.path;
  if(!d)return null;
  return boundsOf(outlineNodes(d).map(p=>glyphPointToWorld({...item,unitsPerEm:100},p.x-50,50-p.y)));
}
export type DecorationPlacement={x:number;y:number;distance:number};
export type PlacementResult={ok:true;options:DecorationPlacement[]}|{ok:false;reason:"selection"|"unsupported"|"space"};
export function suggestDecorationPositions(items:LetteringItem[],id:string,board:{width:number;height:number},clearance=4,extra:Bounds[]=[]):PlacementResult{
  const target=items.find(i=>i.id===id);
  if(!target||target.hidden||(target.kind!=="haraka"&&target.kind!=="ornament"))return {ok:false,reason:"selection"};
  if(![board.width,board.height,clearance].every(Number.isFinite)||board.width<=0||board.height<=0||clearance<0||clearance>100||items.length>300||extra.length>300)return {ok:false,reason:"unsupported"};
  const local=decorationBounds({...target,x:0,y:0},items);
  if(!local)return {ok:false,reason:"unsupported"};
  const others=items.filter(i=>!i.hidden&&i.id!==id);
  const obstacles=others.map(i=>decorationBounds(i,items));
  if(obstacles.some(b=>!b)||extra.some(b=>![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite)))return {ok:false,reason:"unsupported"};
  const occupied=[...obstacles.filter((b):b is Bounds=>!!b),...extra].map(b=>inflate(b,clearance));
  const owner=target.attachedToGlyphId?others.find(i=>i.id===target.attachedToGlyphId&&i.kind==="outline"):undefined;
  if(target.attachedToGlyphId&&!owner)return {ok:false,reason:"unsupported"};
  const anchor=owner?decorationBounds(owner,items):null;
  const candidates:Point[]=[];
  if(anchor&&target.kind==="haraka"){
    const below=!!target.mark&&isBelowMark(target.mark);
    const width=anchor.maxX-anchor.minX;
    const y=below?anchor.maxY+clearance-local.minY:anchor.minY-clearance-local.maxY;
    const step=Math.max(4,(local.maxY-local.minY)*.6+clearance);
    for(let row=0;row<7;row++)for(const fraction of [0,-.15,.15,-.3,.3,-.45,.45]){
      candidates.push({x:center(anchor).x+width*fraction-center(local).x,y:y+(below?1:-1)*row*step});
    }
  }else{
    // Search near the composition, not the whole empty artboard.
    const all=others.filter(i=>i.kind==="outline").map(i=>decorationBounds(i,items)).filter((b):b is Bounds=>!!b);
    const extent=all.length?boundsOf(all.flatMap(b=>[{x:b.minX,y:b.minY},{x:b.maxX,y:b.maxY}]))!:null;
    const region=extent?inflate(extent,Math.max(target.size,clearance*2)):inflate({minX:target.x,minY:target.y,maxX:target.x,maxY:target.y},target.size*3);
    for(let i=0;i<=12;i++)for(let j=0;j<=12;j++)candidates.push({x:region.minX+(region.maxX-region.minX)*i/12-center(local).x,y:region.minY+(region.maxY-region.minY)*j/12-center(local).y});
  }
  const origin=anchor?{x:center(anchor).x-center(local).x,y:target.kind==="haraka"&&target.mark&&isBelowMark(target.mark)?anchor.maxY+clearance-local.minY:anchor.minY-clearance-local.maxY}:target;
  const options=candidates.filter(p=>{
    const b=shifted(local,p.x,p.y);
    return b.minX>=0&&b.minY>=0&&b.maxX<=board.width&&b.maxY<=board.height&&!occupied.some(o=>overlap(b,o));
  }).map(p=>({...p,distance:Math.hypot(p.x-origin.x,p.y-origin.y)})).sort((a,b)=>a.distance-b.distance);
  const distinct:DecorationPlacement[]=[];
  for(const p of options){if(distinct.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=Math.max(3,target.size*.2)))distinct.push(p);if(distinct.length===6)break;}
  return distinct.length?{ok:true,options:distinct}:{ok:false,reason:"space"};
}
