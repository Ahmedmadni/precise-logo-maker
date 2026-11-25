import polygonClipping, { type Geom } from "polygon-clipping";
import type { LetteringItem } from "./model";
import { parseOutline, glyphPointToWorld } from "./pathEditor";
import { buildRibbonPath } from "./ribbonJoin";
import { analyzeRibbonSafety } from "./ribbonSafety";

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

type ChainResult = {ok:true; glyphs:LetteringItem[]; ribbons:LetteringItem[]} |
  {ok:false; reason:string};
const chainError=(reason:string):ChainResult=>({ok:false,reason});

/** The connected component around the chosen bridge must be a simple path,
 * never a cycle, parallel duplicate or junction. Source outlines are untouched.
 */
function resolveRibbonChain(items:LetteringItem[],bridgeId:string):ChainResult{
  const selected=items.find(x=>x.id===bridgeId);
  if(selected?.kind!=="bridge"||!selected.ribbon)
    return chainError("حدد وصلة منحنية صحيحة أولاً");
  const links=items.filter(x=>x.kind==="bridge"&&x.ribbon);
  const byGlyph=new Map<string,LetteringItem[]>();
  for(const link of links){
    const spec=link.ribbon!;
    for(const id of [spec.sourceGlyphId,spec.targetGlyphId]){
      const connections=byGlyph.get(id)??[];
      connections.push(link);byGlyph.set(id,connections);
    }
  }
  const ribbonIds=new Set<string>(),glyphIds=new Set<string>();
  const pending=[selected];
  while(pending.length){
    const next=pending.pop()!;
    if(ribbonIds.has(next.id))continue;
    ribbonIds.add(next.id);
    if(ribbonIds.size>24)return chainError("السلسلة كبيرة جدًا؛ قسّمها إلى مجموعات أصغر");
    const spec=next.ribbon!;
    if(!spec.sourceGlyphId||!spec.targetGlyphId||
       spec.sourceGlyphId===spec.targetGlyphId)
      return chainError("إحدى الوصلات غير صالحة أو تربط الحرف بنفسه");
    for(const id of [spec.sourceGlyphId,spec.targetGlyphId]){
      glyphIds.add(id);
      if(glyphIds.size>25)return chainError("عدد الحروف أكبر من الحد الآمن");
      for(const adjacent of byGlyph.get(id)??[])
        if(!ribbonIds.has(adjacent.id))pending.push(adjacent);
    }
  }
  const ribbons=links.filter(x=>ribbonIds.has(x.id));
  const glyphMap=new Map<string,LetteringItem>();
  for(const id of glyphIds){
    const glyph=items.find(x=>x.id===id&&x.kind==="outline");
    if(!glyph)return chainError("أحد الحروف الأصلية غير موجود");
    glyphMap.set(id,glyph);
  }
  if(ribbons.length!==glyphMap.size-1)
    return chainError("لا يمكن دمج دائرة أو وصلات متكررة؛ يلزم مسار حروف متسلسل");
  const endpoints=Array.from(glyphMap.values()).filter(g=>(byGlyph.get(g.id)?.length??0)===1);
  if(endpoints.length!==2||
     Array.from(glyphMap.values()).some(g=>(byGlyph.get(g.id)?.length??0)>2))
    return chainError("توجد وصلة متفرعة أو متكررة؛ يلزم سلسلة دون تفرعات");
  const start=endpoints.find(g=>!ribbons.some(r=>r.ribbon!.targetGlyphId===g.id))??endpoints[0]!;
  const orderedGlyphs:LetteringItem[]=[start];
  const orderedLinks:LetteringItem[]=[];
  const seen=new Set([start.id]);
  let cursor=start.id,previous="";
  while(true){
    const options=(byGlyph.get(cursor)??[]).filter(r=>r.id!==previous);
    if(!options.length)break;
    if(options.length!==1)return chainError("توجد وصلة متفرعة عند الحرف المحدد");
    const ribbon=options[0]!,spec=ribbon.ribbon!;
    const id=spec.sourceGlyphId===cursor?spec.targetGlyphId:spec.sourceGlyphId;
    if(seen.has(id))return chainError("لا يمكن دمج وصلات دائرية");
    const glyph=glyphMap.get(id);
    if(!glyph)return chainError("تعذر العثور على الحرف التالي");
    orderedLinks.push(ribbon);orderedGlyphs.push(glyph);
    seen.add(id);previous=ribbon.id;cursor=id;
  }
  if(orderedGlyphs.length!==glyphMap.size||orderedLinks.length!==ribbons.length)
    return chainError("السلسلة ليست مسارًا متصلًا صالحًا");
  return {ok:true,glyphs:orderedGlyphs,ribbons:orderedLinks};
}
export function inspectRibbonChain(items:LetteringItem[],bridgeId:string):
  {ok:true;glyphCount:number;ribbonCount:number}|{ok:false;reason:string}{
  const result=resolveRibbonChain(items,bridgeId);
  if(!result.ok)return result;
  return {ok:true,glyphCount:result.glyphs.length,ribbonCount:result.ribbons.length};
}

