import { glyphPointToWorld, outlineNodes, parseOutline } from "./pathEditor";
import type { LetteringItem } from "./model";

export type MorphDirection = "right" | "left" | "up" | "down";
export type MorphProfile = "gradual" | "tip" | "balanced";
export type MorphRegion = "whole" | "outer-third" | "outer-half";
type CoordinatePair = { x: number; y: number };
const round = (value: number): string => Number(value.toFixed(4)).toString();

/**
 * This operates on glyph outlines, not on Unicode letters or a visual CSS scale.
 * It preserves the original start of a stroke and gradually extends its far end.
 * All Bézier anchors and handles are warped together, so edits survive SVG export.
 */
export function morphOutline(
  d: string,
  direction: MorphDirection,
  amountInFontUnits: number,
  profile: MorphProfile = "gradual",
  region: MorphRegion = "whole",
): string | null {
  if (!Number.isFinite(amountInFontUnits) || Math.abs(amountInFontUnits) > 5000) return null;
  const segments = parseOutline(d);
  const nodes = outlineNodes(d);
  if (!segments || !nodes.length) return null;
  if (amountInFontUnits === 0) return d;
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const values = nodes.map((point) => point[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span < 0.01) return null;
  const atPositiveEnd = direction === "right" || direction === "up";
  const cutoff = region === "outer-third" ? 2 / 3 : region === "outer-half" ? 0.5 : 0;
  const exponent = profile === "tip" ? 4 : profile === "balanced" ? 1 : 2;
  // Bound the maximum derivative of the contraction to prevent axial foldover.
  const maxContraction = Math.min(span * 0.4, span * (1 - cutoff) * 0.9 / exponent);
  const amount = Math.min(span * 1.5, Math.max(-maxContraction, amountInFontUnits));
  let hasChange = false;
  const warped = segments.map((segment) => {
    if (segment.cmd === "Z") return "Z";
    const v = [...segment.values];
    for (let j = 0; j < v.length; j += 2) {
      const coordinate = v[j + (axis === "x" ? 0 : 1)]!;
      const t = (coordinate - min) / span;
      // Smooth easing keeps the joining/base region almost unchanged.
      const u = Math.max(0, Math.min(1, atPositiveEnd ? t : 1 - t));
      const local = Math.max(0, (u - cutoff) / (1 - cutoff));
      const influence = profile === "tip" ? local ** 4 : profile === "balanced" ? local : local * local;
      const delta = influence * amount * (atPositiveEnd ? 1 : -1);
      const index = j + (axis === "x" ? 0 : 1);
      v[index] = coordinate + delta;
      if (Math.abs(delta) > 0.00001) hasChange = true;
    }
    return segment.cmd + v.map(round).join(" ");
  }).join(" ");
  return hasChange ? warped : null;
}

/** Unit conversion lets the designer request an extension in canvas pixels. */
export function morphGlyphPixels(item: LetteringItem, direction: MorphDirection, pixels: number, profile: MorphProfile = "gradual", region: MorphRegion = "whole"): string | null {
  if (item.kind !== "outline" || !item.pathData || !Number.isFinite(pixels)) return null;
  const axisScale = direction === "left" || direction === "right" ? item.scaleX ?? 1 : item.scaleY ?? 1;
  const ratio = item.size / (item.unitsPerEm || 1000);
  if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(axisScale) < 0.01) return null;
  const units = Math.max(-2000, Math.min(2000, pixels / (ratio * Math.abs(axisScale))));
  return morphOutline(item.pathData, direction, units, profile, region);
}

export function letteringGroupBounds(items: LetteringItem[]): { x: number; y: number; width: number; height: number } | null {
  const points: CoordinatePair[] = [];
  for (const item of items) {
    if (item.kind !== "outline" || !item.pathData) continue;
    const nodes = outlineNodes(item.pathData);
    for (const n of nodes) points.push(glyphPointToWorld(item, n.x, n.y));
  }
  if (!points.length) return null;
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Keep a recomposed variant on exactly the same visual center as its predecessor. */
export function centerLetteringAt(items: LetteringItem[], target: CoordinatePair): LetteringItem[] {
  const bounds = letteringGroupBounds(items);
  if (!bounds) return items;
  const dx = target.x - (bounds.x + bounds.width / 2);
  const dy = target.y - (bounds.y + bounds.height / 2);
  return items.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy }));
}

