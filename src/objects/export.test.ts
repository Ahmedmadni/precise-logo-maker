import {describe,it,expect} from "vitest";
import {pngDimensions,buildSvgDocument,hasExportLiveText} from "./export";
import type {DocumentState} from "../store/studioStore";
const doc={artboard:{width:800,height:400,unit:"px",background:"#fff"},objects:[],grids:[],lettering:[]} as DocumentState;
describe("export safety",()=>{
  it("preserves aspect ratio and guards raster allocation",()=>{
    expect(pngDimensions(doc.artboard,2048)).toEqual({width:2048,height:1024});
    expect(pngDimensions({width:400,height:800},2048)).toEqual({width:2048,height:4096});
    expect(pngDimensions({width:400,height:800},4096)).toBeNull();
    expect(pngDimensions({width:0,height:800},1024)).toBeNull();
    expect(pngDimensions(doc.artboard,Infinity)).toBeNull();
  });
  it("keeps the original SVG viewBox while setting raster viewport size",()=>{
    const svg=buildSvgDocument(doc,{background:false},{width:2048,height:1024});
    expect(svg).toContain('width="2048" height="1024" viewBox="0 0 800 400"');
    expect(svg).not.toContain("<rect");
    expect(buildSvgDocument(doc)).toContain('<rect width="800" height="400"');
  });
  it("rejects invalid artboard dimensions",()=>{
    expect(()=>buildSvgDocument({...doc,artboard:{...doc.artboard,width:NaN}})).toThrow();
  });
  it("flags visible live text only",()=>{
    const item={id:"text",kind:"text" as const,x:100,y:100,size:50,rotation:0,color:"#fff",text:"خط"};
    expect(hasExportLiveText({...doc,lettering:[item]})).toBe(true);
    expect(hasExportLiveText({...doc,lettering:[{...item,hidden:true}]})).toBe(false);
    expect(hasExportLiveText(doc)).toBe(false);
  });
});
