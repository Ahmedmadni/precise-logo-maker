import { describe, expect, it } from "vitest";
import { screenToWorld, worldToScreen, type ViewTransform } from "../../../core/coordinates/view";
import { pinchView, touchPair } from "../touchGestures";

describe("tablet pen and two-finger pinch geometry", () => {
  it("computes midpoint in canvas pixels, not page pixels", () => {
    const fingers = new Map([[1, { x: 190, y: 320 }], [2, { x: 290, y: 400 }]]);
    const pair = touchPair(fingers, { x: 100, y: 200 })!;
    expect(pair.distance).toBeCloseTo(Math.hypot(100, 80));
    expect(pair.midpoint).toEqual({ x: 140, y: 160 });
    expect(touchPair(new Map([[1, { x: 10, y: 10 }]]), { x: 0, y: 0 })).toBeNull();
  });
  it("anchors the same world point at the moved fingers under rotated zoom", () => {
    for (const rotation of [0, 28, -62]) {
      const view: ViewTransform = { zoom: 0.7, rotation, pan: { x: 120, y: -44 } };
      const start = { view, midpoint: { x: 420, y: 230 }, distance: 130 };
      const current = { midpoint: { x: 474, y: 282 }, distance: 270 };
      const anchoredWorld = screenToWorld(start.midpoint, view);
      const updated = pinchView(start, current);
      const projected = worldToScreen(anchoredWorld, updated);
      expect(updated.zoom).toBeCloseTo(view.zoom * current.distance / start.distance);
      expect(projected.x).toBeCloseTo(current.midpoint.x, 5);
      expect(projected.y).toBeCloseTo(current.midpoint.y, 5);
      expect(updated.rotation).toBe(rotation);
    }
  });
  it("keeps pinch zoom within limits and handles coincident fingers", () => {
    const initial: ViewTransform = { zoom: 1, rotation: 0, pan: { x: 0, y: 0 } };
    expect(pinchView({ view: initial, distance: 1, midpoint: { x: 0, y: 0 } },
      { distance: 1000, midpoint: { x: 10, y: 20 } }).zoom).toBe(64);
    const pair = touchPair(new Map([[1, { x: 12, y: 12 }], [2, { x: 12, y: 12 }]]),
      { x: 0, y: 0 })!;
    expect(pair.distance).toBe(1);
  });
});