/** Boolean-unite all glyphs and ribbons in one safe nonbranching component.
 * Original layers, Bézier controls, marks and their anchors survive in .logo.
 */
export function bakeRibbonAsOutline(items:LetteringItem[],bridgeId:string):BakeResult{
  const chain=resolveRibbonChain(items,bridgeId);
  if(!chain.ok)return chain;
  const {glyphs,ribbons}=chain;
  const sources=[...glyphs,...ribbons];
  if(sources.some(item=>item.hidden))
    return {ok:false,reason:"أظهر جميع الحروف والوصلات في السلسلة أولاً"};
  if(glyphs.some(g=>(g.weight??0)!==0))
    return {ok:false,reason:"أزل السُمك الإضافي Stroke من جميع الحروف قبل الدمج"};
  if(sources.some(item=>item.color.toLowerCase()!==glyphs[0]!.color.toLowerCase()))
    return {ok:false,reason:"يجب توحيد لون جميع الحروف والوصلات في السلسلة"};
  const glyphGeometry=new Map<string,Geom>();
  for(const glyph of glyphs){
    const geo=filledGlyph(glyph);
    if(!geo)return {ok:false,reason:"تعذر تحويل أحد الحروف إلى حدود متجهة سليمة"};
    glyphGeometry.set(glyph.id,geo);
  }
  const linkGeometry:Geom[]=[];
  for(const link of ribbons){
    const spec=link.ribbon!;
    const safety=analyzeRibbonSafety(link,items);
    if(!safety)return {ok:false,reason:"تعذر فحص هندسة إحدى الوصلات"};
    if(safety.edgeCrossings>0)
      return {ok:false,reason:"فحص الوصلة رصد تقاطعًا في حوافها؛ اضبط سُمكها أو انحناءها أولًا، ثم حاول الدمج مجددًا"};
    const geo=filledRibbon(link,items);
    if(!geo)return {ok:false,reason:"تعذر تحويل إحدى الوصلات إلى مضلع سليم"};
    try{
      const a=glyphGeometry.get(spec.sourceGlyphId)!;
      const b=glyphGeometry.get(spec.targetGlyphId)!;
      if(polygonArea(intersection(a,geo))<0.05 ||
         polygonArea(intersection(b,geo))<0.05)
        return {ok:false,reason:"إحدى الوصلات لا تتداخل فعليًا مع طرفي حرفيها؛ زِد التداخل أولاً"};
    }catch{
      return {ok:false,reason:"تعذر فحص تداخل الوصلة مع الحروف؛ لم يتغير المشروع"};
    }
    linkGeometry.push(geo);
  }
  try{
    const shapes=[...glyphs.map(g=>glyphGeometry.get(g.id)!),...linkGeometry];
    const first=shapes[0],second=shapes[1];
    if(!first||!second)return {ok:false,reason:"لا توجد أشكال كافية للدمج"};
    const merged=union(first,second,...shapes.slice(2)) as number[][][][];
    const path=merged.flatMap(poly=>poly.map(ring=>{
      const vertices=ring.slice(0,-1);
      if(vertices.length<3)return"";
      return "M "+vertices.map(([x,y],i)=>
        (i?"L ":"")+format(x!)+" "+format(-y!)).join(" ")+" Z";
    })).filter(Boolean).join(" ");
    if(!path||path.length>500000)
      return {ok:false,reason:"المسار الناتج كبير جدًا؛ قسّم الحروف إلى مجموعات أصغر"};
    const sourceIds=sources.map(x=>x.id);
    return {ok:true,sourceIds,
      outline:{id:"weld-"+crypto.randomUUID(),kind:"outline",x:0,y:0,
        size:1000,unitsPerEm:1000,rotation:0,color:glyphs[0]!.color,
        fillRule:"evenodd",pathData:path,
        sourceText:"شكل موحد - "+(glyphs[0]!.sourceText??"خط عربي"),
        bakedSourceIds:sourceIds}};
  }catch{return {ok:false,reason:"فشل دمج هذه السلسلة هندسيًا؛ لم يتغير المشروع"};}
}


export type InkIntersection={a:string;b:string;area:number;ratio:number;path:string};
export type InkAnalysis={pairs:InkIntersection[];checked:number;skipped:number;limited:boolean};
export const INK_CURVE_TOLERANCE=CURVE_TOLERANCE;

/** Compare filled outlines without changing the document. Reuse the existing
 * winding-aware flattening pipeline, cache each outline for this calculation
 * and bound work for tablet responsiveness. Stroke-weighted outlines are
 * unsupported and counted as skipped, never as clear. */
