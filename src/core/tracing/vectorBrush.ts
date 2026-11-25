import type { Point, PathGeometry } from "../geometry/types";

export type BrushPreset = "round" | "qalam" | "taper";
export type BrushEndStyle = "flat" | "soft" | "sharp";
export interface BrushSettings {
  preset: BrushPreset;
  size: number;
  color: string;
  angle: number;
  pressure: boolean;
  smoothing: number;
  /** Optional to preserve compatibility with older brush presets. */
  endStyle?: BrushEndStyle;
  pressureCurve?: "soft" | "linear" | "firm";
  /** Minimum width ratio at zero stylus pressure; legacy presets use 30%. */
  pressureFloor?: number;
  nibRatio?: number;
  /** Opt-in cubic boundary fitting, including saved vector geometry. */
  smoothCurves?: boolean;
}
export interface BrushSample extends Point { pressure: number }

export const DEFAULT_BRUSH: BrushSettings = {
  preset: "qalam", size: 18, color: "#d1a95e",
  angle: 40, pressure: true, smoothing: 0.28, endStyle: "flat",
};

const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const valid = (s: BrushSample) => Number.isFinite(s.x) && Number.isFinite(s.y) &&
  Number.isFinite(s.pressure) && Math.abs(s.x) <= 100000 && Math.abs(s.y) <= 100000;


/**
 * Reduce an overlong stroke without truncating later pen movement.
 * Uses a bounded min-heap of local removal costs, including both screen-space
 * geometry and pressure changes. Sharp corners / pressure peaks survive much
 * longer than collinear samples. The first and last sample are never removed.
 * Work is O(n log n) only when the sample cap is reached, not per pointer event.
 */
export function thinBrushSamples(
  samples: readonly BrushSample[], targetCount: number, zoom: number,
): BrushSample[] {
  if (!Number.isFinite(zoom) || zoom <= 0 ||
      !Number.isSafeInteger(targetCount) || targetCount < 2 ||
      samples.length <= targetCount) return [...samples];
  const length = samples.length;
  if (samples.some((sample) => !valid(sample))) return [...samples];
  const before = new Int32Array(length);
  const after = new Int32Array(length);
  const versions = new Uint32Array(length);
  const heap: Array<{ index: number; score: number; version: number }> = [];
  for (let i = 0; i < length; i++) {
    before[i] = i - 1;
    after[i] = i + 1;
  }
  const score = (index: number): number => {
    const left = samples[before[index]!]!;
    const mid = samples[index]!;
    const right = samples[after[index]!]!;
    const dx = right.x - left.x, dy = right.y - left.y;
    const denom = dx * dx + dy * dy;
    const t = denom > 1e-12 ? clamp(
      ((mid.x - left.x) * dx + (mid.y - left.y) * dy) / denom, 0, 1,
    ) : 0.5;
    const spatialX = (mid.x - left.x - dx * t) * zoom;
    const spatialY = (mid.y - left.y - dy * t) * zoom;
    const predictedPressure = left.pressure + (right.pressure - left.pressure) * t;
    const pressureError = (mid.pressure - predictedPressure) * 14;
    return spatialX * spatialX + spatialY * spatialY + pressureError * pressureError;
  };
  const less = (a: typeof heap[number], b: typeof heap[number]) =>
    a.score < b.score || (a.score === b.score && a.index < b.index);
  const push = (index: number) => {
    if (index <= 0 || index >= length - 1) return;
    const item = { index, score: score(index), version: ++versions[index]! };
    heap.push(item);
    let at = heap.length - 1;
    while (at > 0) {
      const parent = Math.floor((at - 1) / 2);
      if (!less(item, heap[parent]!)) break;
      heap[at] = heap[parent]!;
      at = parent;
    }
    heap[at] = item;
  };
  const pop = (): typeof heap[number] | undefined => {
    if (!heap.length) return undefined;
    const first = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      let at = 0;
      while (true) {
        const left = at * 2 + 1, right = left + 1;
        if (left >= heap.length) break;
        const child = right < heap.length && less(heap[right]!, heap[left]!)
          ? right : left;
        if (!less(heap[child]!, last)) break;
        heap[at] = heap[child]!;
        at = child;
      }
      heap[at] = last;
    }
    return first;
  };
  for (let i = 1; i < length - 1; i++) push(i);
  let count = length;
  while (count > targetCount) {
    const node = pop();
    if (!node) break;
    const { index } = node;
    if (node.version !== versions[index]) continue;
    const l = before[index]!, r = after[index]!;
    after[l] = r;
    before[r] = l;
    versions[index]++;
    count--;
    if (l > 0) push(l);
    if (r < length - 1) push(r);
  }
  const kept: BrushSample[] = [];
  let cursor = 0;
  while (cursor < length) {
    kept.push(samples[cursor]!);
    if (cursor === length - 1) break;
    cursor = after[cursor]!;
  }
  return kept;
}

