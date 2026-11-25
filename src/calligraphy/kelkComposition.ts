import type { LetteringItem } from "./model";
import { createRibbonLink, buildRibbonPath, isValidRibbon } from "./ribbonJoin";
import { worldJoinAnchor } from "./contourComposer";
import { preciseGlyphBounds } from "./morph";

export type KelkSlantPresetId = "vertical" | "thuluth" | "ruqaa" | "nastaliq";
export type KelkLayoutStyle = "cascade" | "interlock" | "arch" | "reset" | "vertical" | "circle" | "ellipse";
export interface OrbitLayoutOptions {
  aspect?: number;
  radiusScale?: number;
  startAngle?: number;
  clockwise?: boolean;
  tangent?: boolean;
  equalArc?: boolean;
  keepUpright?: boolean;
}
export type KashidaStyle = "flat" | "arch" | "wave";

export interface KelkSlantPreset {
  id: KelkSlantPresetId;
  label: string;
  skewX: number;
  rotation: number;
}

export const KELK_SLANT_PRESETS: KelkSlantPreset[] = [
  { id: "vertical", label: "عمودي", skewX: 0, rotation: 0 },
  { id: "thuluth", label: "ثلث", skewX: -6, rotation: -2 },
  { id: "ruqaa", label: "رقعة", skewX: -12, rotation: -4 },
  { id: "nastaliq", label: "نستعليق", skewX: -18, rotation: -6 },
];

export type LetteringPatchEntry = { id: string; patch: Partial<LetteringItem> };

const round = (n: number): number => Number(n.toFixed(2));

/** Sort glyphs in Arabic reading order (right-to-left by x coordinate). */
function sortRtl(items: LetteringItem[]): LetteringItem[] {
  return [...items].sort((a, b) => b.x - a.x);
}

/** Apply a Kelk pen-slant preset to one or more lettering items. */
export function applyGroupSlant(
  items: LetteringItem[],
  preset: Pick<KelkSlantPreset, "skewX" | "rotation">,
): LetteringPatchEntry[] {
  return items
    .filter((item) => item.kind === "outline" || item.kind === "text")
    .map((item) => ({
      id: item.id,
      patch: { skewX: preset.skewX, rotation: preset.rotation },
    }));
}

/**
 * Arrange a word/group of glyphs in classic Kelk calligraphy compositions:
 * - cascade: gentle descending diagonal step in RTL order
 * - interlock: alternating elevation with tighter horizontal overlap
 * - arch: parabolic curve with automatic tangent rotation
 * - reset: restore flat baseline and zero rotation/skew
 */
