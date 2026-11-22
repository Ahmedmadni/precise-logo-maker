import type { LetteringItem } from "./model";
import { worldJoinAnchor, outlineContours, type JoinSide } from "./contourComposer";
import { selectJoiningContour } from "./joinAnchorGeometry";
import { glyphPointToWorld, parseOutline } from "./pathEditor";
import { isValidRibbon, type RibbonLink } from "./ribbonJoin";
import { analyzeRibbonSafety } from "./ribbonSafety";

type Point = { x: number; y: number };
const diff=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
const len=(a:Point)=>Math.hypot(a.x,a.y);
const at=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const valid=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
const bezier=(pts:Point[],t:number):Point=>{
  let level=pts;
  while(level.length>1)level=level.slice(0,-1).map((p,i)=>at(p,level[i+1]!,t));
  return level[0]!;
};

/** The selected single body/join contour, in world coordinates; not dots. */
function boundary(glyph:LetteringItem,side:JoinSide):Point[]|null{
  if(!glyph.pathData)return null;
  const contours=outlineContours(glyph.pathData);
  const choice=selectJoiningContour(contours,glyph.contourRoles,side);
  const path=choice&&contours[choice.contourIndex]?.path;
  if(!path)return null;
  const cmds=parseOutline(path);
  if(!cmds||cmds.length>900)return null;
  const points:Point[]=[];
  const world=(p:Point)=>glyphPointToWorld(glyph,p.x,p.y);
  let cursor:Point={x:0,y:0},origin=cursor,closed=false;
  for(const cmd of cmds){
    const v=cmd.values;
    if(cmd.cmd==="M"){
      cursor={x:v[0]!,y:v[1]!};origin=cursor;points.push(world(cursor));
    }else if(cmd.cmd==="L"||cmd.cmd==="Z"){
      const end=cmd.cmd==="Z"?origin:{x:v[0]!,y:v[1]!};
      const a=world(cursor),b=world(end);
      const n=Math.min(24,Math.max(1,Math.ceil(len(diff(b,a))/8)));
      for(let i=1;i<=n;i++)points.push(at(a,b,i/n));
      cursor=end;
      if(cmd.cmd==="Z")closed=true;
    }else if(cmd.cmd==="Q"||cmd.cmd==="C"){
      const handles:Point[]=cmd.cmd==="Q"
        ? [{x:v[0]!,y:v[1]!},{x:v[2]!,y:v[3]!}]
        : [{x:v[0]!,y:v[1]!},{x:v[2]!,y:v[3]!},{x:v[4]!,y:v[5]!}];
      const pts=[world(cursor),...handles.map(world)];
      for(let i=1;i<=24;i++)points.push(bezier(pts,i/24));
      cursor=handles.at(-1)!;
    }
    if(points.length>4500)return null;
  }
  if(!closed||points.length<4||points.some(p=>!valid(p)))return null;
  if(len(diff(points[0]!,points.at(-1)!))>1e-5)points.push(points[0]!);
  return points;
}
function contained(p:Point,polygon:Point[]):boolean{
  let inside=false;
  for(let i=0;i<polygon.length-1;i++){
    const a=polygon[i]!,b=polygon[i+1]!;
    if((a.y>p.y)!==(b.y>p.y) &&
       p.x<a.x+(p.y-a.y)*(b.x-a.x)/(b.y-a.y))inside=!inside;
  }
  return inside;
}
function nearestEdge(p:Point,poly:Point[]){
  let best:{point:Point;tangent:Point;distance:number}|null=null;
  let ambiguous=false;
  for(let i=0;i<poly.length-1;i++){
    const a=poly[i]!,b=poly[i+1]!,v=diff(b,a),l2=dot(v,v);
    if(l2<1e-12)continue;
    const t=Math.min(1,Math.max(0,dot(diff(p,a),v)/l2));
    const q=at(a,b,t),distance=len(diff(p,q));
    const tangent={x:v.x/Math.sqrt(l2),y:v.y/Math.sqrt(l2)};
    if(!best||distance<best.distance-0.04){
      best={point:q,tangent,distance};ambiguous=false;
    }else if(best&&Math.abs(distance-best.distance)<0.04&&
      Math.abs(dot(tangent,best.tangent))<0.9)ambiguous=true;
  }
  return ambiguous?null:best;
}
function crossSection(p:Point,d:Point,poly:Point[]):number|null{
  const normal={x:-d.y,y:d.x},values:number[]=[];
  for(let i=0;i<poly.length-1;i++){
    const a=diff(poly[i]!,p),b=diff(poly[i+1]!,p);
    const u=dot(a,d),v=dot(b,d);
    if((u<=0&&v>0)||(v<=0&&u>0)){
      const q=at(a,b,-u/(v-u));
      values.push(dot(q,normal));
    }
  }
  values.sort((a,b)=>a-b);
  for(let i=0;i+1<values.length;i+=2){
    const a=values[i]!,b=values[i+1]!;
    if(a<=0.01&&b>=-0.01&&b-a>0.5)return b-a;
  }
  return null;
}
export interface CapMeasurement {
  width:number;
  angle:number;
  contourDistance:number;
}
export interface RibbonCapFit {
  ribbon:RibbonLink;
  start:CapMeasurement|null;
  end:CapMeasurement|null;
  changes:string[];
}

