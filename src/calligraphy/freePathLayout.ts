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