export function composeWordLayout(
  items: LetteringItem[],
  style: KelkLayoutStyle,
  intensity = 1,
  orbit: OrbitLayoutOptions = {},
): LetteringPatchEntry[] {
  const glyphs = sortRtl(items.filter((i) => i.kind === "outline" || i.kind === "text"));
  if (glyphs.length === 0 || (glyphs.length < 2 && style !== "reset")) return [];
  const k = Math.max(0.25, Math.min(3, Number.isFinite(intensity) ? intensity : 1));
  const avgSize = glyphs.reduce((sum, g) => sum + g.size, 0) / glyphs.length;
  const baseY = glyphs[0]!.y;

  if (style === "reset") {
    return glyphs.map((g) => ({
      id: g.id,
      patch: { y: round(baseY), rotation: 0, skewX: 0, skewY: 0 },
    }));
  }

  if (style === "cascade") {
    const stepY = avgSize * 0.12 * k;
    const pullX = avgSize * 0.04 * k;
    return glyphs.map((g, idx) => ({
      id: g.id,
      patch: {
        x: round(g.x + idx * pullX),
        y: round(baseY + idx * stepY),
        rotation: round(-3 * k),
      },
    }));
  }

  if (style === "interlock") {
    const lift = avgSize * 0.16 * k;
    const centerX = glyphs.reduce((s, g) => s + g.x, 0) / glyphs.length;
    return glyphs.map((g, idx) => {
      const dir = idx % 2 === 0 ? -1 : 1;
      const pulledX = centerX + (g.x - centerX) * Math.max(0.7, 1 - 0.12 * k);
      return {
        id: g.id,
        patch: {
          x: round(pulledX),
          y: round(baseY + dir * lift * 0.5),
          rotation: round(dir * -2.5 * k),
        },
      };
    });
  }

  if (style === "vertical" || style === "circle" || style === "ellipse") {
    // Fontkit emits RTL runs in visual LTR order, with increasing glyphIndex.
    // Stable indexes avoid reshuffling the word on repeated circular layouts.
    const indexed = glyphs.every(g => Number.isInteger(g.glyphIndex)) &&
      new Set(glyphs.map(g => g.glyphIndex)).size === glyphs.length;
    const ordered = indexed ? [...glyphs].sort((a,b) => b.glyphIndex! - a.glyphIndex!) :
      items.filter(g => glyphs.includes(g));
    if (ordered.some(g => !Number.isFinite(g.x) || !Number.isFinite(g.y) || !Number.isFinite(g.size))) return [];
    const centers = ordered.map(g => { const b=preciseGlyphBounds(g); return b ? {x:b.x+b.width/2,y:b.y+b.height/2} : {x:g.x,y:g.y-g.size/2}; });
    const cx = centers.reduce((sum,p)=>sum+p.x,0)/ordered.length;
    const cy = centers.reduce((sum,p)=>sum+p.y,0)/ordered.length;
    const metrics = ordered.map(g => {
      const b = preciseGlyphBounds({...g,x:0,y:0,rotation:0});
      return b ? {x:b.x+b.width/2,y:b.y+b.height/2,diameter:Math.hypot(b.width,b.height)} :
        {x:0,y:-g.size/2,diameter:Math.max(1,g.size)};
    });
    const diameter = Math.max(1,...metrics.map(m=>m.diameter));
    const separation = diameter*(1+0.15*k);
    const bounded = (n:number|undefined,fallback:number,min:number,max:number) => Number.isFinite(n) ? Math.max(min,Math.min(max,n!)) : fallback;
    const ratio = style==="ellipse" ? bounded(orbit.aspect,1.5,0.5,2.5) : 1;
    const radius = separation/(2*Math.sin(Math.PI/ordered.length))*bounded(orbit.radiusScale,1,1,3);
    const rx=radius*Math.max(1,ratio), ry=radius*Math.max(1,1/ratio);
    const direction=orbit.clockwise?1:-1;
    const start=bounded(orbit.startAngle,-90,-180,180)*Math.PI/180;
    const angles = style==="ellipse" && orbit.equalArc!==false
      ? equalArcAngles(rx,ry,ordered.length,start,direction)
      : ordered.map((_,i)=>start+direction*i*2*Math.PI/ordered.length);
    if(angles.length!==ordered.length)return [];
    return ordered.map((g,i)=>{
      const theta = angles[i]!;
      const px=style==="vertical"?cx:cx+rx*Math.cos(theta);
      const py=style==="vertical"?cy+(i-(ordered.length-1)/2)*separation:cy+ry*Math.sin(theta);
      let rotation=style!=="vertical"&&orbit.tangent ? round(Math.atan2(ry*Math.cos(theta),-rx*Math.sin(theta))*180/Math.PI) : 0;
      if(orbit.keepUpright && orbit.tangent){
        if(rotation>90)rotation-=180;
        else if(rotation< -90)rotation+=180;
      }
      const b=preciseGlyphBounds({...g,x:0,y:0,rotation});
      const local=b?{x:b.x+b.width/2,y:b.y+b.height/2}:metrics[i]!;
      return {id:g.id,patch:{x:round(px-local.x),y:round(py-local.y),rotation}};
    });
  }

  // arch
  const minX = Math.min(...glyphs.map((g) => g.x));
  const maxX = Math.max(...glyphs.map((g) => g.x));
  const span = Math.max(1, maxX - minX);
  const midX = (minX + maxX) / 2;
  const archHeight = avgSize * 0.35 * k;

  return glyphs.map((g) => {
    const u = (g.x - midX) / (span / 2); // -1 .. 1
    const dy = -archHeight * (1 - u * u);
    const slopeDeg = Math.atan2(2 * archHeight * u, span / 2) * (180 / Math.PI);
    return {
      id: g.id,
      patch: {
        y: round(baseY + dy),
        rotation: round(Math.max(-35, Math.min(35, slopeDeg))),
      },
    };
  });
}

/** Pull glyphs closer together (negative deltaPx) or spread apart (positive deltaPx) around group center. */
export function adjustGroupOverlap(items: LetteringItem[], deltaPx: number): LetteringPatchEntry[] {
  const glyphs = sortRtl(items.filter((i) => i.kind === "outline" || i.kind === "text"));
  if (glyphs.length < 2 || !Number.isFinite(deltaPx) || deltaPx === 0) return [];
  const midIdx = (glyphs.length - 1) / 2;
  // Adjacent x-coordinate gaps change by the same step. Never reverse
  // their current RTL order, even after repeated compression.
  const gaps = glyphs.slice(1).map((g, i) => glyphs[i]!.x - g.x);
  const minGap = Math.min(...gaps);
  const step = deltaPx < 0 ? Math.max(deltaPx, -Math.max(0, minGap - 0.02)) : Math.min(1000, deltaPx);
  if (step === 0) return [];
  return glyphs.map((g, idx) => {
    // In RTL order, idx 0 is rightmost (+x), last idx is leftmost (-x).
    const offset = (midIdx - idx) * step;
    return { id: g.id, patch: { x: round(g.x + offset) } };
  });
}

