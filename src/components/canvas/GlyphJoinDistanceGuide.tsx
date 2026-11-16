import type { LetteringItem } from "../../calligraphy/model";
import { analyzeJoin, type JoinGuideSelection } from "../../calligraphy/joinAssistant";

/** Editor-only measurement overlay, never part of SVG/PNG exports. */
export function GlyphJoinDistanceGuide({
  source, target, sides, zoom,
}: {
  source: LetteringItem;
  target: LetteringItem;
  sides: JoinGuideSelection;
  zoom: number;
}) {
  const analysis = analyzeJoin(source, sides.sourceSide, target, sides.targetSide);
  if (!analysis || !Number.isFinite(zoom) || zoom <= 0) return null;
  const { from, to, distance } = analysis;
  const middleX = (from.x + to.x) / 2;
  const middleY = (from.y + to.y) / 2;
  const onTarget = distance < 0.5;
  return (
    <g pointerEvents="none" aria-label="معاينة المسافة بين نقاط اتصال الحروف">
      {!onTarget && <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke="#16a4b3" strokeWidth={1.7 / zoom}
        strokeDasharray={`${5 / zoom} ${4 / zoom}`} opacity={0.92} />}
      {[{ point: from, color: "#16a4b3" }, { point: to, color: "#e0a047" }].map(({ point, color }, index) =>
        <circle key={index} cx={point.x} cy={point.y} r={5 / zoom} fill={color}
          stroke="#102022" strokeWidth={1.2 / zoom} />)}
      <g transform={`translate(${middleX} ${middleY - 14 / zoom}) scale(${1 / zoom})`}>
        <rect x={-37} y={-21} width={74} height={23} rx={6}
          fill="#17232b" fillOpacity={0.92} />
        <text x={0} y={-5} textAnchor="middle" fontSize={11}
          fill="#ffffff" fontFamily="sans-serif">
          {onTarget ? "متطابق" : `${distance.toFixed(1)} وحدة`}
        </text>
      </g>
    </g>
  );
}
