export type Unit = "px" | "mm" | "cm" | "in";

/** Design DPI used to convert physical units into world units (1 world unit = 1 px @96dpi). */
export const DPI = 96;

const PX_PER_UNIT: Record<Unit, number> = {
  px: 1,
  in: DPI,
  cm: DPI / 2.54,
  mm: DPI / 25.4,
};

export const toPx = (value: number, unit: Unit): number => value * PX_PER_UNIT[unit];

export const fromPx = (px: number, unit: Unit): number => px / PX_PER_UNIT[unit];

export const formatUnit = (px: number, unit: Unit, digits = unit === "px" ? 1 : 2): string =>
  `${fromPx(px, unit).toFixed(digits)}${unit}`;
