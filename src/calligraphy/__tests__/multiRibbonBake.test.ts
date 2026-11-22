import { describe, expect, it } from "vitest";
import { createHaraka, createLettering, type LetteringItem } from "../model";
import { bakeRibbonAsOutline, inspectRibbonChain } from "../bakeUnion";
import { createRibbonLink } from "../ribbonJoin";
import { outlineContours } from "../contourComposer";
import { buildSvgDocument } from "../../objects/export";
import { parseProject, serializeProject } from "../../objects/project";
import { useStudio, type DocumentState } from "../../store/studioStore";

const outlined = (id:string,x:number):LetteringItem=>({
  ...createLettering(x,0),id,kind:"outline",color:"#18232b",
  size:1000,unitsPerEm:1000,rotation:0,
  pathData:"M0 0 L40 0 L40 30 L0 30 Z",
  joinAnchors:{entry:{x:5,y:15},exit:{x:35,y:15}},
});
const source:LetteringItem={
  ...outlined("first",0),
  pathData:"M0 0 L40 0 L40 30 L0 30 Z M10 10 L10 20 L20 20 L20 10 Z",
};
const middle=outlined("middle",75);
const last=outlined("last",150);
const link=(a:LetteringItem,b:LetteringItem):LetteringItem=>{
  const item=createRibbonLink(a,b,"exit","entry")!;
  return {...item,ribbon:{...item.ribbon!,
    startOverlap:10,endOverlap:10,startWidth:12,endWidth:12}};
};
const ab=link(source,middle),bc=link(middle,last);
const doc=(lettering:LetteringItem[]):DocumentState=>({
  artboard:{width:450,height:350,unit:"px",background:"#ffffff"},
  grids:[],objects:[],lettering,
});

