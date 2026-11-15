import type { LetteringItem } from "../../calligraphy/model";
import { worldJoinAnchor } from "../../calligraphy/contourComposer";

/** Join markers exist ONLY on the editor canvas; never in SVG export. */
export function GlyphJoinOverlay({ item, zoom }: { item: LetteringItem; zoom: number }) {
  const entry = worldJoinAnchor(item, "entry");
  const exit = worldJoinAnchor(item, "exit");
  if (!entry || !exit) return null;
  return (
    <g aria-label="نقاط دخول وخروج الحرف" pointerEvents="all">
      <line x1={entry.x} y1={entry.y} x2={exit.x} y2={exit.y}
        stroke="#d1a95e" strokeOpacity={0.5} strokeDasharray={`${4 / zoom} ${4 / zoom}`}
        strokeWidth={1.5 / zoom} pointerEvents="none" />
      {([{ side: "entry", point: entry, color: "#34c5b0" },
        { side: "exit", point: exit, color: "#e3a84e" }] as const).map(({ side, point, color }) =>
        <g key={side} data-join-side={side} className="cursor-crosshair">
          <circle cx={point.x} cy={point.y} r={19 / zoom} fill="transparent" stroke="none" pointerEvents="all" />
          <circle cx={point.x} cy={point.y} r={7 / zoom} fill={color}
            stroke="#13191b" strokeWidth={1.5 / zoom} pointerEvents="none" />
        </g>,
      )}
    </g>
  );
}
