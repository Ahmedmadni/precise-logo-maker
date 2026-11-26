import {describe,it,expect} from "vitest";
import {autosavePayload,parseProject,preferLargeSnapshot,type SavedSnapshot} from "./project";
import type {DocumentState} from "../store/studioStore";
const doc={artboard:{width:100,height:100},objects:[],grids:[],lettering:[],reference:null} as unknown as DocumentState;
const stamp="2026-11-25T10:00:00.000Z";
const snapshot=(savedAt=stamp,partial=false):SavedSnapshot=>({document:doc,savedAt,partial});
describe("local recovery snapshots",()=>{
  it("prefers the complete IndexedDB copy over an equally recent drawing-only copy",()=>{
    expect(preferLargeSnapshot(snapshot(stamp,true),snapshot())).toBe(true);
    expect(preferLargeSnapshot(snapshot(),snapshot(stamp,true))).toBe(false);
  });
  it("preserves the most recent edit even if its reference was omitted",()=>{
    expect(preferLargeSnapshot(snapshot("2026-11-25T10:01:00.000Z",true),snapshot())).toBe(false);
    expect(preferLargeSnapshot(snapshot(),snapshot("2026-11-25T10:01:00.000Z"))).toBe(true);
  });
  it("supports missing or malformed timestamps",()=>{
    expect(preferLargeSnapshot(null,snapshot())).toBe(true);
    expect(preferLargeSnapshot(snapshot(),null)).toBe(false);
    expect(preferLargeSnapshot(snapshot("invalid"),snapshot())).toBe(true);
  });
  it("preserves the shared timestamp and project parser compatibility",()=>{
    const raw=autosavePayload(doc,stamp,true);
    expect(JSON.parse(raw)).toMatchObject({savedAt:stamp,partial:true});
    expect(parseProject(raw)).toEqual(doc);
    expect(raw.includes("\\n")).toBe(false);
  });
});

describe("project import integrity",()=>{
  const raw=(patch:object)=>JSON.stringify({format:"logo-grid-studio",version:2,document:{...doc,...patch}});
  it("rejects nonpositive or malformed artboard dimensions",()=>{
    expect(parseProject(raw({artboard:{width:0,height:100}}))).toBeNull();
    expect(parseProject(raw({artboard:{width:"100",height:100}}))).toBeNull();
  });
  it("rejects malformed objects and cubic controls",()=>{
    const base={id:"o",name:"Path",style:{stroke:"#000",fill:"none",strokeWidth:1}};
    expect(parseProject(raw({objects:[null]}))).toBeNull();
    expect(parseProject(raw({objects:[{...base,geometry:{kind:"path",closed:false,points:[{x:0,y:0},{x:1,y:1}],cubicSegments:[{control1:{x:0,y:1}}]}}]}))).toBeNull();
  });
  it("rejects malformed lettering and unsupported versions",()=>{
    expect(parseProject(raw({lettering:[{id:"g",kind:"outline",x:0,y:0,size:null,rotation:0,color:"#000"}]}))).toBeNull();
    expect(parseProject(JSON.stringify({format:"logo-grid-studio",version:-1,document:doc}))).toBeNull();
  });
});