/**
 * Stroke-sampling helper used for both coalesced pointer events and the final
 * pointer-up position. Once full, it thins the least important existing
 * samples instead of freezing the remainder of a long tablet stroke.
 */
export function appendBrushSamples(
  previous: readonly BrushSample[],
  incoming: readonly BrushSample[],
  zoom: number,
  finish = false,
  maxSamples = 2800,
): BrushSample[] {
  if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isSafeInteger(maxSamples) ||
      maxSamples < 1) return [...previous];
  const result = previous.slice(0, maxSamples);
  for (let i = 0; i < incoming.length; i++) {
    const sample = incoming[i]!;
    if (!valid(sample)) continue;
    const last = result.at(-1);
    if (last && distance(last, sample) * zoom < 1.3) {
      if (finish && i === incoming.length - 1) result[result.length - 1] = sample;
      continue;
    }
    if (result.length === maxSamples) {
      // Preserve the cap's legacy one-point semantics used by tiny brushes.
      // Ordinary strokes progressively free room while retaining key corners.
      if (maxSamples >= 8) {
        const keep = Math.max(2, Math.floor(maxSamples * 0.68));
        const thinned = thinBrushSamples(result, keep, zoom);
        result.splice(0, result.length, ...thinned);
      } else {
        if (finish && i === incoming.length - 1) result[maxSamples - 1] = sample;
        break;
      }
    }
    result.push(sample);
  }
  return result;
}

export function brushPressure(pointerPressure: number, pointerType: string): number {
  // Browsers typically emit 0.5 for a mouse held down. Treat touch/mouse
  // as a medium-pressure stroke, not an absent or zero-pressure stylus.
  return pointerType === "pen" ? clamp(Number.isFinite(pointerPressure) && pointerPressure > 0 ? pointerPressure : 0.15, 0.08, 1) : 0.68;
}

export function brushIsValid(config: BrushSettings): boolean {
  return ["round", "qalam", "taper"].includes(config.preset) &&
    (config.smoothCurves===undefined||typeof config.smoothCurves==="boolean") &&
    Number.isFinite(config.size) && config.size >= 1 && config.size <= 200 &&
    Number.isFinite(config.angle) && Math.abs(config.angle) <= 180 &&
    Number.isFinite(config.smoothing) && config.smoothing >= 0 && config.smoothing <= 0.9 &&
    (config.endStyle === undefined || ["flat", "soft", "sharp"].includes(config.endStyle)) &&
    (config.pressureCurve === undefined || ["soft", "linear", "firm"].includes(config.pressureCurve)) &&
    (config.pressureFloor === undefined || (Number.isFinite(config.pressureFloor) && config.pressureFloor >= 0.05 && config.pressureFloor <= 1)) &&
    typeof config.pressure === "boolean" &&
    (config.nibRatio === undefined || (Number.isFinite(config.nibRatio) && config.nibRatio >= 0.05 && config.nibRatio <= 0.8)) &&
    /^#[0-9a-fA-F]{6}$/.test(config.color);
}

/**
 * Respect actual sample spacing, deliberate turns and pressure accents.
 * A previous unweighted neighbor average could shift points along straight
 * but unevenly sampled strokes, round off 90° pen corners and flatten stylus
 * pressure peaks. This remains one linear pass, suitable for frame previews.
 *
 * Endpoints, hard turns (>=75°) and strong pressure extrema survive intact.
 * Only shallow oscillations are reduced, with an independent pressure weight.
 */
