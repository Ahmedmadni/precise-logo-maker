import type { PathGeometry, Point } from "../core/geometry/types";

const mid=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});

/** Move the node and its adjacent handles together to retain local tangents. */
export function movePathNode(path:PathGeometry,index:number,point:Point):PathGeometry{
  const old=path.points[index];
  if(!Number.isInteger(index)||!old||![point.x,point.y].every(Number.isFinite))return path;
  const points=path.points.map((p,i)=>i===index?point:p);
  if(!path.cubicSegments)return {...path,points};
  const dx=point.x-old.x,dy=point.y-old.y;
  const shift=(p:Point)=>({x:p.x+dx,y:p.y+dy});
  const previous=index>0?index-1:path.closed?path.points.length-1:-1;
  const cubicSegments=path.cubicSegments.map((c,i)=>c?{
    control1:i===index?shift(c.control1):c.control1,
    control2:i===previous?shift(c.control2):c.control2,
  }:null);
  return {...path,points,cubicSegments};
}

/** Insert at t=0.5. De Casteljau subdivision preserves the original cubic. */
export function insertPathNode(path: PathGeometry, index: number): PathGeometry {
  const a = path.points[index];
  const b = path.points[index + 1] ?? (path.closed ? path.points[0] : undefined);
  if (!Number.isInteger(index) || !a || !b) return path;
  const points = [...path.points];
  if(!path.cubicSegments){
    points.splice(index+1,0,mid(a,b));
    return {...path,points};
  }
  const cubicSegments=Array.from({length:path.points.length},(_,i)=>path.cubicSegments?.[i]??null);
  const c=cubicSegments[index];
  if(c){
    const ab=mid(a,c.control1),bc=mid(c.control1,c.control2),cd=mid(c.control2,b);
    const abc=mid(ab,bc),bcd=mid(bc,cd);
    points.splice(index+1,0,mid(abc,bcd));
    cubicSegments.splice(index,1,{control1:ab,control2:abc},{control1:bcd,control2:cd});
  }else{
    points.splice(index+1,0,mid(a,b));
    cubicSegments.splice(index,1,null,null);
  }
  return {...path,points,cubicSegments};
}

/** Delete a node without shifting the controls of unrelated edges.
 * The replacement edge is intentionally linear, not a guessed curve. */
export function deletePathNode(path: PathGeometry, index: number): PathGeometry {
  if (!Number.isInteger(index) || !path.points[index] || path.points.length <= (path.closed ? 3 : 2)) return path;
  const points=path.points.filter((_,i)=>i!==index);
  if(!path.cubicSegments)return {...path,points};
  const previous=index>0?index-1:path.closed?path.points.length-1:-1;
  const cubicSegments=Array.from({length:path.points.length},(_,i)=>i===previous?null:path.cubicSegments?.[i]??null).filter((_,i)=>i!==index);
  return {...path,points,cubicSegments};
}


export type PathControl="control1"|"control2";
export type PathControlMode="free"|"aligned"|"symmetric";
const edgeExists=(path:PathGeometry,index:number)=>Number.isInteger(index)&&index>=0&&index<path.points.length&&(path.closed||index<path.points.length-1);

