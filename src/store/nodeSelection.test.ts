import {beforeEach,describe,it,expect} from "vitest";
import {useStudio} from "./studioStore";
import type {PathGeometry} from "../core/geometry/types";

function setup(){
  const s=useStudio.getState();
  const geometry:PathGeometry={kind:"path",points:[{x:0,y:0},{x:20,y:0},{x:40,y:0}],closed:false};
  const id=s.addObject(geometry,"Test path");
  s.setSelection([id]);s.setNodeLassoTarget(id);
  s.setPathNodeSelection({objectId:id,geometry,indices:[1]});
  return {id,geometry};
}
describe("scoped path node selection",()=>{
  beforeEach(()=>useStudio.getState().newDocument());
  it("moves the selected anchor only and rebinds its geometry for the next edit",()=>{
    const {id,geometry}=setup(),s=useStudio.getState();
    expect(s.moveSelectedPathNodes(id,geometry,[1],0,10)).toBe(true);
    const current=useStudio.getState().pathNodeSelection;
    expect(current?.geometry.points).toEqual([{x:0,y:0},{x:20,y:10},{x:40,y:0}]);
    expect(current?.indices).toEqual([1]);
    expect(s.moveSelectedPathNodes(id,geometry,[1],0,10)).toBe(false);
    if(!current)throw Error("missing selection");
    expect(s.moveSelectedPathNodes(id,current.geometry,[1],0,1)).toBe(true);
  });
  it("rejects stale indices and no-op movement",()=>{
    const {id,geometry}=setup(),s=useStudio.getState();
    expect(s.moveSelectedPathNodes(id,geometry,[0],0,10)).toBe(false);
    expect(s.moveSelectedPathNodes(id,geometry,[1],0,0)).toBe(false);
    expect(useStudio.getState().doc.objects.find(o=>o.id===id)?.geometry).toBe(geometry);
  });
  it("clears the node selection when exiting lasso mode",()=>{
    const {id,geometry}=setup(),s=useStudio.getState();
    s.setNodeLassoTarget(null);
    expect(useStudio.getState().pathNodeSelection).toBeNull();
    expect(s.moveSelectedPathNodes(id,geometry,[1],0,10)).toBe(false);
  });
});
