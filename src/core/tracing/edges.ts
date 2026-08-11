import { pt } from "../geometry/math";
import type { Point } from "../geometry/types";

/**
 * Edge strength sampled from the reference picture, in world coordinates.
 * Drawing over a photo or a sketch can then be pulled onto the lines that are
 * actually in the picture instead of following an unsteady hand.
 */
export interface EdgeField {
  width: number;
  height: number;
  /** Sobel magnitude per pixel, normalised to 0–1, row-major. */
  data: Float32Array;
  /** World-space rectangle the pixels cover. */
  box: { x: number; y: number; width: number; height: number };
}

/** Rec. 601 luma of an RGBA buffer. */
export const toGrayscale = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array => {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    const o = i * 4;
    const alpha = (rgba[o + 3] ?? 255) / 255;
    const luma = 0.299 * (rgba[o] ?? 0) + 0.587 * (rgba[o + 1] ?? 0) + 0.114 * (rgba[o + 2] ?? 0);
    // Transparent pixels read as white so a cut-out sketch keeps its outline.
    out[i] = (luma * alpha + 255 * (1 - alpha)) / 255;
  }
  return out;
};

/** Separable 3-tap binomial blur, in place over a copy. */
const blur3 = (src: Float32Array, width: number, height: number): Float32Array => {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const l = x > 0 ? (src[i - 1] ?? 0) : (src[i] ?? 0);
      const r = x < width - 1 ? (src[i + 1] ?? 0) : (src[i] ?? 0);
      tmp[i] = (l + 2 * (src[i] ?? 0) + r) / 4;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const u = y > 0 ? (tmp[i - width] ?? 0) : (tmp[i] ?? 0);
      const d = y < height - 1 ? (tmp[i + width] ?? 0) : (tmp[i] ?? 0);
      out[i] = (u + 2 * (tmp[i] ?? 0) + d) / 4;
    }
  }
  return out;
};

/** Sobel gradient magnitude, normalised so the strongest edge is 1. */
export const buildEdgeField = (
  gray: Float32Array,
  width: number,
  height: number,
  box: EdgeField["box"],
): EdgeField => {
  const raw = new Float32Array(width * height);
  let peak = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = (dx: number, dy: number) => gray[(y + dy) * width + (x + dx)] ?? 0;
      const gx = at(-1, -1) + 2 * at(-1, 0) + at(-1, 1) - (at(1, -1) + 2 * at(1, 0) + at(1, 1));
      const gy = at(-1, -1) + 2 * at(0, -1) + at(1, -1) - (at(-1, 1) + 2 * at(0, 1) + at(1, 1));
      const m = Math.hypot(gx, gy);
      raw[y * width + x] = m;
      if (m > peak) peak = m;
    }
  }
  if (peak > 0) {
    for (let i = 0; i < raw.length; i += 1) raw[i] = (raw[i] ?? 0) / peak;
  }
  // A thin drawn line answers Sobel with a ridge on each of its sides. Two
  // binomial passes (a 1-4-6-4-1 kernel) merge that pair into a single peak on
  // the line itself, so the magnet lands on the stroke instead of flicking
  // between its two edges.
  const data = blur3(blur3(raw, width, height), width, height);
  let blurredPeak = 0;
  for (const v of data) if (v > blurredPeak) blurredPeak = v;
  if (blurredPeak > 0) {
    for (let i = 0; i < data.length; i += 1) data[i] = (data[i] ?? 0) / blurredPeak;
  }
  return { width, height, data, box };
};

/** Longest edge of the sampling buffer; keeps edge detection cheap on big pictures. */
export const MAX_EDGE_SAMPLES = 900;

/**
 * Rasterises the reference picture and derives its edge field. Browser-only —
 * the pure maths above is what the tests exercise.
 */
