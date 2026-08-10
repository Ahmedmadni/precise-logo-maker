import type { SnapResult } from "../../core/snapping/snap";

interface SnapIndicatorProps {
  snap: SnapResult;
  zoom: number;
}

/** Distinct glyph per snap type, drawn at constant screen size. */
export function SnapIndicator({ snap, zoom }: SnapIndicatorProps) {
  const r = 6 / zoom;
  const { x, y } = snap.point;
  const color = "var(--color-accent-foreground)";
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.5,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <g pointerEvents="none">
      {snap.type === "intersection" && (
        <>
          <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} {...common} />
          <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} {...common} />
        </>
      )}
      {snap.type === "midpoint" && (
        <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} {...common} />
      )}
      {snap.type === "center" && <circle cx={x} cy={y} r={r} {...common} />}
      {snap.type === "endpoint" && (
        <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...common} />
      )}
      {snap.type === "quadrant" && (
        <polygon points={`${x},${y - r} ${x + r},${y + r} ${x - r},${y + r}`} {...common} />
      )}
      {snap.type === "grid" && (
        <>
          <line x1={x - r} y1={y} x2={x + r} y2={y} {...common} />
          <line x1={x} y1={y - r} x2={x} y2={y + r} {...common} />
        </>
      )}
      {snap.type === "nearest" && (
        <circle cx={x} cy={y} r={r * 0.6} {...common} strokeDasharray="3 3" />
      )}
    </g>
  );
}
