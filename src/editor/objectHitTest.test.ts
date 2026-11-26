import {describe,it,expect} from "vitest";
import {hitObject} from "./objectHitTest";
import {DEFAULT_STYLE,IDENTITY_TRANSFORM,type Geometry,type VectorObject} from "../core/geometry/types";
const guide={locked:false,hidden:false,edit:false};
const box=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const object=(id:string,geometry:Geometry,patch:Partial<VectorObject>={}):VectorObject=>({id,name:id,type:geometry.kind,geometry,transform:IDENTITY_TRANSFORM,style:{...DEFAULT_STYLE,fill:"#000"},layerId:"test",visible:true,locked:false,...patch});
describe("object hit testing",()=>{
  const g:Geometry={kind:"path",closed:true,points:box(0,0,100,100),holes:[box(30,30,40,40)]};
  it("selects inside filled material but not inside a hole",()=>{
    expect(hitObject([object("compound",g)],{x:15,y:15},1,8,guide)).toBe("compound");
    expect(hitObject([object("compound",g)],{x:50,y:50},1,8,guide)).toBeNull();
  });
  it("selects the topmost directly hit visible object",()=>{
    const circle:Geometry={kind:"circle",center:{x:50,y:50},radius:40};
    expect(hitObject([object("bottom",circle),object("top",circle)],{x:50,y:50},1,8,guide)).toBe("top");
    expect(hitObject([object("bottom",circle),object("top",circle,{locked:true})],{x:50,y:50},1,8,guide)).toBe("bottom");
  });
  it("does not select empty interiors of unfilled outlines",()=>{
    const o=object("outline",{kind:"circle",center:{x:50,y:50},radius:40},{style:DEFAULT_STYLE});
    expect(hitObject([o],{x:50,y:50},1,8,guide)).toBeNull();
    expect(hitObject([o],{x:95,y:50},1,8,guide)).toBe("outline");
    expect(hitObject([o],{x:95,y:50},4,8,guide)).toBeNull();
  });
  it("excludes protected guides and artwork in guide edit mode",()=>{
    const line:Geometry={kind:"line",a:{x:0,y:0},b:{x:100,y:0}};
    const objects=[object("art",line),object("guide",line,{guide:true})];
    expect(hitObject(objects,{x:50,y:0},1,8,{...guide,locked:true})).toBe("art");
    expect(hitObject(objects,{x:50,y:0},1,8,{...guide,edit:true})).toBe("guide");
  });
});
