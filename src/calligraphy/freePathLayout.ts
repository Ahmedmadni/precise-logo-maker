import type { LetteringItem } from "./model";
import type { LetteringPatchEntry } from "./kelkComposition";
import { preciseGlyphBounds } from "./morph";

export type GuidePoint = {x:number;y:number};
export type CubicGuide = [GuidePoint,GuidePoint,GuidePoint,GuidePoint];
export const DEFAULT_GUIDE:CubicGuide = [{x:90,y:50},{x:65,y:10},{x:35,y:90},{x:10,y:50}];

function pointAt(p:CubicGuide,t:number):GuidePoint{
  const u=1-t;
  return {x:u*u*u*p[0].x+3*u*u*t*p[1].x+3*u*t*t*p[2].x+t*t*t*p[3].x,
    y:u*u*u*p[0].y+3*u*u*t*p[1].y+3*u*t*t*p[2].y+t*t*t*p[3].y};
}
export type GuideChain = GuidePoint[];
export function splitGuideSegment(chain:GuideChain,index:number):GuideChain{
  const offset=index*3;
  if(!Number.isInteger(index)||offset<0||offset+3>=chain.length||chain.length>=25)return chain;
  const a=chain[offset]!,b=chain[offset+1]!,c=chain[offset+2]!,d=chain[offset+3]!;
  const mid=(p:GuidePoint,q:GuidePoint)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
  const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
  return [...chain.slice(0,offset),a,ab,abc,m,bcd,cd,d,...chain.slice(offset+4)];
}
export function sampleGuide(chain:GuideChain,count:number,margin=0,reverse=false):{point:GuidePoint;angle:number}[]{
  if(!Number.isInteger(count)||count<2||count>200||!Number.isFinite(margin)||
     chain.length<4||chain.length>25||(chain.length-1)%3!==0||
     chain.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))return [];
  const steps=256, points:GuidePoint[]=[chain[0]!];
  for(let i=0;i+3<chain.length;i+=3){
    const cubic:CubicGuide=[chain[i]!,chain[i+1]!,chain[i+2]!,chain[i+3]!];
    for(let j=1;j<=steps;j++)points.push(pointAt(cubic,j/steps));
  }
  const distances=[0];
  for(let i=1;i<points.length;i++)distances.push(distances[i-1]!+Math.hypot(points[i]!.x-points[i-1]!.x,points[i]!.y-points[i-1]!.y));
  const length=distances.at(-1)!;
  if(!Number.isFinite(length)||length<1e-6)return [];
  const inset=Math.max(0,Math.min(.45,margin));
  let j=1;
  const samples=Array.from({length:count},(_,i)=>{
    const d=length*(inset+(1-2*inset)*i/(count-1));
    while(j<points.length-1&&(distances[j]!<d||distances[j]===distances[j-1]))j++;
    const span=distances[j]!-distances[j-1]!;
    const t=span>0?(d-distances[j-1]!)/span:0;
    const a=points[j-1]!,b=points[j]!;
    const point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    if(reverse)angle=(angle+360)%360-180;
    return {point,angle};
  });
  return reverse?samples.reverse():samples;
}

