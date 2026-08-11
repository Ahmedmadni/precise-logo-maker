export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CircleGeometry {
  kind: "circle";
  center: Point;
  radius: number;
}

export interface LineGeometry {
  kind: "line";
  a: Point;
  b: Point;
}

/** Angles in degrees, counter-clockwise-free: swept from start to end going CCW in math terms. */
export interface ArcGeometry {
  kind: "arc";
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/**
 * Poly-path: freehand pen strokes and grid-cell chains share this shape.
 * `closed` renders a closed (fillable) outline.
 */
export interface PathGeometry {
  kind: "path";
  points: Point[];
  closed: boolean;
}

export type Geometry = CircleGeometry | LineGeometry | ArcGeometry | PathGeometry;

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Style {
  stroke: string;
  strokeWidth: number;
  fill: string;
  /** 0–1, applies to the fill only. */
  fillOpacity?: number;
  /** 0–1, applies to the whole object. */
  opacity?: number;
  /** Dash length in world units; 0 or undefined = solid. */
  dash?: number;
}

export type ObjectType = Geometry["kind"];

export interface VectorObject {
  id: string;
  name: string;
  type: ObjectType;
  geometry: Geometry;
  transform: Transform;
  style: Style;
  layerId: string;
  visible: boolean;
  locked: boolean;
  /**
   * Identity of the grid cell this object was painted from. Present only on
   * cell-painted shapes; it lets a second click recolour or erase the same cell
   * instead of stacking duplicates.
   */
  cellKey?: string | undefined;
}

export const IDENTITY_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

export const DEFAULT_STYLE: Style = {
  stroke: "#e8eaf0",
  strokeWidth: 2,
  fill: "none",
};
