import { describe, expect, it } from "vitest";
import { buildEdgeField, magnetiseStroke, toGrayscale } from "../tracing/edges";
import { cleanStroke } from "../tracing/simplify";
import { dist, pointOnCircle, pt } from "../geometry/math";

/**
 * A stand-in for a scanned sketch: a 400×400 picture holding a 5px-thick
 * vertical line and a 5px-thick circle, placed over the whole 1024 artboard.
 * Thick strokes are the hard case — each side of the ink answers the edge
 * detector separately.
 */
const ARTWORK = 400;
const WORLD = 1024;

const artworkField = () => {
  const rgba = new Uint8ClampedArray(ARTWORK * ARTWORK * 4).fill(255);
  const ink = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= ARTWORK || y >= ARTWORK) return;
    const o = (Math.round(y) * ARTWORK + Math.round(x)) * 4;
    rgba[o] = 0;
    rgba[o + 1] = 0;
    rgba[o + 2] = 0;
  };
  for (let y = 40; y < 360; y += 1) for (let d = -2; d <= 2; d += 1) ink(200 + d, y);
  for (let a = 0; a < 3600; a += 1) {
    const r = ((a / 10) * Math.PI) / 180;
    for (let d = -2; d <= 2; d += 1) {
      ink(200 + (120 + d) * Math.cos(r), 200 + (120 + d) * Math.sin(r));
    }
  }
  return buildEdgeField(toGrayscale(rgba, ARTWORK, ARTWORK), ARTWORK, ARTWORK, {
    x: 0,
    y: 0,
    width: WORLD,
    height: WORLD,
  });
};

/** Image pixel → world unit. */
const w = (v: number) => (v * WORLD) / ARTWORK;

describe("tracing a thick sketch", () => {
  const field = artworkField();
  const options = { radius: 14, threshold: 0.18 };

  it("turns a shaky pass along the drawn line into a straight line", () => {
    const stroke = Array.from({ length: 40 }, (_, i) =>
      pt(w(200) + (i % 2 ? 9 : -8), w(60) + i * w(7)),
    );
    const magnetised = magnetiseStroke(field, stroke, options);
    const geometry = cleanStroke(magnetised, { tolerance: 2.5, smoothing: 2, fitShapes: true });
    expect(geometry?.kind).toBe("line");
    if (geometry?.kind !== "line") return;
    // Both ends land on the ink, which spans w(198)…w(202).
    for (const end of [geometry.a, geometry.b]) {
      expect(Math.abs(end.x - w(200))).toBeLessThan(w(4));
    }
  });

  it("turns a shaky pass along the drawn circle into an arc on it", () => {
    const stroke = Array.from({ length: 40 }, (_, i) => {
      const angle = -70 + (140 * i) / 39;
      const p = pointOnCircle(pt(w(200), w(200)), w(120), angle);
      return pt(p.x + (i % 2 ? 7 : -7), p.y + (i % 3 ? 6 : -6));
    });
    const magnetised = magnetiseStroke(field, stroke, options);
    const geometry = cleanStroke(magnetised, { tolerance: 2.5, smoothing: 2, fitShapes: true });
    expect(geometry?.kind).toBe("arc");
    if (geometry?.kind !== "arc") return;
    expect(dist(geometry.center, pt(w(200), w(200)))).toBeLessThan(w(8));
    expect(Math.abs(geometry.radius - w(120))).toBeLessThan(w(8));
  });

  it("keeps every sample on the drawn ink, however shaky the hand", () => {
    const stroke = Array.from({ length: 30 }, (_, i) =>
      pt(w(200) + (i % 2 ? 11 : -10), w(80) + i * w(8)),
    );
    const rawSpread = Math.max(...stroke.map((p) => Math.abs(p.x - w(200))));
    const magnetised = magnetiseStroke(field, stroke, options);
    const spread = Math.max(...magnetised.map((p) => Math.abs(p.x - w(200))));
    // The ink is 5 picture pixels wide; every sample must land inside it.
    expect(spread).toBeLessThan(w(3.5));
    expect(spread).toBeLessThan(rawSpread);
  });
});