export function smoothBrushSamples(samples: BrushSample[], amount: number): BrushSample[] {
  if (samples.length < 3 || amount === 0) return samples;
  if (!Number.isFinite(amount) || amount < 0 || amount > 0.9) return samples;
  const cornerCutoff = Math.cos(75 * Math.PI / 180);
  const softTurn = Math.cos(25 * Math.PI / 180);
  return samples.map((sample, i) => {
    if (i === 0 || i === samples.length - 1) return sample;
    const left = samples[i - 1]!, right = samples[i + 1]!;
    const ax = sample.x - left.x, ay = sample.y - left.y;
    const bx = right.x - sample.x, by = right.y - sample.y;
    const before = Math.hypot(ax, ay), after = Math.hypot(bx, by);
    if (before < 1e-6 || after < 1e-6) return sample;
    const direction = clamp((ax * bx + ay * by) / (before * after), -1, 1);
    const turnProtection = clamp((direction - cornerCutoff) / (softTurn - cornerCutoff), 0, 1);
    // The point's position along the neighboring segment is proportional to
    // traveled distance, not the number/rate of device pointer events.
    const t = before / (before + after);
    const meanX = left.x + (right.x - left.x) * t;
    const meanY = left.y + (right.y - left.y) * t;
    const spatialWeight = amount * turnProtection;
    const expectedPressure = left.pressure + (right.pressure - left.pressure) * t;
    const pressureDeviation = Math.abs(sample.pressure - expectedPressure);
    // Peaks exceeding 0.15 pressure units are treated as intentional accents.
    const pressureProtection = clamp((0.15 - pressureDeviation) / 0.12, 0, 1);
    const pressureWeight = spatialWeight * pressureProtection;
    return {
      x: sample.x + (meanX - sample.x) * spatialWeight,
      y: sample.y + (meanY - sample.y) * spatialWeight,
      pressure: sample.pressure + (expectedPressure - sample.pressure) * pressureWeight,
    };
  });
}

/** Shared pressure-to-width transfer function for saved strokes and previews. */
export function brushPressureWidth(pressure:number,settings:BrushSettings):number {
  if(!settings.pressure)return 1;
  const floor=Number.isFinite(settings.pressureFloor)?clamp(settings.pressureFloor!,0.05,1):0.3;
  const p=clamp(Number.isFinite(pressure)?pressure:0.15,0.08,1);
  const exponent=settings.pressureCurve==="soft"?0.5:settings.pressureCurve==="firm"?2:1;
  return floor+(1-floor)*Math.pow(p,exponent);
}

/** Build a filled, closed vector silhouette. No raster brushes and no
 * runtime font dependency: every brush mark can be scaled and exported in SVG.
 * The round, reed-pen and tapered profiles all use the same point pipeline. */
