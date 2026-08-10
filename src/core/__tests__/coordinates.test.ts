import { describe, expect, it } from "vitest";
import {
  fitBounds,
  normalizeWheelDelta,
  screenToWorld,
  worldToScreen,
  zoomAt,
  zoomByWheel,
  type ViewTransform,
} from "../coordinates/view";
import { pt } from "../geometry/math";

const view: ViewTransform = { pan: pt(120, -40), zoom: 2.5, rotation: 17 };

describe("coordinate system", () => {
  it("round-trips world -> screen -> world", () => {
    for (const p of [pt(0, 0), pt(512, 512), pt(-30.5, 900.25)]) {
      const back = screenToWorld(worldToScreen(p, view), view);
      expect(back.x).toBeCloseTo(p.x, 8);
      expect(back.y).toBeCloseTo(p.y, 8);
    }
  });

  it("keeps the world point under the cursor fixed while zooming", () => {
    const anchor = pt(300, 220);
    const before = screenToWorld(anchor, view);
    const next = zoomAt(view, anchor, view.zoom * 3.7);
    const after = screenToWorld(anchor, next);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it("normalizes wheel delta modes", () => {
    expect(normalizeWheelDelta(3, 0)).toBe(3);
    expect(normalizeWheelDelta(3, 1)).toBe(48);
    expect(normalizeWheelDelta(3, 2)).toBe(300);
  });

  it("scales zoom by delta magnitude, not a fixed factor", () => {
    const small = zoomByWheel(view, pt(0, 0), -10, 0).zoom;
    const large = zoomByWheel(view, pt(0, 0), -100, 0).zoom;
    expect(large).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(view.zoom);
  });

  it("fits bounds centered in the viewport", () => {
    const fitted = fitBounds({ minX: 0, minY: 0, maxX: 1024, maxY: 1024 }, 800, 600, 40);
    const center = worldToScreen(pt(512, 512), fitted);
    expect(center.x).toBeCloseTo(400, 6);
    expect(center.y).toBeCloseTo(300, 6);
    expect(fitted.zoom).toBeCloseTo((600 - 80) / 1024, 6);
  });
});
