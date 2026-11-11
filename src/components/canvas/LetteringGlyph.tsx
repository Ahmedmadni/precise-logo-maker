import type { LetteringItem } from "../../calligraphy/model";
import { HARAKAT, fontFamily } from "../../calligraphy/model";

export function LetteringGlyph({ item, selected, offset }: {
  item: LetteringItem;
  selected: boolean;
  offset?: { x: number; y: number } | null;
}) {
  const size = Math.max(1, item.size);
  const transform = `translate(${item.x + (offset?.x ?? 0)} ${item.y + (offset?.y ?? 0)}) rotate(${item.rotation})`;
  const mark = item.kind === "haraka" ? HARAKAT.find((m) => m.id === item.mark) : null;
  return (
    <g data-lettering-id={item.id} transform={transform} opacity={selected ? 0.9 : 1}>
      {mark ? (
        <path d={mark.path}
          transform={`translate(${-size / 2} ${-size / 2}) scale(${size / 100})`}
          fill={item.color} fillRule="evenodd"
          stroke={selected ? "var(--color-primary)" : "none"}
          strokeWidth={selected ? 5 : 0} />
      ) : (
        <text x={0} y={0} fontSize={size} fontFamily={fontFamily(item.font)}
          direction="rtl" unicodeBidi="plaintext" textAnchor="middle"
          fill={item.color} stroke={selected ? "var(--color-primary)" : "none"}
          strokeWidth={selected ? 0.5 : 0} paintOrder="stroke"
          style={{ fontVariantLigatures: "normal" }}>
          {item.text}
        </text>
      )}
    </g>
  );
}