export interface FreePathOptions {scale:number;margin:number;reverse:boolean;tangent:boolean;upright:boolean}
export function composeFreePath(items:LetteringItem[],guide:GuideChain,options:FreePathOptions):LetteringPatchEntry[]{
  const glyphs=items.filter(g=>!g.hidden&&(g.kind==="outline"||g.kind==="text"));
  if(glyphs.length<2||glyphs.length>200||glyphs.some(g=>g.kind!=="outline"||!g.pathData)||!Number.isFinite(options.scale))return [];
  const indexed=glyphs.every(g=>Number.isInteger(g.glyphIndex))&&new Set(glyphs.map(g=>g.glyphIndex)).size===glyphs.length;
  const ordered=indexed?[...glyphs].sort((a,b)=>b.glyphIndex!-a.glyphIndex!):glyphs;
  const bounds=ordered.map(preciseGlyphBounds);
  if(bounds.some(b=>!b||b.width<=0||b.height<=0))return [];
  const centers=bounds.map(b=>({x:b!.x+b!.width/2,y:b!.y+b!.height/2}));
  const cx=centers.reduce((s,p)=>s+p.x,0)/ordered.length,cy=centers.reduce((s,p)=>s+p.y,0)/ordered.length;
  const samples=sampleGuide(guide,ordered.length,options.margin,options.reverse);
  if(samples.length!==ordered.length)return [];
  const mx=samples.reduce((s,p)=>s+p.point.x,0)/samples.length,my=samples.reduce((s,p)=>s+p.point.y,0)/samples.length;
  const averageSize=ordered.reduce((s,g)=>s+g.size,0)/ordered.length;
  const scale=averageSize*ordered.length/100*Math.max(.5,Math.min(3,options.scale));
  if(!Number.isFinite(scale)||scale<=0)return [];
  const result:LetteringPatchEntry[]=[];
  for(let i=0;i<ordered.length;i++){
    const g=ordered[i]!,sample=samples[i]!;
    let rotation=options.tangent?sample.angle:0;
    if(options.upright&&options.tangent){if(rotation>90)rotation-=180;else if(rotation< -90)rotation+=180;}
    const b=preciseGlyphBounds({...g,x:0,y:0,rotation});
    if(!b)return [];
    result.push({id:g.id,patch:{x:cx+(sample.point.x-mx)*scale-b.x-b.width/2,y:cy+(sample.point.y-my)*scale-b.y-b.height/2,rotation}});
  }
  return result;
}


export function validGuide(value:unknown):value is GuideChain{
  return Array.isArray(value)&&value.length>=4&&value.length<=25&&(value.length-1)%3===0&&
    value.every(p=>p!==null&&typeof p==="object"&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100);
}

/** Smooth mode aligns opposite handles, preserving the opposite handle's
 * length unless the guide editor boundary requires shortening it. */
export function moveGuidePoint(chain:GuideChain,index:number,point:GuidePoint,smooth:boolean):GuideChain{
  if(!validGuide(chain)||!Number.isInteger(index)||!chain[index]||![point.x,point.y].every(Number.isFinite))return chain;
  const clamp=(n:number)=>Math.max(0,Math.min(100,n));
  const next=chain.map(p=>({...p}));
  const old=next[index]!,p={x:clamp(point.x),y:clamp(point.y)};
  next[index]=p;
  if(!smooth)return next;
  if(index%3===0){
    for(const i of [index-1,index+1]){
      if(!next[i])continue;
      const q=next[i]!;
      next[i]={x:clamp(q.x+p.x-old.x),y:clamp(q.y+p.y-old.y)};
    }
    return next;
  }
  const anchor=index%3===1?index-1:index+1;
  const opposite=2*anchor-index;
  if(!next[opposite]||!next[anchor])return next;
  const a=next[anchor]!,q=next[opposite]!;
  const dx=a.x-p.x,dy=a.y-p.y,len=Math.hypot(dx,dy);
  if(len<1e-8)return next;
  const ux=dx/len,uy=dy/len;
  let l=Math.hypot(q.x-a.x,q.y-a.y);
  if(ux>0)l=Math.min(l,(100-a.x)/ux);else if(ux<0)l=Math.min(l,-a.x/ux);
  if(uy>0)l=Math.min(l,(100-a.y)/uy);else if(uy<0)l=Math.min(l,-a.y/uy);
  next[opposite]={x:clamp(a.x+ux*l),y:clamp(a.y+uy*l)};
  return next;
}

export const GUIDE_PRESETS:{name:string;guide:GuideChain}[]=[
  {name:"متموج",guide:DEFAULT_GUIDE},
  {name:"قوس علوي",guide:[{x:90,y:70},{x:75,y:5},{x:25,y:5},{x:10,y:70}]},
  {name:"قوس سفلي",guide:[{x:90,y:30},{x:75,y:95},{x:25,y:95},{x:10,y:30}]},
  {name:"قطري",guide:[{x:90,y:15},{x:65,y:35},{x:35,y:65},{x:10,y:85}]},
];


/** Translate complete word groups along a guide in explicit selection order.
 * Optional rigid rotation uses a stable reference glyph, so repeated application
 * does not accumulate rotation. Explicitly transformed attached marks are
 * preserved by the caller when committing the batch.
 */
