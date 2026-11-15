import type { CalligraphyGuideSettings } from "../../calligraphy/harakaAnchoring";

const GUIDE_ROWS = [
  { id: "upper", label: "حد علوي", key: "upperOffset", color: "#7c93a3" },
  { id: "ascender", label: "ارتفاع الحروف", key: "ascenderOffset", color: "#d0a85d" },
  { id: "baseline", label: "سطر الأساس", key: null, color: "#cfa13d" },
  { id: "lower", label: "حد سفلي", key: "lowerOffset", color: "#7c93a3" },
  { id: "descender", label: "نزول الحروف", key: "descenderOffset", color: "#d0a85d" },
] as const;

/** Editor-only guides: SVG export deliberately omits them. */
export function CalligraphyGuides({ settings, width }: {
  settings: CalligraphyGuideSettings;
  width: number;
}) {
  if (!settings.visible) return null;
  return (
    <g aria-label="سطور الخط العربي المساعدة" pointerEvents="none">
      {GUIDE_ROWS.map((guide) => {
        const y = settings.baselineY + (guide.key ? settings[guide.key] : 0);
        return (
          <g key={guide.id}>
            <line x1={0} y1={y} x2={width} y2={y} stroke={guide.color}
              strokeWidth={guide.id === "baseline" ? 1.5 : 1}
              strokeDasharray={guide.id === "baseline" ? "none" : "9 7"}
              opacity={guide.id === "baseline" ? 0.78 : 0.45}
              vectorEffect="non-scaling-stroke" />
            <text x={Math.max(3, width - 12)} y={y - 5} textAnchor="end" fontSize="13"
              fill={guide.color} opacity={0.75}>{guide.label}</text>
          </g>
        );
      })}
    </g>
  );
}