export function vectorBrushOutline(raw: BrushSample[], settings: BrushSettings): PathGeometry | null {
  if (!brushIsValid(settings) || raw.length < 1 || raw.length > 3000 ||
    raw.some((sample) => !valid(sample))) return null;
  const clean: BrushSample[] = [];
  for (const sample of raw) {
    if (!clean.length || distance(sample, clean[clean.length - 1]!) > 0.15) clean.push(sample);
  }
  if (!clean.length) return null;

  const pressed = (sample: BrushSample) => brushPressureWidth(sample.pressure, settings);
  const point = clean[0]!;
  if (clean.length === 1) {
    const radius = settings.size * pressed(point) / 2;
    if (settings.preset === "round") {
      const points = Array.from({ length: 20 }, (_, i) => {
        const t = 2 * Math.PI * i / 20;
        return { x: point.x + radius * Math.cos(t), y: point.y + radius * Math.sin(t) };
      });
      return { kind: "path", points, closed: true };
    }
    const angle = settings.angle * Math.PI / 180;
    const along = { x: Math.cos(angle), y: Math.sin(angle) };
    const across = { x: -along.y, y: along.x };
    if (settings.preset === "taper") {
      const r = radius * 0.65;
      return { kind: "path", closed: true, points: [
        { x: point.x + along.x * r, y: point.y + along.y * r },
        { x: point.x + across.x * r * 0.55, y: point.y + across.y * r * 0.55 },
        { x: point.x - along.x * r, y: point.y - along.y * r },
        { x: point.x - across.x * r * 0.55, y: point.y - across.y * r * 0.55 },
      ] };
    }
    // A chisel makes a short angled nib imprint rather than a round dot.
    const thin = Math.max(0.2, radius * (settings.nibRatio ?? 0.18));
    const points = [
      [radius, thin * 0.55], [radius * 0.82, thin], [-radius * 0.82, thin], [-radius, thin * 0.55],
      [-radius, -thin * 0.55], [-radius * 0.82, -thin], [radius * 0.82, -thin], [radius, -thin * 0.55],
    ].map(([u, v]) => ({
      x: point.x + along.x * u! + across.x * v!,
      y: point.y + along.y * u! + across.y * v!,
    }));
    return { kind: "path", points, closed: true };
  }

  const samples = smoothBrushSamples(clean, settings.smoothing);
  const angle = settings.angle * Math.PI / 180;
  const nibEdge = { x: Math.cos(angle), y: Math.sin(angle) };
  const left: Point[] = [], right: Point[] = [];
  const last = samples.length - 1;
  const distances = samples.map((sample, i) =>
    i === 0 ? 0 : distance(sample, samples[i - 1]!));
  const cumulative: number[] = [];
  let strokeLength = 0;
  for (const d of distances) {
    strokeLength += d;
    cumulative.push(strokeLength);
  }
  if (strokeLength < 0.15) return vectorBrushOutline([samples[0]!], settings);

  samples.forEach((sample, i) => {
    const a = samples[Math.max(i - 1, 0)]!;
    const b = samples[Math.min(i + 1, last)]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // At corners, intersect the incoming and outgoing offset lines.
    // Limit the miter to 1.65× the local radius to prevent sharp spikes.
    // A near-180° reversal uses the forward normal instead of dividing by
    // an almost-zero bisector; complicated self-crossings still need review.
    let normal = { x: -dy / len, y: dx / len };
    if (i > 0 && i < last) {
      const prev = samples[i - 1]!;
      const next = samples[i + 1]!;
      const ax = sample.x - prev.x, ay = sample.y - prev.y;
      const bx = next.x - sample.x, by = next.y - sample.y;
      const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
      if (al > 1e-6 && bl > 1e-6) {
        const n0 = { x: -ay / al, y: ax / al };
        const n1 = { x: -by / bl, y: bx / bl };
        const sum = { x: n0.x + n1.x, y: n0.y + n1.y };
        const sumLen = Math.hypot(sum.x, sum.y);
        if (sumLen > 1e-4) {
          const mid = { x: sum.x / sumLen, y: sum.y / sumLen };
          const divisor = Math.abs(mid.x * n1.x + mid.y * n1.y);
          const miter = Math.min(1.65, 1 / Math.max(0.001, divisor));
          normal = { x: mid.x * miter, y: mid.y * miter };
        } else {
          normal = { ...n1 };
        }
      }
    }
    let halfWidth = settings.size * pressed(sample) / 2;
    if (settings.preset === "qalam") {
      // The flat nib EDGE (not its normal) determines the cross-section:
      // moving perpendicular to the edge creates a thick stroke; moving
      // parallel creates a hairline. Previously the directions were reversed.
      const mag = Math.hypot(normal.x, normal.y) || 1;
      const ratio = settings.nibRatio ?? 0.18;
      halfWidth *= ratio + (1 - ratio) * Math.abs((normal.x * nibEdge.x + normal.y * nibEdge.y) / mag);
    } else if (settings.preset === "taper") {
      const t = cumulative[i]! / strokeLength;
      halfWidth *= 0.16 + 0.84 * Math.pow(Math.sin(Math.PI * t), 0.5);
    }
    const ends = settings.endStyle ?? "flat";
    if (ends !== "flat") {
      // Distance-based fade keeps caps independent of pointer sampling rates.
      // Fades are capped at half the stroke to protect very short strokes.
      const fadeLength = Math.min(strokeLength / 2, settings.size * 1.45);
      if (fadeLength > 1e-6) {
        const fromTip = Math.min(cumulative[i]!, strokeLength - cumulative[i]!);
        const normalized = clamp(fromTip / fadeLength, 0, 1);
        const smoothstep = normalized * normalized * (3 - 2 * normalized);
        halfWidth *= (ends === "sharp" ? 0.08 : 0.38) +
          (ends === "sharp" ? 0.92 : 0.62) * smoothstep;
      }
    }
    halfWidth = Math.max(0.14, halfWidth);
    left.push({ x: sample.x + normal.x * halfWidth, y: sample.y + normal.y * halfWidth });
    right.push({ x: sample.x - normal.x * halfWidth, y: sample.y - normal.y * halfWidth });
  });

  // Remove nearly collinear edge samples without rounding intentional corners.
  // Preserve each edge's endpoints so the cap geometry remains unchanged.
  const simplifyEdge = (edge: Point[]): Point[] => {
    if (edge.length < 3) return edge;
    const tolerance = Math.min(0.25, settings.size * 0.015);
    const kept: Point[] = [edge[0]!];
    for (let i = 1; i < edge.length - 1; i++) {
      const a = kept[kept.length - 1]!, b = edge[i]!, c = edge[i + 1]!;
      const dx = c.x - a.x, dy = c.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) { kept.push(b); continue; }
      const t = ((b.x - a.x) * dx + (b.y - a.y) * dy) / len2;
      const error = Math.hypot(b.x - a.x - t * dx, b.y - a.y - t * dy);
      // Limit the span to prevent cumulative drift over long curves.
      if (t <= 0 || t >= 1 || error > tolerance || Math.sqrt(len2) > settings.size * 2) kept.push(b);
    }
    kept.push(edge[edge.length - 1]!);
    return kept;
  };
  const outline = [...simplifyEdge(left), ...simplifyEdge(right).reverse()];
  if (outline.length < 4 || outline.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return null;
  return { kind: "path", points: outline, closed: true };
}