/**
 * Build a closed, editable calligraphic kashida outline in 1000-unit font space
 * (baseline near y = 0, upward is +y in font coordinates).
 */
export function buildKashidaOutline(options: {
  length: number;
  arch: number;
  thickness: number;
  style: KashidaStyle;
}): string | null {
  if (![options.length, options.thickness, options.arch].every(Number.isFinite)) return null;
  const length = Math.max(120, Math.min(2400, options.length));
  const thickness = Math.max(24, Math.min(220, options.thickness));
  const arch = Math.max(-320, Math.min(320, options.arch));
  if (!Number.isFinite(length) || !Number.isFinite(thickness) || !Number.isFinite(arch)) return null;

  const half = length / 2;
  const t = thickness;
  const taper = Math.max(12, t * 0.45);

  if (options.style === "flat") {
    return `M ${round(-half)} ${round(t)} L ${round(half)} ${round(t)} L ${round(half)} 0 L ${round(-half)} 0 Z`;
  }

  if (options.style === "arch") {
    const cY = arch;
    return [
      `M ${round(-half)} ${round(taper)}`,
      `Q 0 ${round(cY + t)} ${round(half)} ${round(taper)}`,
      `L ${round(half)} 0`,
      `Q 0 ${round(cY)} ${round(-half)} 0`,
      "Z",
    ].join(" ");
  }

  // wave (S-curve calligraphic kashida)
  const q = length / 4;
  const a = arch;
  return [
    `M ${round(-half)} ${round(taper)}`,
    `C ${round(-q)} ${round(a + t)} ${round(q)} ${round(-a + t)} ${round(half)} ${round(taper)}`,
    `L ${round(half)} 0`,
    `C ${round(q)} ${round(-a)} ${round(-q)} ${round(a)} ${round(-half)} 0`,
    "Z",
  ].join(" ");
}