export function analyzeGlyphInk(items:LetteringItem[],candidates:readonly {a:string;b:string}[]):InkAnalysis{
  const result:InkAnalysis={pairs:[],checked:0,skipped:0,limited:false};
  const byId=new Map(items.map(i=>[i.id,i]));
  const cache=new Map<string,{geom:Geom;area:number}|null>();
  const get=(id:string)=>{
    if(cache.has(id))return cache.get(id)??null;
    const item=byId.get(id);
    const geom=item&&!item.hidden?filledGlyph(item):null;
    const value=geom?{geom,area:polygonArea(geom)}:null;
    const valid=value&&Number.isFinite(value.area)&&value.area>0?value:null;
    cache.set(id,valid);return valid;
  };
  for(const pair of candidates){
    if(result.checked+result.skipped>=120||cache.size+new Set([pair.a,pair.b].filter(id=>!cache.has(id))).size>40){result.limited=true;break;}
    try{
      const a=get(pair.a),b=get(pair.b);
      if(!a||!b){result.skipped++;continue;}
      const geo=intersection(a.geom,b.geom);
      const size=polygonArea(geo);
      if(!Number.isFinite(size)){result.skipped++;continue;}
      if(size>0.01){
        const path=(geo as number[][][][]).flatMap(poly=>poly.map(r=>r.slice(0,-1).map(([x,y],i)=>(i?"L ":"M ")+format(x!)+" "+format(y!)).join(" ")+" Z")).join(" ");
        if(path.length>100000){result.skipped++;continue;}
        result.pairs.push({a:pair.a,b:pair.b,area:size,ratio:Math.min(1,size/Math.min(a.area,b.area)),path});
      }
      result.checked++;
    }catch{result.skipped++;}
  }
  result.pairs.sort((a,b)=>b.area-a.area);
  return result;
}


export type InkBalance={ok:true;area:number;centroid:Point;bounds:{minX:number;minY:number;maxX:number;maxY:number};quadrants:[number,number,number,number];density:number}|{ok:false;reason:"selection"|"unsupported"|"complexity"};

/** Measure the union of filled glyphs so overlapping ink is counted once.
 * Quadrants are top-left, top-right, bottom-left, bottom-right, split at
 * the union's bounding-box center. Holes subtract both area and moments. */
export function analyzeInkBalance(items:LetteringItem[],ids:readonly string[]):InkBalance{
  const selected=new Set(ids);
  if(!selected.size||selected.size>20)return {ok:false,reason:"selection"};
  const targets=items.filter(i=>selected.has(i.id)&&!i.hidden&&i.kind==="outline");
  if(targets.length!==selected.size||targets.some(i=>!i.pathData||i.pathData.length>30000||(i.weight??0)!==0))return {ok:false,reason:"unsupported"};
  try{
    const geoms=targets.map(filledGlyph);
    if(geoms.some(g=>!g))return {ok:false,reason:"unsupported"};
    const valid=geoms.filter((g):g is Geom=>!!g);
    const geo=union(valid[0]!,...valid.slice(1));
    let mass=0,mx=0,my=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,count=0;
    for(const poly of geo)for(let j=0;j<poly.length;j++){
      const ring=poly[j]!;
      let twice=0,cx=0,cy=0;
      for(let k=0;k<ring.length-1;k++){
        const a=ring[k]!,b=ring[k+1]!,cross=a[0]*b[1]-b[0]*a[1];
        twice+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;
        minX=Math.min(minX,a[0]);minY=Math.min(minY,a[1]);maxX=Math.max(maxX,a[0]);maxY=Math.max(maxY,a[1]);
        if(++count>40000)return {ok:false,reason:"complexity"};
      }
      if(Math.abs(twice)<=1e-9)continue;
      const signed=(j===0?1:-1)*Math.abs(twice)/2;
      mass+=signed;mx+=signed*cx/(3*twice);my+=signed*cy/(3*twice);
    }
    const width=maxX-minX,height=maxY-minY;
    if(![mass,mx,my,width,height].every(Number.isFinite)||mass<=0||width<=0||height<=0)return {ok:false,reason:"unsupported"};
    const x=(minX+maxX)/2,y=(minY+maxY)/2;
    const part=(x1:number,y1:number,x2:number,y2:number)=>polygonArea(intersection(geo,single([{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}])))/mass;
    const quadrants:[number,number,number,number]=[part(minX,minY,x,y),part(x,minY,maxX,y),part(minX,y,x,maxY),part(x,y,maxX,maxY)];
    return {ok:true,area:mass,centroid:{x:mx/mass,y:my/mass},bounds:{minX,minY,maxX,maxY},quadrants,density:mass/(width*height)};
  }catch{return {ok:false,reason:"complexity"};}
}
