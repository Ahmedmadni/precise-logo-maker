import { describe, expect, it } from "vitest";
import { insertPathNode, deletePathNode } from "../../editor/path-nodes";
import type { PathGeometry } from "../geometry/types";

const open: PathGeometry = { kind: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 20 }], closed: false };
describe("path node editing", () => {
  it("inserts the exact midpoint without mutating the path", () => {
    expect(insertPathNode(open, 0).points).toEqual([{ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 20 }]);
    expect(open.points).toHaveLength(2);
  });
  it("inserts on the closing edge", () => {
    const path = { ...open, closed: true, points: [...open.points, { x: 20, y: 0 }] };
    expect(insertPathNode(path, 2).points[3]).toEqual({ x: 10, y: 0 });
  });
  it("does not extend an open path past its last node", () => expect(insertPathNode(open, 1)).toBe(open));
  it("preserves the minimum viable path", () => expect(deletePathNode(open, 0)).toBe(open));
  it("deletes a node while preserving the others", () => expect(deletePathNode(insertPathNode(open, 0), 1)).toEqual(open));
});