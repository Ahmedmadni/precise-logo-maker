import { describe, expect, it } from "vitest";
import { buildEdgeField, magnetiseStroke, snapToEdge, toGrayscale } from "../tracing/edges";
import {
  cleanStroke,
  fitCircle,
  simplifyPath,
  smoothPolyline,
  straightness,
} from "../tracing/simplify";
import { dist, pointOnCircle, pt } from "../geometry/math";

/** A shaky hand: a straight run with ±1.2 of jitter on every sample. */
const shakyLine = (n = 60) =>
  Array.from({ length: n }, (_, i) =>
    pt(i * 5, 100 + (i % 3 === 0 ? 1.2 : i % 3 === 1 ? -1.1 : 0.4)),
  );

const shakyArc = (sweep = 120, n = 60) =>
  Array.from({ length: n }, (_, i) => {
    const p = pointOnCircle(pt(200, 200), 90, (sweep * i) / (n - 1));
    return pt(p.x + (i % 2 ? 0.9 : -0.8), p.y + (i % 3 ? 0.7 : -0.9));
  });

describe("stroke cleanup", () => {
  it("averages the wobble out but keeps the endpoints", () => {
    const raw = shakyLine();
    const smooth = smoothPolyline(raw, 3);
    expect(smooth[0]).toEqual(raw[0]);
    expect(smooth[smooth.length - 1]).toEqual(raw[raw.length - 1]);
    expect(straightness(smooth)).toBeLessThan(straightness(raw));
  });

  it("drops samples that add nothing", () => {
    const dense = Array.from({ length: 50 }, (_, i) => pt(i, 0));
    expect(simplifyPath(dense, 0.5)).toHaveLength(2);
  });

  it("keeps the corners of a zig-zag", () => {
    const zigzag = [pt(0, 0), pt(50, 50), pt(100, 0), pt(150, 50)];
    const dense = zigzag.flatMap((p, i) => {
      const next = zigzag[i + 1];
      if (!next) return [p];
      return Array.from({ length: 12 }, (_, k) =>
        pt(p.x + ((next.x - p.x) * k) / 12, p.y + ((next.y - p.y) * k) / 12),
      );
    });
    expect(simplifyPath(dense, 1).length).toBe(zigzag.length);
  });

  it("promotes a shaky straight stroke to a line", () => {
    const geometry = cleanStroke(shakyLine());
    expect(geometry?.kind).toBe("line");
  });

  it("promotes a shaky curve to an arc on the fitted circle", () => {
    const geometry = cleanStroke(shakyArc());
    expect(geometry?.kind).toBe("arc");
    if (geometry?.kind !== "arc") return;
    expect(geometry.radius).toBeGreaterThan(85);
    expect(geometry.radius).toBeLessThan(95);
    expect(dist(geometry.center, pt(200, 200))).toBeLessThan(3);
  });

  it("recognises a closed loop as a circle", () => {
    const loop = Array.from({ length: 90 }, (_, i) => pointOnCircle(pt(0, 0), 50, i * 4));
    expect(cleanStroke(loop)?.kind).toBe("circle");
  });

  it("keeps a polyline when nothing simple fits", () => {
    const zigzag = [pt(0, 0), pt(40, 60), pt(80, 0), pt(120, 60), pt(160, 0)];
    const geometry = cleanStroke(zigzag, { tolerance: 1, smoothing: 0, fitShapes: true });
    expect(geometry?.kind).toBe("path");
  });

  it("leaves shapes alone when fitting is switched off", () => {
    expect(cleanStroke(shakyLine(), { tolerance: 2, smoothing: 2, fitShapes: false })?.kind).toBe(
      "path",
    );
  });

  it("fits a circle through sampled points", () => {
    const samples = [0, 40, 90, 160, 250].map((a) => pointOnCircle(pt(10, -5), 33, a));
    const fit = fitCircle(samples);
    expect(fit).not.toBeNull();
    expect(fit!.radius).toBeCloseTo(33, 5);
    expect(fit!.center.x).toBeCloseTo(10, 5);
    expect(fit!.error).toBeLessThan(1e-6);
  });
});

/** 40×40 white picture with a black vertical line at column 20. */
const verticalLinePicture = () => {
  const size = 40;
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y += 1) {
    const o = (y * size + 20) * 4;
    rgba[o] = 0;
    rgba[o + 1] = 0;
    rgba[o + 2] = 0;
  }
  const gray = toGrayscale(rgba, size, size);
  // The picture is placed over a 400×400 world box: one pixel = 10 units.
  return buildEdgeField(gray, size, size, { x: 0, y: 0, width: 400, height: 400 });
};

describe("image edge snapping", () => {
  it("pulls a point onto the line in the picture", () => {
    const field = verticalLinePicture();
    const snapped = snapToEdge(field, pt(230, 200), { radius: 60, threshold: 0.15 });
    expect(snapped).not.toBeNull();
    // Column 20 spans x = 200..210, so its centre sits at 205.
    expect(Math.abs(snapped!.x - 205)).toBeLessThanOrEqual(10);
    expect(Math.abs(snapped!.y - 200)).toBeLessThanOrEqual(15);
  });

  it("leaves points alone when no edge is in range", () => {
    const field = verticalLinePicture();
    expect(snapToEdge(field, pt(30, 30), { radius: 20, threshold: 0.15 })).toBeNull();
  });

  it("straightens a shaky stroke drawn along a pictured line", () => {
    const field = verticalLinePicture();
    const stroke = Array.from({ length: 20 }, (_, i) => pt(205 + (i % 2 ? 18 : -16), 40 + i * 15));
    const magnetised = magnetiseStroke(field, stroke, { radius: 40, threshold: 0.15 });
    const spread = Math.max(...magnetised.map((p) => Math.abs(p.x - 205)));
    expect(spread).toBeLessThan(6);
  });
});