/** Local transverse expansion around the outline's geometric centerline.
 * This is a geometric width adjustment, not a typographic stroke offset.
 */
export function adjustOutlineRegionWidth(d: string, direction: MorphDirection, factor: number, region: MorphRegion = "outer-third"): string | null {
  if (!Number.isFinite(factor) || factor < 0.5 || factor > 1.5) return null;
  const segments = parseOutline(d), nodes = outlineNodes(d);
  if (!segments || !nodes.length) return null;
  if (factor === 1) return d;
  const horizontal = direction === "left" || direction === "right";
  const axis = horizontal ? "x" : "y", transverse = horizontal ? "y" : "x";
  const along = nodes.map(n => n[axis]), across = nodes.map(n => n[transverse]);
  const min = Math.min(...along), span = Math.max(...along) - min;
  const center = (Math.min(...across) + Math.max(...across)) / 2;
  if (span < 0.01) return null;
  const positive = direction === "right" || direction === "up";
  const cutoff = region === "outer-third" ? 2 / 3 : region === "outer-half" ? 0.5 : 0;
  return segments.map(segment => {
    if (segment.cmd === "Z") return "Z";
    const v = [...segment.values];
    for (let i = 0; i < v.length; i += 2) {
      const a = i + (horizontal ? 0 : 1), b = i + (horizontal ? 1 : 0);
      const t = (v[a]! - min) / span;
      const u = Math.max(0, Math.min(1, ((positive ? t : 1 - t) - cutoff) / (1 - cutoff)));
      const weight = u * u * (3 - 2 * u);
      v[b] = center + (v[b]! - center) * (1 + (factor - 1) * weight);
    }
    return segment.cmd + v.map(round).join(" ");
  }).join(" ");
}


/** Tight bounds of the transformed vector outline (not its control polygon).
 * Affine glyph transforms preserve the degree of quadratic/cubic Béziers.
 * Include endpoints and all internal roots of each coordinate derivative.
 */
export function preciseGlyphBounds(item: LetteringItem): { x:number; y:number; width:number; height:number } | null {
  if (item.kind !== "outline" || !item.pathData) return null;
  const segments = parseOutline(item.pathData);
  if (!segments?.length) return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const include=(p:CoordinatePair)=>{
    minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x);
    minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y);
  };
  const roots=(p:number[]):number[]=>{
    const [a,b,c,d]=p;
    if(a===undefined||b===undefined||c===undefined)return [];
    if(d===undefined) {
      const denominator=a-2*b+c;
      return Math.abs(denominator)<1e-10?[]:[(a-b)/denominator];
    }
    const A=-a+3*b-3*c+d,B=2*(a-2*b+c),C=b-a;
    if(Math.abs(A)<1e-10)return Math.abs(B)<1e-10?[]:[-C/B];
    const disc=B*B-4*A*C;
    if(disc<0)return [];
    const s=Math.sqrt(disc);
    return [(-B-s)/(2*A),(-B+s)/(2*A)];
  };
  const world=(x:number,y:number)=>glyphPointToWorld(item,x,y);
  let cursor:CoordinatePair|null=null, origin:CoordinatePair|null=null;
  for(const seg of segments){
    const v=seg.values;
    if(seg.cmd==="Z"){ if(origin){cursor=origin;include(origin);} continue; }
    const points:CoordinatePair[]=[];
    for(let j=0;j<v.length;j+=2)points.push(world(v[j]!,v[j+1]!));
    if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
    const end=points.at(-1);
    if(!end)return null;
    if(seg.cmd==="M"){cursor=end;origin=end;include(end);continue;}
    if(!cursor)return null;
    include(cursor);include(end);
    if(seg.cmd==="Q"||seg.cmd==="C"){
      const controls=[cursor,...points];
      const times=[...roots(controls.map(p=>p.x)),...roots(controls.map(p=>p.y))];
      for(const t of times){
        if(!(t>0&&t<1))continue;
        let level=controls;
        while(level.length>1)level=level.slice(0,-1).map((p,i)=>({
          x:p.x+(level[i+1]!.x-p.x)*t,y:p.y+(level[i+1]!.y-p.y)*t,
        }));
        include(level[0]!);
      }
    }
    cursor=end;
  }
  if(![minX,minY,maxX,maxY].every(Number.isFinite))return null;
  return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}
