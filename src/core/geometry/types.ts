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

export type Geometry = CircleGeometry | LineGeometry | ArcGeometry;

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