/** Create a ready-to-insert LetteringItem for a calligraphic kashida next to the selected glyph. */
export function createKashidaItem(
  anchor: LetteringItem,
  options: { length: number; arch: number; thickness: number; style: KashidaStyle },
): LetteringItem | null {
  const pathData = buildKashidaOutline(options);
  if (!pathData) return null;
  return {
    id: `kashida-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: "outline",
    x: round(anchor.x - anchor.size * 0.35),
    y: anchor.y,
    size: anchor.size,
    rotation: anchor.rotation,
    color: anchor.color,
    skewX: anchor.skewX ?? 0,
    skewY: anchor.skewY ?? 0,
    pathData,
    unitsPerEm: 1000,
    ...(anchor.groupId ? { groupId: anchor.groupId } : {}),
    sourceText: "ـ",
  };
}

/** Connected alternative to the independent decorative outline.
 * The user chooses the target explicitly; the ribbon follows both glyphs.
 * Length follows anchor separation, not the decorative outline length slider.
 */
export function createConnectedKashida(
  source: LetteringItem,
  target: LetteringItem,
  options: { arch: number; thickness: number; style: KashidaStyle; nibAngle?: number; nibContrast?: number },
): LetteringItem | null {
  if (source.hidden || target.hidden || !Number.isFinite(options.arch) ||
      !Number.isFinite(options.thickness) || !Number.isFinite(options.nibAngle ?? 35) ||
      !Number.isFinite(options.nibContrast ?? 0)) return null;
  const item = createRibbonLink(source, target);
  if (!item?.ribbon) return null;
  const start = worldJoinAnchor(source, "exit"), end = worldJoinAnchor(target, "entry");
  if (!start || !end) return null;
  const distance = Math.hypot(end.x-start.x, end.y-start.y);
  if (!Number.isFinite(distance) || distance < 2) return null;
  const thickness = Math.max(24, Math.min(220, options.thickness));
  const widthFor = (glyph: LetteringItem) => Math.max(0.8, Math.min(150, thickness * glyph.size / 1000));
  const startWidth = widthFor(source), endWidth = widthFor(target);
  const overlapFor = (width: number) => Math.min(60, distance * 0.1, width * 0.5);
  const curvature = options.style === "arch" ? Math.max(-0.5, Math.min(0.5, options.arch / 640)) : 0;
  // Wave is represented by opposite relative displacement of the tangent
  // handles (equal tangent angles at opposite ends of the chord).
  const angle = options.style === "wave" ? Math.max(-45, Math.min(45, options.arch / 5)) : 0;
  const ribbon = { ...item.ribbon, startWidth, endWidth,
    startOverlap: overlapFor(startWidth), endOverlap: overlapFor(endWidth), curvature,
    startAngle: angle, endAngle: angle,
    nibAngle: Math.max(-180, Math.min(180, options.nibAngle ?? 35)),
    nibContrast: Math.max(0, Math.min(0.8, options.nibContrast ?? 0)) };
  const result = { ...item, ribbon, sourceText: "ـ" };
  return isValidRibbon(ribbon) && buildRibbonPath(result, [source,target]) ? result : null;
}


/** Equal anchor spacing preserves the outermost glyph positions and RTL order.
 * Baseline alignment only changes vertical position, preserving glyph shape.
 */
export function arrangeWordAnchors(items: LetteringItem[], mode: "equal-spacing" | "baseline"): LetteringPatchEntry[] {
  const glyphs = sortRtl(items.filter(g => !g.hidden && (g.kind === "outline" || g.kind === "text") && Number.isFinite(g.x) && Number.isFinite(g.y)));
  if (glyphs.length < 2) return [];
  if (mode === "baseline") {
    const baseline = glyphs[0]!.y - (glyphs[0]!.baselineOffset ?? 0);
    return glyphs.map(g => ({id:g.id,patch:{y:round(baseline + (g.baselineOffset ?? 0))}}));
  }
  if (glyphs.length < 3) return [];
  const right = glyphs[0]!.x, left = glyphs[glyphs.length-1]!.x;
  if (right <= left) return [];
  return glyphs.slice(1,-1).map((g,i) => ({
    id:g.id, patch:{x:round(right - (right-left)*(i+1)/(glyphs.length-1))},
  }));
}


/** Equal signed gaps between tight transformed outline bounds.
 * Keep outer glyphs fixed, reject layouts that would reverse anchor order
 * or move the composition's envelope beyond its current extent.
 * Text drafts lack reliable vector bounds and must be outlined first.
 */
export function arrangeWordBounds(items: LetteringItem[]): LetteringPatchEntry[] {
  const visible = items.filter(g => !g.hidden && (g.kind === "outline" || g.kind === "text"));
  if (visible.length < 3 || visible.some(g => g.kind !== "outline" || !g.pathData)) return [];
  const glyphs = sortRtl(visible);
  const measured = glyphs.map(g => ({ g, b: preciseGlyphBounds(g) }));
  if (measured.some(({g,b}) => !b || ![g.x,b.x,b.width].every(Number.isFinite) || b.width <= 0)) return [];
  const boxes = measured.map(({g,b}) => ({g,left:b!.x,right:b!.x+b!.width,width:b!.width}));
  const right = boxes[0]!.right, left = boxes.at(-1)!.left;
  if (right <= left || boxes.some(b => b.left < left-0.01 || b.right > right+0.01)) return [];
  const gap = (right-left-boxes.reduce((sum,b)=>sum+b.width,0))/(boxes.length-1);
  let cursor = right;
  const positioned = boxes.map((b,i) => {
    const x = i===0 || i===boxes.length-1 ? b.g.x : round(b.g.x+cursor-b.right);
    cursor -= b.width+gap;
    return {...b,x};
  });
  for(let i=0;i<positioned.length;i++){
    const b=positioned[i]!, dx=b.x-b.g.x;
    if(b.left+dx<left-0.01 || b.right+dx>right+0.01 ||
       (i>0 && positioned[i-1]!.x<b.x)) return [];
  }
  return positioned.slice(1,-1).filter(b=>Math.abs(b.x-b.g.x)>0.005)
    .map(b=>({id:b.g.id,patch:{x:b.x}}));
}


/** Approximate equal arclength positions with a bounded chord-length table.
 * The first angle is exact; the endpoint is excluded on closed paths.
 */
export function equalArcAngles(rx:number,ry:number,count:number,start:number,direction:1|-1):number[]{
  if(![rx,ry,start].every(Number.isFinite)||rx<=0||ry<=0||
    !Number.isInteger(count)||count<1||count>1000)return [];
  const steps=2048, step=direction*2*Math.PI/steps;
  const cumulative=[0];
  let x=rx*Math.cos(start),y=ry*Math.sin(start);
  for(let i=1;i<=steps;i++){
    const a=start+i*step,nx=rx*Math.cos(a),ny=ry*Math.sin(a);
    cumulative.push(cumulative[i-1]!+Math.hypot(nx-x,ny-y));
    x=nx;y=ny;
  }
  const total=cumulative[steps]!;
  if(!Number.isFinite(total)||total<=0)return [];
  let j=1;
  return Array.from({length:count},(_,i)=>{
    const distance=total*i/count;
    while(j<steps&&cumulative[j]!<distance)j++;
    const span=cumulative[j]!-cumulative[j-1]!;
    const fraction=span>0?(distance-cumulative[j-1]!)/span:0;
    return start+(j-1+fraction)*step;
  });
}
