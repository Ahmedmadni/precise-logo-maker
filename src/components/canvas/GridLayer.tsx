import { memo, useMemo } from "react";
import { buildGridGeometry, type Grid } from "../../grids";
import { geometryToPathData } from "../../objects/render";

interface GridLayerProps {
  grid: Grid;
}

/**
 * Renders one grid as its own SVG group. Memoized on the grid object so panning,
 * drawing, or moving objects never re-serializes grid geometry.
 */
export const GridLayer = memo(function GridLayer({ grid }: GridLayerProps) {
  const built = useMemo(() => buildGridGeometry(grid), [grid]);
  if (!grid.visible) return null;

  return (
    <g opacity={grid.opacity} data-grid-id={grid.id}>
      {built.minor.length > 0 && (
        <path
          d={built.minor.map(geometryToPathData).join(" ")}
          fill="none"
          stroke={grid.color}
          strokeWidth={grid.strokeWidth * 0.6}
          opacity={0.45}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={built.major.map(geometryToPathData).join(" ")}
        fill="none"
        stroke={grid.color}
        strokeWidth={grid.strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
});
