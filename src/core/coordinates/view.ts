import { deg2rad, pt } from "../geometry/math";
import type { Bounds, Point } from "../geometry/types";

/**
 * A view transform maps World coordinates to Screen (container pixel) coordinates.
 * screen = pan + zoom * R(rotation) * world
 */
export interface ViewTransform {
  pan: Point;
  zoom: number;
  rotation: number;
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const worldToScreen = (world: Point, view: ViewTransform): Point => {
  const a = deg2rad(view.rotation);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pt(
    view.pan.x + view.zoom * (world.x * c - world.y * s),
    view.pan.y + view.zoom * (world.x * s + world.y * c),
  );
};

export const screenToWorld = (screen: Point, view: ViewTransform): Point => {
  const a = deg2rad(view.rotation);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = (screen.x - view.pan.x) / view.zoom;
  const dy = (screen.y - view.pan.y) / view.zoom;
  return pt(dx * c + dy * s, -dx * s + dy * c);
};

/** World-space length of one screen pixel. */
export const pixelSize = (view: ViewTransform): number => 1 / view.zoom;

/** Zoom anchored on a screen point so the world point under it stays fixed. */
export const zoomAt = (
  view: ViewTransform,
  screenAnchor: Point,
  nextZoom: number,
): ViewTransform => {
  const zoom = clampZoom(nextZoom);
  const worldAnchor = screenToWorld(screenAnchor, view);
  const projected = worldToScreen(worldAnchor, { ...view, zoom });
  return {
    ...view,
    zoom,
    pan: pt(view.pan.x + (screenAnchor.x - projected.x), view.pan.y + (screenAnchor.y - projected.y)),
  };
};

/** Normalize wheel delta across deltaMode values (pixel / line / page). */
export const normalizeWheelDelta = (deltaY: number, deltaMode: number): number =>
  deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);

export const zoomByWheel = (
  view: ViewTransform,
  screenAnchor: Point,
  deltaY: number,
  deltaMode: number,
  intensity = 0.0015,
): ViewTransform => {
  const dy = normalizeWheelDelta(deltaY, deltaMode);
  return zoomAt(view, screenAnchor, view.zoom * Math.exp(-dy * intensity));
};

export const fitBounds = (
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
  padding = 48,
  rotation = 0,
): ViewTransform => {
  const w = Math.max(1e-6, bounds.maxX - bounds.minX);
  const h = Math.max(1e-6, bounds.maxY - bounds.minY);
  const zoom = clampZoom(
    Math.min(
      (viewportWidth - padding * 2) / w,
      (viewportHeight - padding * 2) / h,
    ),
  );
  const center = pt((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  const base: ViewTransform = { pan: pt(0, 0), zoom, rotation };
  const projected = worldToScreen(center, base);
  return {
    ...base,
    pan: pt(viewportWidth / 2 - projected.x, viewportHeight / 2 - projected.y),
  };
};

export const panBy = (view: ViewTransform, dx: number, dy: number): ViewTransform => ({
  ...view,
  pan: pt(view.pan.x + dx, view.pan.y + dy),
});
