import {describe,it,expect} from "vitest";
import {estimateRetained,trimUndo,jumpHistory} from "./historyBudget";
const entry=<T extends object>(label:string,state:T)=>({label,state});
describe("history budget",()=>{
  it("does not repeatedly charge unchanged shared artwork and fonts",()=>{
    const data="a".repeat(2000000),geometry={points:[{x:1,y:2}]};
    const old={font:data,objects:[geometry],x:0};
    const next={...old,x:1};
    expect(estimateRetained(old,next)).toBeLessThan(1000);
  });
  it("keeps the latest undo even when a single change exceeds the budget",()=>{
    const a={path:"a".repeat(1000)},b={path:"b".repeat(1000)},c={path:"c".repeat(1000)};
    expect(trimUndo([entry("A",a),entry("B",b)],c,100)).toEqual([entry("B",b)]);
  });
  it("keeps a contiguous suffix under the count limit",()=>{
    const past=[0,1,2,3].map(n=>entry(String(n),{n}));
    expect(trimUndo(past,{n:4},100000,2)).toEqual(past.slice(2));
  });
  it("preserves existing redo operations when jumping backward",()=>{
    const past=[entry("first",{n:0}),entry("second",{n:1})];
    const future=[entry("third",{n:3})];
    const result=jumpHistory(past,future,{n:2},0);
    expect(result).toEqual({state:{n:0},past:[],future:[entry("first",{n:1}),entry("second",{n:2}),entry("third",{n:3})]});
    expect(jumpHistory(past,future,{n:2},-1)).toBeNull();
  });
});