export const edgeFieldFromImage = (
  image: CanvasImageSource & { naturalWidth?: number; width?: number },
  box: EdgeField["box"],
): EdgeField | null => {
  const naturalWidth = Number(image.naturalWidth ?? image.width ?? 0);
  const naturalHeight = Number(
    (image as { naturalHeight?: number; height?: number }).naturalHeight ??
      (image as { height?: number }).height ??
      0,
  );
  if (!naturalWidth || !naturalHeight) return null;
  const scale = Math.min(1, MAX_EDGE_SAMPLES / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(3, Math.round(naturalWidth * scale));
  const height = Math.max(3, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return buildEdgeField(toGrayscale(data, width, height), width, height, box);
};

/** World units covered by one sample of the field. */
const pixelSize = (field: EdgeField): { x: number; y: number } => ({
  x: field.box.width / field.width,
  y: field.box.height / field.height,
});

export interface EdgeSnapOptions {
  /** Search radius in world units. */
  radius: number;
  /** Ignore edges weaker than this (0–1). */
  threshold: number;
  /**
   * Where the previous sample of the same stroke landed. Candidates near it are
   * preferred, which keeps a stroke running along one side of a thick line
   * instead of flicking between its two edges.
   */
  bias?: Point | null;
}

export const DEFAULT_EDGE_SNAP: EdgeSnapOptions = { radius: 14, threshold: 0.18 };

/**
 * Pulls a point onto the strongest picture edge within `radius`, preferring
 * strong edges but breaking ties towards the original position. Returns null
 * when there is nothing worth snapping to.
 */
export const snapToEdge = (
  field: EdgeField,
  point: Point,
  options: EdgeSnapOptions = DEFAULT_EDGE_SNAP,
): Point | null => {
  const px = pixelSize(field);
  if (px.x <= 0 || px.y <= 0) return null;
  const fx = (point.x - field.box.x) / px.x;
  const fy = (point.y - field.box.y) / px.y;
  const rx = Math.max(1, Math.round(options.radius / px.x));
  const ry = Math.max(1, Math.round(options.radius / px.y));
  const cx = Math.round(fx);
  const cy = Math.round(fy);
  if (cx < -rx || cy < -ry || cx > field.width + rx || cy > field.height + ry) return null;

  const bias = options.bias ?? null;
  const bx = bias ? (bias.x - field.box.x) / px.x : 0;
  const by = bias ? (bias.y - field.box.y) / px.y : 0;

  let best: { x: number; y: number; score: number } | null = null;
  for (let y = Math.max(1, cy - ry); y <= Math.min(field.height - 2, cy + ry); y += 1) {
    for (let x = Math.max(1, cx - rx); x <= Math.min(field.width - 2, cx + rx); x += 1) {
      const magnitude = field.data[y * field.width + x] ?? 0;
      if (magnitude < options.threshold) continue;
      const dx = (x - fx) / rx;
      const dy = (y - fy) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      // Strength dominates, distance only decides between comparable edges —
      // otherwise the magnet settles on the flank of a line rather than on it.
      let score = magnitude * (1 - 0.35 * d);
      if (bias) {
        // Stay on the edge the stroke is already following.
        const dPrev = Math.min(1, Math.hypot((x - bx) / rx, (y - by) / ry) / 2);
        score *= 1 - 0.5 * dPrev;
      }
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best) return null;

  // A thick drawn line still answers with a ridge along each of its sides, too
  // far apart for the blur to merge. Averaging the strong pixels around the
  // winner lands the point on the middle of the stroke rather than one flank.
  const refine = Math.max(1, Math.min(4, Math.round(Math.max(rx, ry) / 3)));
  let wx = 0;
  let wy = 0;
  let total = 0;
  for (
    let y = Math.max(1, best.y - refine);
    y <= Math.min(field.height - 2, best.y + refine);
    y += 1
  ) {
    for (
      let x = Math.max(1, best.x - refine);
      x <= Math.min(field.width - 2, best.x + refine);
      x += 1
    ) {
      const magnitude = field.data[y * field.width + x] ?? 0;
      if (magnitude < options.threshold) continue;
      const w = magnitude * magnitude;
      wx += x * w;
      wy += y * w;
      total += w;
    }
  }
  const fx2 = total > 0 ? wx / total : best.x;
  const fy2 = total > 0 ? wy / total : best.y;
  return pt(field.box.x + (fx2 + 0.5) * px.x, field.box.y + (fy2 + 0.5) * px.y);
};

/**
 * Snaps every sample of a stroke, keeping samples that found no edge. Each
 * sample is biased towards the previous one so the stroke follows a single
 * edge rather than hopping between neighbouring ones.
 */
export const magnetiseStroke = (
  field: EdgeField,
  points: Point[],
  options: EdgeSnapOptions = DEFAULT_EDGE_SNAP,
): Point[] => {
  let previous: Point | null = null;
  return points.map((p) => {
    const snapped = snapToEdge(field, p, { ...options, bias: previous }) ?? p;
    previous = snapped;
    return snapped;
  });
};
