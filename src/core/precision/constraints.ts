import type { Point } from "../geometry/types";
import { angleOf, dist, normalizeAngle, pointOnCircle } from "../geometry/math";

/** Precision constraints applied while drawing, before/after snapping. */
export interface PrecisionSettings {
  /** Lock the direction from the anchor to fixed angular increments. */
  angleLock: boolean;
  /** Angular increment in degrees used by the angle lock. */
  angleStep: number;
  /** Quantize distance from the anchor to a fixed step (0 = off). */
  lengthStep: number;
  /** Show live dimension readouts while drawing. */
  showReadout: boolean;
}

export const DEFAULT_PRECISION: PrecisionSettings = {
  angleLock: false,
  angleStep: 15,
  lengthStep: 0,
  showReadout: true,
};

export const ANGLE_STEPS = [5, 15, 22.5, 30, 45, 60, 90] as const;

export const PHI = (1 + Math.sqrt(5)) / 2;

/** Common design ratios usable for radius/length scaling. */
export const RATIOS: { id: string; label: string; value: number }[] = [
  { id: "golden", label: "Golden φ", value: PHI },
  { id: "sqrt2", label: "√2", value: Math.SQRT2 },
  { id: "sqrt3", label: "√3", value: Math.sqrt(3) },
  { id: "third", label: "3:2", value: 3 / 2 },
  { id: "fourth", label: "4:3", value: 4 / 3 },
  { id: "double", label: "2:1", value: 2 },
];

export const quantize = (value: number, step: number): number =>
  step > 0 ? Math.round(value / step) * step : value;

/**
 * Constrain `cursor` relative to `anchor`.
 * `force` mirrors a held Shift key: it enables the angle lock temporarily.
 */
export const constrainPoint = (
  anchor: Point,
  cursor: Point,
  settings: PrecisionSettings,
  force = false,
): Point => {
  const useAngle = force || settings.angleLock;
  let radius = dist(anchor, cursor);
  let angle = angleOf(anchor, cursor);
  if (radius === 0) return cursor;
  if (useAngle && settings.angleStep > 0) {
    angle = normalizeAngle(quantize(angle, settings.angleStep));
  }
  if (settings.lengthStep > 0) {
    radius = Math.max(settings.lengthStep, quantize(radius, settings.lengthStep));
  }
  if (!useAngle && settings.lengthStep <= 0) return cursor;
  return pointOnCircle(anchor, radius, angle);
};