describe("topology-safe multi-glyph ribbon chain baking",()=>{
  it("detects a two-bridge three-glyph path from either selected bridge",()=>{
    for(const id of [ab.id,bc.id]){
      const result=inspectRibbonChain([source,middle,last,ab,bc],id);
      expect(result).toEqual({ok:true,glyphCount:3,ribbonCount:2});
    }
    const old=inspectRibbonChain([source,middle,ab],ab.id);
    expect(old).toEqual({ok:true,glyphCount:2,ribbonCount:1});
  });

  it("bakes all connected glyphs and links while keeping original counters and SVG export",()=>{
    const input=[source,middle,last,ab,bc];
    const result=bakeRibbonAsOutline(input,bc.id);
    if(!result.ok)throw Error(result.reason);
    expect(result.sourceIds).toEqual([source.id,middle.id,last.id,ab.id,bc.id]);
    expect(result.outline.bakedSourceIds).toEqual(result.sourceIds);
    expect(result.outline.pathData).not.toContain("NaN");
    expect(result.outline.fillRule).toBe("evenodd");
    expect(outlineContours(result.outline.pathData!).some(c=>
      c.bounds.minX>=9.8&&c.bounds.maxX<=20.2&&
      c.bounds.minY>=9.8&&c.bounds.maxY<=20.2)).toBe(true);
    const hidden=input.map(x=>({...x,hidden:true}));
    const restored=parseProject(serializeProject(doc([...hidden,result.outline])))!;
    expect(restored.lettering).toHaveLength(6);
    expect(restored.lettering!.filter(x=>x.hidden)).toHaveLength(5);
    const svg=buildSvgDocument(restored,{background:false});
    expect(svg).toContain('fill-rule="evenodd"');
    expect((svg.match(/<path /g)??[])).toHaveLength(1);
    expect(source.pathData).toContain("M10 10");
  });

  it("retargets marks on every glyph in the chain and restores originals atomically",()=>{
    const state=useStudio.getState();
    const marks=[source,middle,last].map((g,index)=>({
      ...createHaraka("shadda",g.x+10,-45),id:"mark-"+index,
      attachedToGlyphId:g.id,anchorMode:"auto" as const,
    }));
    try {
      useStudio.setState({doc:doc([source,middle,last,ab,bc,...marks]),
        past:[],future:[],selectedLetteringId:bc.id,letteringPreview:null});
      expect(useStudio.getState().bakeLetteringJoin(bc.id).ok).toBe(true);
      let items=useStudio.getState().doc.lettering!;
      const welded=items.find(x=>x.kind==="outline"&&x.bakedSourceIds)!;
      expect(welded.bakedSourceIds).toEqual([source.id,middle.id,last.id,ab.id,bc.id]);
      expect(items.filter(x=>x.hidden)).toHaveLength(5);
      for(const mark of marks){
        const current=items.find(x=>x.id===mark.id)!;
        expect(current.attachedToGlyphId).toBe(welded.id);
        expect(current.anchorMode).toBe("manual");
        expect(current.bakedOriginalAttachment).toEqual({
          glyphId:mark.attachedToGlyphId,anchorMode:"auto",
        });
      }
      const prev=items.find(x=>x.id===marks[1]!.id)!.x;
      useStudio.getState().moveLettering(welded.id,15,6);
      items=useStudio.getState().doc.lettering!;
      expect(items.find(x=>x.id===marks[1]!.id)!.x).toBe(prev+15);
      useStudio.getState().toggleBakedVersion(welded.id);
      items=useStudio.getState().doc.lettering!;
      expect(items.find(x=>x.id===welded.id)!.hidden).toBe(true);
      expect(items.filter(x=>x.kind==="bridge"&&!x.hidden)).toHaveLength(2);
      for(const mark of marks){
        const restored=items.find(x=>x.id===mark.id)!;
        expect(restored.attachedToGlyphId).toBe(mark.attachedToGlyphId);
        expect(restored.anchorMode).toBe("auto");
      }
      useStudio.getState().toggleBakedVersion(welded.id);
      items=useStudio.getState().doc.lettering!;
      expect(items.find(x=>x.id===welded.id)!.hidden).toBe(false);
      expect(items.filter(x=>x.hidden)).toHaveLength(5);
      for(const mark of marks)expect(items.find(x=>x.id===mark.id)!.attachedToGlyphId).toBe(welded.id);
    } finally {
      useStudio.setState({doc:state.doc,past:state.past,future:state.future,
        selectedLetteringId:state.selectedLetteringId,
        letteringPreview:state.letteringPreview});
    }
  });

  it("does not merge a fork, a cycle or duplicate parallel links",()=>{
    const other=outlined("other",230);
    const branch=link(middle,other);
    const fork=[source,middle,last,other,ab,bc,branch];
    expect(inspectRibbonChain(fork,bc.id).ok).toBe(false);
    expect(bakeRibbonAsOutline(fork,bc.id).ok).toBe(false);

    const cycle=link(last,source);
    const ring=[source,middle,last,ab,bc,cycle];
    expect(inspectRibbonChain(ring,ab.id).ok).toBe(false);
    const duplicate={...bc,id:"duplicate-ribbon"};
    expect(inspectRibbonChain([source,middle,last,ab,bc,duplicate],bc.id).ok).toBe(false);
  });

  it("rejects a hidden, differently colored or disconnected segment without changing inputs",()=>{
    const all=[source,middle,last,ab,bc];
    expect(bakeRibbonAsOutline([source,{...middle,hidden:true},last,ab,bc],ab.id).ok).toBe(false);
    expect(bakeRibbonAsOutline([source,{...middle,color:"#ffffff"},last,ab,bc],ab.id).ok).toBe(false);
    const displaced={...last,joinAnchors:{...last.joinAnchors,entry:{x:-50,y:15}}};
    expect(bakeRibbonAsOutline([source,middle,displaced,ab,bc],ab.id).ok).toBe(false);
    expect(bakeRibbonAsOutline(all,"bad-id").ok).toBe(false);
    expect(source.pathData).toContain("M10 10");
    expect(middle.hidden).toBeUndefined();
  });

  it("keeps other disconnected chains out of a selected component",()=>{
    const x=outlined("x",300),y=outlined("y",375),extra=link(x,y);
    const items=[source,middle,last,ab,bc,x,y,extra];
    const result=bakeRibbonAsOutline(items,ab.id);
    if(!result.ok)throw Error(result.reason);
    expect(result.sourceIds).toHaveLength(5);
    expect(result.sourceIds).not.toContain(x.id);
    expect(result.sourceIds).not.toContain(extra.id);
  });
});
