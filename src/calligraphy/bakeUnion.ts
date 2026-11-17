import polygonClipping, { type Geom } from "polygon-clipping";
import type { LetteringItem } from "./model";
import { parseOutline, glyphPointToWorld } from "./pathEditor";
import { buildRibbonPath } from "./ribbonJoin";

type Point = { x: number; y: number };
type Ring = { points: Point[]; area: number; bbox: [number, number, number, number]; parent: number; winding: number; depth: number };
const { union, difference, intersection } = polygonClipping;
const CURVE_TOLERANCE = 0.55; // artboard pixels; output is outlined polylines, not original Bézier controls.
const MAX_POINTS = 18000;
const MAX_CONTOURS = 100;
const format = (n: number) => Number(n.toFixed(3)).toString();
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
const linear = (a: Point,b:Point,t:number): Point => ({ x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t });
const area = (points: Point[]) => points.reduce((total,p,i) => {
  const n=points[(i+1)%points.length]!; return total + p.x*n.y-n.x*p.y;
},0)/2;
const safe = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
  Math.abs(p.x)<=100000 && Math.abs(p.y)<=100000;
const pointSegmentDistance = (p: Point,a: Point,b: Point) => {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=(dx*dx+dy*dy)>0?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))):0;
  return dist(p,{x:a.x+dx*t,y:a.y+dy*t});
};
/** Recursive de Casteljau subdivision bounds curve error in artboard pixels. */
function flattenBezier(points: Point[], add: (point: Point)=>void, depth=0): void {
  const first=points[0]!,last=points.at(-1)!;
  if(depth>=10 || points.slice(1,-1).every(p=>pointSegmentDistance(p,first,last)<=CURVE_TOLERANCE)){
    add(last);return;
  }
  const left=[first],right=[last];
  let level=points;
  while(level.length>1){
    level=level.slice(0,-1).map((p,i)=>midpoint(p,level[i+1]!));
    left.push(level[0]!);right.unshift(level.at(-1)!);
  }
  flattenBezier(left,add,depth+1);flattenBezier(right,add,depth+1);
}

function flattenSvg(path: string, map: (x:number,y:number)=>Point): Point[][] | null {
  const segments=parseOutline(path);
  if(!segments) return null;
  const rings: Point[][]=[];
  let current:Point[]=[];let pen:Point={x:0,y:0};let origin:Point={x:0,y:0};
  let count=0;
  const add=(p:Point)=>{if(!safe(p)) throw Error("Invalid contour coordinate");
    if(!current.length||dist(current.at(-1)!,p)>0.005) current.push(p);
    if(++count>MAX_POINTS)throw Error("Too many outline nodes");};
  try{
    for(const seg of segments){
      const v=seg.values;
      if(seg.cmd==="M"){
        if(current.length) return null; // filled paths must close each contour
        origin=map(v[0]!,v[1]!);pen=origin;add(origin);
      }else if(seg.cmd==="L"){
        pen=map(v[0]!,v[1]!);add(pen);
      }else if(seg.cmd==="Q"){
        const c=map(v[0]!,v[1]!),to=map(v[2]!,v[3]!);
        flattenBezier([pen,c,to],add);pen=to;
      }else if(seg.cmd==="C"){
        const c1=map(v[0]!,v[1]!),c2=map(v[2]!,v[3]!),to=map(v[4]!,v[5]!);
        flattenBezier([pen,c1,c2,to],add);pen=to;
      }else if(seg.cmd==="Z"){
        if(current.length>2) {
          if(dist(current.at(-1)!,origin)<0.005)current.pop();
          if(current.length>=3 && Math.abs(area(current))>0.01) rings.push(current);
        }
        current=[];pen=origin;
        if(rings.length>MAX_CONTOURS)return null;
      }
    }
    if(current.length)return null;
    return rings;
  }catch{return null;}
}

function inside(p:Point,ring:Point[]):boolean{
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i]!,b=ring[j]!;
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) result=!result;
  }
  return result;
}
const coords=(points:Point[])=>[...points.map(p=>[Number(p.x.toFixed(3)),Number(p.y.toFixed(3))] as [number,number]),
  [Number(points[0]!.x.toFixed(3)),Number(points[0]!.y.toFixed(3))] as [number,number]];
const single=(points:Point[]):Geom=>[[coords(points)]];

/** Preserve non-zero-winding holes (the default OpenType/SVG fill rule).
 * For baked outlines, use even-odd on the resulting clipper rings. */