/** Opt-in cubic fitting for consumers that preserve cubic geometry through edits.
 * Caps and sharp corners remain linear. Controls stay near the sampled edge.
 */
export function fitBrushCubics(path: PathGeometry): PathGeometry {
  const points = path.points;
  if (!path.closed || points.length < 6) return path;
  const n = points.length;
  const tangent = (i: number): Point | null => {
    const a = points[(i + n - 1) % n]!, b = points[i]!, c = points[(i + 1) % n]!;
    const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: c.x - b.x, y: c.y - b.y };
    const ul = Math.hypot(u.x, u.y), vl = Math.hypot(v.x, v.y);
    if (ul < 1e-6 || vl < 1e-6 || (u.x*v.x + u.y*v.y)/(ul*vl) < 0.94) return null;
    const x = u.x/ul + v.x/vl, y = u.y/ul + v.y/vl, len = Math.hypot(x,y);
    return { x: x/len, y: y/len };
  };
  const cubicSegments = points.map((a,i) => {
    const j = (i+1)%n, b = points[j]!, t = tangent(i), u = tangent(j);
    const length = distance(a,b);
    if (!t || !u || length < 0.15) return null;
    const k = Math.min(length/3, distance(a,points[(i+n-1)%n]!)/2, distance(b,points[(j+1)%n]!)/2);
    return { control1: {x:a.x+t.x*k,y:a.y+t.y*k}, control2:{x:b.x-u.x*k,y:b.y-u.y*k} };
  });
  return { ...path, cubicSegments };
}


/** Final and preview strokes share the exact same optional fitting policy. */
export function buildBrushStroke(samples:BrushSample[],settings:BrushSettings):PathGeometry|null{
  const shape=vectorBrushOutline(samples,settings);
  return shape&&settings.smoothCurves?fitBrushCubics(shape):shape;
}
