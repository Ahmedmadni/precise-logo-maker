import type {PathGeometry,Point,CubicSegment} from "../core/geometry/types";

const lerp=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const finite=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y);

/** Split an open path at an interior node or at a parameter on an edge.
 * The two new open paths share only the cut endpoint. Cubic controls are
 * subdivided using De Casteljau, without polygonal approximation. */
export function cutOpenPath(path:PathGeometry,edge:number,t:number):[PathGeometry,PathGeometry]|null{
  const n=path.points.length;
  if(path.closed||path.holes?.length||n<2||!Number.isInteger(edge)||edge<0||edge>=n-1||!Number.isFinite(t)||t<0||t>1)return null;
  if(path.points.some(p=>!finite(p))||path.cubicSegments?.some(c=>c&&(!finite(c.control1)||!finite(c.control2))))return null;
  const controls=Array.from({length:n-1},(_,i)=>path.cubicSegments?.[i]??null);
  const make=(points:Point[],segments:(CubicSegment|null)[]):PathGeometry=>({kind:"path",closed:false,points,...(segments.some(Boolean)?{cubicSegments:[...segments,null]}:{})});
  if(t===0||t===1){
    const i=edge+(t===1?1:0);
    if(i<=0||i>=n-1)return null;
    return [make(path.points.slice(0,i+1),controls.slice(0,i)),make(path.points.slice(i),controls.slice(i))];
  }
  const a=path.points[edge]!,d=path.points[edge+1]!,c=controls[edge];
  let point=lerp(a,d,t),left:CubicSegment|null=null,right:CubicSegment|null=null;
  if(c){
    const ab=lerp(a,c.control1,t),bc=lerp(c.control1,c.control2,t),cd=lerp(c.control2,d,t);
    const abc=lerp(ab,bc,t),bcd=lerp(bc,cd,t);
    point=lerp(abc,bcd,t);left={control1:ab,control2:abc};right={control1:bcd,control2:cd};
  }
  return [make([...path.points.slice(0,edge+1),point],[...controls.slice(0,edge),left]),make([point,...path.points.slice(edge+1)],[right,...controls.slice(edge+1)])];
}
