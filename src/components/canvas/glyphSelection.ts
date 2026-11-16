import type { LetteringItem } from "../../calligraphy/model";
import { glyphPointToWorld, type PathNode } from "../../calligraphy/pathEditor";

export interface OverlapTap {
  ids: string[];
  point: { x: number; y: number };
  time: number;
  index: number;
}

/**
 * On repeated taps over the same stack, select the next element rather than
 * always returning the topmost glyph. Never infer Unicode letters from glyph IDs.
 */
export function chooseOverlappingGlyph(
  ids: string[],
  point: { x: number; y: number },
  time: number,
  previous: OverlapTap | null,
): OverlapTap | null {
  if (!ids.length) return null;
  const sameStack = previous && previous.ids.length === ids.length &&
    previous.ids.every((id, i) => id === ids[i]);
  const repeated = sameStack && time - previous.time >= 0 && time - previous.time <= 1400 &&
    Math.hypot(point.x - previous.point.x, point.y - previous.point.y) <= 16;
  return { ids, point, time, index: repeated ? (previous.index + 1) % ids.length : 0 };
}

/** Keep far-apart anchors visible. Show control points only near the chosen
 * anchor, so a dense Arabic contour no longer becomes a wall of touch targets.
 * Every point remains accessible by its numeric ID in the inspector. */
export function visibleBezierNodes(
  all: PathNode[], selectedId: number | null, glyph: LetteringItem, zoom: number,
  showAll = false,
): PathNode[] {
  if (showAll) return all;
  const selected = all.find((n) => n.id === selectedId);
  const chosen: PathNode[] = [];
  const placed: { x: number; y: number }[] = [];
  const minimumScreenGap = 23;
  for (const node of all) {
    if (node.role === "control") {
      const nearby = selected && Math.abs(node.id - selected.id) <= 2;
      if (node.id === selectedId || nearby) chosen.push(node);
      continue;
    }
    const world = glyphPointToWorld(glyph, node.x, node.y);
    const pos = { x: world.x * zoom, y: world.y * zoom };
    const separated = placed.every((p) => Math.hypot(pos.x - p.x, pos.y - p.y) >= minimumScreenGap);
    if (node.id === selectedId || separated) {
      chosen.push(node);
      placed.push(pos);
    }
  }
  // If a selected node lies under another SVG handle, render it last to win hit testing.
  return chosen.sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
}

/** Element stacking is read from the browser, but the core de-duplication is testable. */
export function uniqueGlyphStack(
  orderedIds: string[], validIds: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  return orderedIds.filter((id) => {
    if (!validIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
