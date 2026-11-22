import { describe, expect, it } from "vitest";
import { createLettering } from "../../calligraphy/model";
import { parseProject, serializeProject } from "../../objects/project";
import { useStudio, type DocumentState } from "../studioStore";

const first={...createLettering(100,120),id:"first",kind:"outline" as const,
  pathData:"M0 0 L40 0 L40 40 L0 40 Z"};
const second={...createLettering(300,120),id:"second",kind:"outline" as const,
  pathData:"M0 0 L20 0 L20 20 L0 20 Z"};
const doc:DocumentState={artboard:{width:600,height:400,unit:"px",background:"#ffffff"},
  grids:[],objects:[],lettering:[first,second]};

describe("shared desktop and Android Arabic inspector navigation",()=>{
  it("preserves the current tool group across glyph selection without saving it into .logo",()=>{
    const previous=useStudio.getState();
    try{
      useStudio.setState({doc,selectedLetteringId:first.id,
        glyphInspectorTab:"basic", workspaceSection:"edit",tool:"select",
        letteringPreview:null,editGlyphNodes:false,editGlyphContours:false,
        editJoinAnchors:false,selectedGlyphNodeId:null,selectedContourIndex:null,
        joinGuide:null,past:[],future:[]});
      const state=useStudio.getState();
      state.setGlyphInspectorTab("paths");
      expect(useStudio.getState().glyphInspectorTab).toBe("paths");
      expect(useStudio.getState().doc).toBe(doc);
      expect(useStudio.getState().past).toHaveLength(0);

      useStudio.getState().setEditGlyphNodes(true);
      useStudio.getState().setSelectedGlyphNodeId(1);
      useStudio.getState().selectLettering(second.id);
      const selected=useStudio.getState();
      expect(selected.glyphInspectorTab).toBe("paths");
      expect(selected.selectedLetteringId).toBe(second.id);
      expect(selected.editGlyphNodes).toBe(false);
      expect(selected.selectedGlyphNodeId).toBeNull();
      expect(selected.past).toHaveLength(0);
      const saved=serializeProject(selected.doc);
      expect(saved).not.toContain("glyphInspectorTab");
      expect(parseProject(saved)?.lettering?.[0]?.pathData).toBe(first.pathData);
    }finally{useStudio.setState(previous,true);}
  });

  it("switches exclusive canvas modes cleanly and keeps Undo for actual edits only",()=>{
    const previous=useStudio.getState();
    try{
      useStudio.setState({doc,selectedLetteringId:first.id,
        glyphInspectorTab:"basic",workspaceSection:"edit",tool:"select",
        letteringPreview:null,editGlyphNodes:false,editGlyphContours:false,
        editJoinAnchors:false,selectedGlyphNodeId:null,selectedContourIndex:null,
        joinGuide:null,past:[],future:[]});

      useStudio.getState().setGlyphInspectorTab("paths");
      useStudio.getState().setEditGlyphNodes(true);
      useStudio.getState().setSelectedGlyphNodeId(1);
      useStudio.getState().setGlyphInspectorTab("joins");
      expect(useStudio.getState()).toMatchObject({
        glyphInspectorTab:"joins",editJoinAnchors:true,
        editGlyphNodes:false,editGlyphContours:false,selectedGlyphNodeId:null,
      });
      useStudio.getState().setGlyphInspectorTab("basic");
      expect(useStudio.getState().editJoinAnchors).toBe(false);
      expect(useStudio.getState().past).toHaveLength(0);

      useStudio.getState().setLetteringPreview(first.id,{x:first.x+15});
      useStudio.getState().setGlyphInspectorTab("alternates");
      expect(useStudio.getState().doc.lettering?.[0]?.x).toBe(first.x+15);
      expect(useStudio.getState().letteringPreview).toBeNull();
      expect(useStudio.getState().past).toHaveLength(1);
      useStudio.getState().undo();
      expect(useStudio.getState().doc.lettering?.[0]?.x).toBe(first.x);
      useStudio.getState().redo();
      expect(useStudio.getState().doc.lettering?.[0]?.x).toBe(first.x+15);
    }finally{useStudio.setState(previous,true);}
  });

  it("resets stale canvas modes and remembered tabs when a different document opens",()=>{
    const previous=useStudio.getState();
    try{
      useStudio.setState({doc,selectedLetteringId:first.id,tool:"select",
        workspaceSection:"edit",glyphInspectorTab:"paths",
        editGlyphNodes:true,editGlyphContours:false,editJoinAnchors:false,
        selectedGlyphNodeId:1,selectedContourIndex:2,
        joinGuide:null,letteringPreview:null});
      const fresh:DocumentState={
        artboard:{width:320,height:320,unit:"px",background:"#000000"},
        grids:[],objects:[],lettering:[],
      };
      useStudio.getState().loadDocument(fresh,"Open other design");
      const after=useStudio.getState();
      expect(after.doc).toBe(fresh);
      expect(after.glyphInspectorTab).toBe("basic");
      expect(after.editGlyphNodes).toBe(false);
      expect(after.editGlyphContours).toBe(false);
      expect(after.editJoinAnchors).toBe(false);
      expect(after.selectedGlyphNodeId).toBeNull();
      expect(after.selectedContourIndex).toBeNull();
      expect(after.selectedLetteringId).toBeNull();
    }finally{useStudio.setState(previous,true);}
  });

  it("supports a direct Android nodes/joins shortcut after changing workspaces",()=>{
    const previous=useStudio.getState();
    try{
      useStudio.setState({doc,selectedLetteringId:first.id,
        glyphInspectorTab:"basic",workspaceSection:"layers",tool:"pen",
        editGlyphNodes:false,editGlyphContours:false,editJoinAnchors:false,
        letteringPreview:null,joinGuide:null});
      useStudio.getState().setWorkspaceSection("edit");
      useStudio.getState().setGlyphInspectorTab("joins");
      useStudio.getState().setEditJoinAnchors(true);
      expect(useStudio.getState()).toMatchObject({
        workspaceSection:"edit",glyphInspectorTab:"joins",
        editJoinAnchors:true,editGlyphNodes:false,tool:"select",
      });
      useStudio.getState().setGlyphInspectorTab("paths");
      useStudio.getState().setEditGlyphNodes(true);
      expect(useStudio.getState()).toMatchObject({
        glyphInspectorTab:"paths",editGlyphNodes:true,editJoinAnchors:false,
      });
      useStudio.getState().setEditGlyphNodes(false);
      expect(useStudio.getState().editGlyphNodes).toBe(false);
    }finally{useStudio.setState(previous,true);}
  });
});