function filledGlyph(item:LetteringItem): Geom | null {
  if(item.kind!=="outline"||!item.pathData || (item.weight??0)!==0)return null;
  const contours=flattenSvg(item.pathData,(x,y)=>glyphPointToWorld(item,x,y));
  if(!contours?.length)return null;
  const rings:Ring[]=contours.map(points=>{
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    return {points,area:area(points),
      bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)] as [number,number,number,number],
      parent:-1,winding:0,depth:0};
  }).sort((a,b)=>Math.abs(b.area)-Math.abs(a.area));
  let result:Geom|null=null;
  try {
    for(let i=0;i<rings.length;i++){
      const ring=rings[i]!;
      for(let j=i-1;j>=0;j--){
        const candidate=rings[j]!,a=candidate.bbox,b=ring.bbox;
        if(a[0]<=b[0]&&a[1]<=b[1]&&a[2]>=b[2]&&a[3]>=b[3]&&
          inside(ring.points[0]!,candidate.points)){
          if(ring.parent<0||Math.abs(candidate.area)<Math.abs(rings[ring.parent]!.area)) ring.parent=j;
        }
      }
      const parent=ring.parent>=0 ? rings[ring.parent]! : null;
      ring.depth=parent?parent.depth+1:0;
      const old=parent?.winding??0;
      const next=old+Math.sign(ring.area);
      ring.winding=next;
      const evenOdd=item.fillRule==="evenodd";
      const include=evenOdd?ring.depth%2===0:old===0&&next!==0;
      const exclude=evenOdd?ring.depth%2===1:old!==0&&next===0;
      if(include)result=result?union(result,single(ring.points)):single(ring.points);
      else if(exclude && result)result=difference(result,single(ring.points));
    }
  }catch{return null;}
  return result;
}
function filledRibbon(item: LetteringItem, all:LetteringItem[]):Geom|null {
  const path=buildRibbonPath(item,all);
  if(!path)return null;
  const rings=flattenSvg(path,(x,y)=>({x,y}));
  if(!rings?.length)return null;
  try{return rings.slice(1).reduce<Geom>((result,ring)=>union(result,single(ring)),single(rings[0]!));}
  catch{return null;}
}
function polygonArea(geom:Geom):number{
  const polygons=geom as number[][][][];
  return polygons.reduce((sum,poly)=>sum+poly.reduce((part,ring,i)=>{
    const points=ring.map((point)=>({x:point[0]!,y:point[1]!}));
    return part+(i===0?1:-1)*Math.abs(area(points));
  },0),0);
}

export type BakeResult = { ok:true; outline:LetteringItem; sourceIds:string[] } |
  {ok:false; reason:string};

/**
 * Boolean-unite two glyphs with their selected curved ribbon.
 * Never modify source paths. The original triple is hidden by the store in
 * ONE undoable transaction. The new outline is flat world geometry.
 */
export function bakeRibbonAsOutline(items:LetteringItem[],bridgeId:string):BakeResult {
  const bridge=items.find(x=>x.id===bridgeId);
  if(bridge?.kind!=="bridge"||!bridge.ribbon)return{ok:false,reason:"حدد وصلة منحنية صحيحة أولاً"};
  const s=items.find(x=>x.id===bridge.ribbon!.sourceGlyphId);
  const t=items.find(x=>x.id===bridge.ribbon!.targetGlyphId);
  if(!s||!t||s.kind!=="outline"||t.kind!=="outline")return{ok:false,reason:"أحد الحرفين الأصليين غير موجود"};
  if(s.hidden||t.hidden||bridge.hidden)return{ok:false,reason:"أظهر الحرفين والوصلة أولاً"};
  if([s,t].some(g=>(g.weight??0)>0))return{ok:false,reason:"أزل السُمك الإضافي Stroke من الحروف قبل الدمج"};
  if(s.color.toLowerCase()!==t.color.toLowerCase()||
     s.color.toLowerCase()!==bridge.color.toLowerCase())
    return{ok:false,reason:"يجب توحيد لون الحرفين والوصلة قبل دمجهم في شكل واحد"};
  if(items.some(x=>x.kind==="bridge"&&x.id!==bridge.id &&
    (x.ribbon?.sourceGlyphId===s.id||x.ribbon?.targetGlyphId===s.id||
     x.ribbon?.sourceGlyphId===t.id||x.ribbon?.targetGlyphId===t.id)))
    return{ok:false,reason:"هذان الحرفان مرتبطان بوصلات أخرى؛ ادمج كل مجموعة في مرحلة مستقلة"};
  const a=filledGlyph(s),b=filledGlyph(t),join=filledRibbon(bridge,items);
  if(!a||!b||!join)return{ok:false,reason:"تعذر تحويل المسارات إلى مضلعات سليمة. راجع الحروف ونقاط الوصلة"};
  try{
    if(polygonArea(intersection(a,join))<0.05||polygonArea(intersection(b,join))<0.05)
      return{ok:false,reason:"الوصلة لا تتقاطع فعليًا مع الحرفين؛ زِد التداخل عند طرفيها أولاً"};
    const merged=union(a,b,join) as number[][][][];
    const path=merged.flatMap(poly=>poly.map(ring=>{
      const vertices=ring.slice(0,-1);
      if(vertices.length<3)return"";
      return "M "+vertices.map(([x,y],i)=>`${i?"L ":""}${format(x!)} ${format(-y!)}`).join(" ")+" Z";
    })).filter(Boolean).join(" ");
    if(!path || path.length>500000)return{ok:false,reason:"الشكل الناتج كبير جدًا؛ قلل تعقيد الحروف قبل الدمج"};
    return{ok:true,sourceIds:[s.id,t.id,bridge.id],
      outline:{id:`weld-${crypto.randomUUID()}`,kind:"outline",x:0,y:0,
        size:1000,unitsPerEm:1000,rotation:0,color:s.color,fillRule:"evenodd",
        pathData:path,sourceText:"شكل موحد - "+(s.sourceText??"خط عربي"),
        bakedSourceIds:[s.id,t.id,bridge.id]}};
  }catch{return{ok:false,reason:"تعذرت العملية الهندسية لهذه المسارات؛ لم يتم تغيير المشروع"};}
}