/** Conservative opt-in cap matching. Reject ambiguous corners, off-contour
 * markers and candidate ribbons that worsen sampled safety diagnostics. */
export function suggestRibbonCapFit(bridge:LetteringItem,all:LetteringItem[]):RibbonCapFit|null{
  const spec=bridge.ribbon;
  if(bridge.kind!=="bridge"||!spec||!isValidRibbon(spec))return null;
  const source=all.find(x=>x.id===spec.sourceGlyphId&&x.kind==="outline");
  const target=all.find(x=>x.id===spec.targetGlyphId&&x.kind==="outline");
  if(!source||!target)return null;
  const a=worldJoinAnchor(source,spec.sourceSide);
  const b=worldJoinAnchor(target,spec.targetSide);
  if(!a||!b)return null;
  const chord=diff(b,a),distance=len(chord);
  if(distance<2||distance>20000)return null;
  const dir={x:chord.x/distance,y:chord.y/distance};
  const measure=(glyph:LetteringItem,side:JoinSide,anchor:Point,start:boolean):CapMeasurement|null=>{
    const poly=boundary(glyph,side);
    if(!poly)return null;
    const edge=nearestEdge(anchor,poly);
    if(!edge||edge.distance>Math.min(8,Math.max(1.5,glyph.size*0.025)))return null;
    const n={x:-edge.tangent.y,y:edge.tangent.x};
    const sign=dot(n,dir)>=0?1:-1;
    const oriented={x:n.x*sign,y:n.y*sign},along=dot(oriented,dir);
    if(along<Math.cos(70*Math.PI/180))return null;
    const inset=Math.min(8,Math.max(1.5,glyph.size*0.025));
    const cut={x:edge.point.x+dir.x*inset*(start?-1:1),
      y:edge.point.y+dir.y*inset*(start?-1:1)};
    if(!contained(cut,poly))return null;
    const width=crossSection(cut,dir,poly);
    if(width===null||width<0.8||width>150)return null;
    const angle=Math.atan2(dir.x*oriented.y-dir.y*oriented.x,along)*180/Math.PI;
    return {width:Number(width.toFixed(3)),angle:Number(angle.toFixed(2)),
      contourDistance:Number(edge.distance.toFixed(3))};
  };
  const start=measure(source,spec.sourceSide,a,true);
  const end=measure(target,spec.targetSide,b,false);
  if(!start&&!end)return null;
  const ribbon:RibbonLink={...spec,
    ...(start?{startWidth:start.width,startAngle:start.angle}:{}),
    ...(end?{endWidth:end.width,endAngle:end.angle}:{})};
  if(!isValidRibbon(ribbon))return null;
  const changes:string[]=[];
  if(start&&(Math.abs(spec.startWidth-start.width)>0.05||
    Math.abs((spec.startAngle??0)-start.angle)>0.25))changes.push("بداية الوصلة");
  if(end&&(Math.abs(spec.endWidth-end.width)>0.05||
    Math.abs((spec.endAngle??0)-end.angle)>0.25))changes.push("نهاية الوصلة");
  if(!changes.length)return null;
  const before=analyzeRibbonSafety(bridge,all);
  const after=analyzeRibbonSafety({...bridge,ribbon},all);
  if(!before||!after||after.edgeCrossings>before.edgeCrossings||
    after.sharpTurns>before.sharpTurns||
    after.widthRatio>Math.max(0.85,before.widthRatio*1.2))return null;
  return {ribbon,start,end,changes};
}
