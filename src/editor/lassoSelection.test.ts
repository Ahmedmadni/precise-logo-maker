import {describe,it,expect} from "vitest";
import {lassoHits,combineLassoSelection} from "./lassoSelection";
import {DEFAULT_STYLE,IDENTITY_TRANSFORM,type Geometry,type Point,type VectorObject} from "../core/geometry/types";

const rectangle=(x:number,y:number,w:number,h:number):Point[]=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const object=(id:string,geometry:Geometry,patch:Partial<VectorObject>={}):VectorObject=>({id,name:id,type:geometry.kind,geometry,style:DEFAULT_STYLE,transform:IDENTITY_TRANSFORM,layerId:"test",visible:true,locked:false,...patch});
const line=(id:string,x1:number,y1:number,x2:number,y2:number)=>object(id,{kind:"line",a:{x:x1,y:y1},b:{x:x2,y:y2}});
describe("lasso selection",()=>{
  it("selects enclosed or crossing outlines but not unrelated geometry",()=>{
    const objects=[line("inside",2,2,8,8),line("crossing",-5,5,15,5),line("outside",11,11,15,15)];
    expect(lassoHits(objects,rectangle(0,0,10,10))).toEqual(["inside","crossing"]);
  });
  it("does not select a line outside a concave lasso even inside its bounds",()=>{
    const concave=[{x:0,y:0},{x:10,y:0},{x:10,y:2},{x:2,y:2},{x:2,y:10},{x:0,y:10}];
    expect(lassoHits([line("outside",5,5,8,8),line("inside",.5,3,1.5,8)],concave)).toEqual(["inside"]);
  });
  it("recognizes a lasso wholly inside filled material but not inside a hole",()=>{
    const shape=object("compound",{kind:"path",closed:true,points:rectangle(0,0,100,100),holes:[rectangle(30,30,40,40)]},{style:{...DEFAULT_STYLE,fill:"#000000"}});
    expect(lassoHits([shape],rectangle(10,10,5,5))).toEqual(["compound"]);
    expect(lassoHits([shape],rectangle(40,40,5,5))).toEqual([]);
    expect(lassoHits([shape],rectangle(25,40,10,5))).toEqual(["compound"]);
  });
  it("excludes locked, hidden and guide objects",()=>{
    const g:Geometry={kind:"line",a:{x:1,y:1},b:{x:5,y:5}};
    expect(lassoHits([object("locked",g,{locked:true}),object("hidden",g,{visible:false}),object("guide",g,{guide:true}),object("normal",g)],rectangle(0,0,10,10))).toEqual(["normal"]);
  });
  it("supports replacement addition and subtraction without duplicate ids",()=>{
    expect(combineLassoSelection(["a","b"],["b","c"],"replace")).toEqual(["b","c"]);
    expect(combineLassoSelection(["a","b"],["b","c"],"add")).toEqual(["a","b","c"]);
    expect(combineLassoSelection(["a","b"],["b","c"],"subtract")).toEqual(["a"]);
  });
});