/** Convert a line to an equivalent cubic, or replace the cubic by a chord. */
export function setPathEdgeCurved(path:PathGeometry,index:number,curved:boolean):PathGeometry{
  if(!edgeExists(path,index))return path;
  const segments=Array.from({length:path.points.length},(_,i)=>path.cubicSegments?.[i]??null);
  if(curved){
    if(segments[index])return path;
    const a=path.points[index]!,b=path.points[(index+1)%path.points.length]!;
    const lerp=(t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    segments[index]={control1:lerp(1/3),control2:lerp(2/3)};
  }else{
    if(!segments[index])return path;
    segments[index]=null;
  }
  return {...path,cubicSegments:segments};
}

/** Edit a single control; optionally align its opposite about the shared node. */
export function movePathControl(path:PathGeometry,index:number,control:PathControl,point:Point,mode:PathControlMode="free"):PathGeometry{
  const original=path.cubicSegments?.[index];
  if(!edgeExists(path,index)||!original||![point.x,point.y].every(Number.isFinite))return path;
  const segments=Array.from({length:path.points.length},(_,i)=>path.cubicSegments?.[i]??null);
  segments[index]={...original,[control]:point};
  if(mode!=="free"){
    const n=path.points.length;
    const anchor=path.points[control==="control1"?index:(index+1)%n]!;
    const oppositeIndex=control==="control1"?(index+n-1)%n:(index+1)%n;
    const oppositeControl=control==="control1"?"control2":"control1";
    const other=segments[oppositeIndex];
    const dx=anchor.x-point.x,dy=anchor.y-point.y,length=Math.hypot(dx,dy);
    if(length>1e-8&&other&&edgeExists(path,oppositeIndex)&&oppositeIndex!==index&&
      (path.closed||(control==="control1"?index>0:index+1<n-1))){
      const old=other[oppositeControl];
      const ratio=mode==="symmetric"?1:Math.hypot(old.x-anchor.x,old.y-anchor.y)/length;
      segments[oppositeIndex]={...other,[oppositeControl]:{x:anchor.x+dx*ratio,y:anchor.y+dy*ratio}};
    }
  }
  return {...path,cubicSegments:segments};
}


/** Apply simultaneous anchor moves in one pass, translating each attached
 * control by its own anchor's delta (including the closing edge). */
export function movePathNodes(path:PathGeometry,moves:ReadonlyMap<number,Point>):PathGeometry{
  const deltas=new Map<number,Point>();
  for(const [index,point] of moves){
    const old=path.points[index];
    if(!Number.isInteger(index)||!old||![point.x,point.y].every(Number.isFinite))return path;
    if(point.x!==old.x||point.y!==old.y)deltas.set(index,{x:point.x-old.x,y:point.y-old.y});
  }
  if(!deltas.size)return path;
  const points=path.points.map((p,i)=>deltas.has(i)?moves.get(i)!:p);
  if(!path.cubicSegments)return {...path,points};
  const shift=(p:Point,i:number)=>{const d=deltas.get(i);return d?{x:p.x+d.x,y:p.y+d.y}:p;};
  return {...path,points,cubicSegments:path.cubicSegments.map((c,i)=>c&&edgeExists(path,i)?{
    control1:shift(c.control1,i),control2:shift(c.control2,(i+1)%points.length)
  }:c)};
}

export type PathNodeArrangement="min"|"center"|"max"|"distribute";
export function arrangePathNodes(path:PathGeometry,indices:readonly number[],axis:"x"|"y",mode:PathNodeArrangement):PathGeometry{
  const ids=[...new Set(indices)];
  if(ids.length<(mode==="distribute"?3:2)||ids.some(i=>!Number.isInteger(i)||!path.points[i]||!Number.isFinite(path.points[i]![axis])))return path;
  const ordered=ids.sort((a,b)=>path.points[a]![axis]-path.points[b]![axis]||a-b);
  const min=path.points[ordered[0]!]![axis],max=path.points[ordered[ordered.length-1]!]![axis];
  const moves=new Map<number,Point>();
  ordered.forEach((id,i)=>{
    const v=mode==="min"?min:mode==="max"?max:mode==="center"?(min+max)/2:min+(max-min)*i/(ordered.length-1);
    moves.set(id,{...path.points[id]!,[axis]:v});
  });
  return movePathNodes(path,moves);
}

export function nudgePathNodes(path:PathGeometry,indices:readonly number[],dx:number,dy:number):PathGeometry{
  if(![dx,dy].every(Number.isFinite)||indices.some(i=>!Number.isInteger(i)||!path.points[i]))return path;
  return movePathNodes(path,new Map(indices.map(i=>[i,{x:path.points[i]!.x+dx,y:path.points[i]!.y+dy}])));
}


/** Geometry of an interior linear node. Preserve open endpoints, sharp turns,
 * reversals and nodes connected to any existing cubic. */
function linearNodeInfo(path:PathGeometry,i:number){
  const n=path.points.length;
  if(!Number.isInteger(i)||i<0||i>=n||n<3||(!path.closed&&(i===0||i===n-1)))return null;
  const prev=(i+n-1)%n,next=(i+1)%n;
  if(path.cubicSegments?.[prev]||path.cubicSegments?.[i])return null;
  const a=path.points[prev]!,b=path.points[i]!,c=path.points[next]!;
  if(![a.x,a.y,b.x,b.y,c.x,c.y].every(Number.isFinite))return null;
  const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-b.x,vy=c.y-b.y;
  const len=Math.hypot(ux,uy)*Math.hypot(vx,vy);
  // Only smooth shallow turns (<=45 degrees).
  if(len<1e-12||(ux*vx+uy*vy)/len<Math.SQRT1_2)return null;
  const dx=c.x-a.x,dy=c.y-a.y,d2=dx*dx+dy*dy;
  if(d2<1e-12)return null;
  const t=((b.x-a.x)*dx+(b.y-a.y)*dy)/d2;
  if(t<=0||t>=1)return null;
  const target={x:a.x+t*dx,y:a.y+t*dy};
  return {prev,next,target,error:Math.hypot(target.x-b.x,target.y-b.y)};
}

/** One explicit smoothing pass, bounded in artboard units. */
export function smoothSelectedPathNodes(path:PathGeometry,indices:readonly number[],strength:number,maxMove:number):PathGeometry{
  if(!Number.isFinite(strength)||strength<=0||strength>1||!Number.isFinite(maxMove)||maxMove<=0)return path;
  const moves=new Map<number,Point>();
  for(const i of new Set(indices)){
    const info=linearNodeInfo(path,i);
    if(!info||info.error<1e-8)continue;
    const p=path.points[i]!,w=Math.min(strength,maxMove/info.error);
    moves.set(i,{x:p.x+(info.target.x-p.x)*w,y:p.y+(info.target.y-p.y)*w});
  }
  return movePathNodes(path,moves);
}

/** Remove only nonadjacent selected linear nodes, each within the stated
 * distance of its original neighboring chord. No accumulated error in a pass.
 * Preserve index zero on closed paths and all existing cubic edges. */
export function simplifySelectedPathNodes(path:PathGeometry,indices:readonly number[],tolerance:number):PathGeometry{
  if(!Number.isFinite(tolerance)||tolerance<=0)return path;
  const removed=new Set<number>();
  const n=path.points.length,min=path.closed?3:2;
  for(const i of [...new Set(indices)].sort((a,b)=>a-b)){
    if(i===0||n-removed.size<=min)continue;
    const info=linearNodeInfo(path,i);
    if(!info||info.error>tolerance||removed.has(info.prev)||removed.has(info.next))continue;
    removed.add(i);
  }
  if(!removed.size)return path;
  const points=path.points.filter((_,i)=>!removed.has(i));
  if(!path.cubicSegments)return {...path,points};
  const cubicSegments=Array.from({length:n},(_,i)=>removed.has((i+1)%n)?null:path.cubicSegments?.[i]??null).filter((_,i)=>!removed.has(i));
  return {...path,points,cubicSegments};
}
