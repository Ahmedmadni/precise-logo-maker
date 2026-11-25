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