export function composeWordGroupsOnPath(items:LetteringItem[],groupIds:string[],guide:GuideChain,options:FreePathOptions):LetteringPatchEntry[]{
  const ids=[...new Set(groupIds)];
  if(ids.length<2||ids.length>30||!Number.isFinite(options.scale))return [];
  const groups=ids.map(id=>items.filter(g=>g.groupId===id));
  const metrics=groups.map(group=>{
    const visible=group.filter(g=>!g.hidden&&(g.kind==="outline"||g.kind==="text"));
    if(!visible.length||visible.some(g=>g.kind!=="outline"||!g.pathData))return null;
    const bounds=visible.map(preciseGlyphBounds);
    if(bounds.some(b=>!b))return null;
    const left=Math.min(...bounds.map(b=>b!.x)),right=Math.max(...bounds.map(b=>b!.x+b!.width));
    const top=Math.min(...bounds.map(b=>b!.y)),bottom=Math.max(...bounds.map(b=>b!.y+b!.height));
    return {x:(left+right)/2,y:(top+bottom)/2,diameter:Math.hypot(right-left,bottom-top)};
  });
  if(metrics.some(m=>!m||!Number.isFinite(m.diameter)||m.diameter<=0))return [];
  const samples=sampleGuide(guide,ids.length,options.margin,options.reverse);
  if(samples.length!==ids.length)return [];
  const cx=metrics.reduce((s,m)=>s+m!.x,0)/ids.length,cy=metrics.reduce((s,m)=>s+m!.y,0)/ids.length;
  const mx=samples.reduce((s,p)=>s+p.point.x,0)/ids.length,my=samples.reduce((s,p)=>s+p.point.y,0)/ids.length;
  const scale=Math.max(...metrics.map(m=>m!.diameter))*ids.length/100*Math.max(.5,Math.min(3,options.scale));
  const patches:LetteringPatchEntry[]=[];
  const processed=new Set<string>();
  const normal=(angle:number)=>((angle+180)%360+360)%360-180;
  for(let i=0;i<groups.length;i++){
    const center=metrics[i]!;
    const tx=cx+(samples[i]!.point.x-mx)*scale,ty=cy+(samples[i]!.point.y-my)*scale;
    const group=groups[i]!;
    const reference=group.filter(g=>!g.hidden&&g.kind==="outline").sort((a,b)=>(a.glyphIndex??Number.MAX_SAFE_INTEGER)-(b.glyphIndex??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id))[0];
    if(!reference)return [];
    let target=normal(samples[i]!.angle);
    if(options.upright){if(target>90)target-=180;else if(target< -90)target+=180;}
    const delta=options.tangent?normal(target-reference.rotation):0;
    const radians=delta*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
    if(![tx,ty,delta].every(Number.isFinite))return [];
    const anchors=new Set(group.filter(g=>g.kind==="outline").map(g=>g.id));
    const members=[...group.filter(g=>!(g.kind==="haraka"&&g.attachedToGlyphId&&!anchors.has(g.attachedToGlyphId))),
      ...items.filter(g=>g.kind==="haraka"&&g.attachedToGlyphId&&anchors.has(g.attachedToGlyphId)&&!group.some(q=>q.id===g.id))];
    for(const g of members){
      if(processed.has(g.id)||g.kind==="bridge")continue;
      processed.add(g.id);
      if(![g.x,g.y,g.rotation].every(Number.isFinite))return [];
      const x=g.x-center.x,y=g.y-center.y;
      const patch:Partial<LetteringItem>={x:tx+x*cos-y*sin,y:ty+x*sin+y*cos};
      if(options.tangent)patch.rotation=normal(g.rotation+delta);
      // Auto placement is artboard-oriented, not word-local. Preserve the
      // rotated position by switching attached marks to manual only on rotation.
      if(g.kind==="haraka"&&g.attachedToGlyphId)patch.anchorMode=options.tangent&&Math.abs(delta)>1e-8?"manual":g.anchorMode??"auto";
      patches.push({id:g.id,patch});
    }
  }
  return patches;
}
