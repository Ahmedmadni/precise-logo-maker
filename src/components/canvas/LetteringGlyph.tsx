import { memo } from "react";
import type { LetteringItem } from "../../calligraphy/model";
import { HARAKAT, ORNAMENTS, fontFamily, letteringTransform, safePath } from "../../calligraphy/model";

export const LetteringGlyph = memo(function LetteringGlyph({ item, selected, offset, overridePath }: {
  item: LetteringItem;
  selected: boolean;
  offset?: { x: number; y: number } | null;
  overridePath?: string | null;
}) {
  const size = Math.max(1, Math.min(1000, item.size));
  const itemToDraw = offset ? { ...item, x: item.x + offset.x, y: item.y + offset.y } : item;
  const transform = letteringTransform(itemToDraw);
  const mark = item.kind === "haraka" ? HARAKAT.find((m) => m.id === item.mark)
    : item.kind === "ornament" ? ORNAMENTS.find((m) => m.id === item.ornament) : null;
  const unit = item.unitsPerEm && item.unitsPerEm > 0 ? item.unitsPerEm : 1000;
  const scale = size / unit;
  const outline = item.kind === "outline" ? safePath(overridePath ?? item.pathData) : "";
  return (
    <g data-lettering-id={item.id} transform={transform}>
      {outline ? (
        <>
        <path d={outline} transform={`scale(${scale} ${-scale})`}
          fill={item.color} stroke={item.color}
          strokeWidth={Math.max(0, item.weight ?? 0) / scale}
          strokeLinejoin="round"
          style={selected ? { filter: "drop-shadow(0 0 1.8px var(--color-primary))" } : undefined} />
        <path d={outline} transform={`scale(${scale} ${-scale})`} fill="none"
          stroke="transparent" strokeWidth={Math.max(14, item.weight ?? 0) / scale}
          pointerEvents="stroke" aria-hidden="true" />
        </>
      ) : mark ? (
        <path d={mark.path}
          transform={`translate(${-size / 2} ${-size / 2}) scale(${size / 100})`}
          fill={item.color} fillRule="evenodd"
          stroke={selected ? "var(--color-primary)" : "none"}
          strokeWidth={selected ? 4 : 0} />
      ) : item.kind === "text" ? (
        <text x={0} y={0} fontSize={size} fontFamily={fontFamily(item.font)}
          direction="rtl" unicodeBidi="plaintext" textAnchor="middle"
          fill={item.color} stroke={selected ? "var(--color-primary)" : "none"}
          strokeWidth={selected ? 0.4 : 0} paintOrder="stroke">
          {item.text}
        </text>
      ) : null}
    </g>
  );
});
