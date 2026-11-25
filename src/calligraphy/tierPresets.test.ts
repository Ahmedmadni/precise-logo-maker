import {describe,it,expect} from "vitest";
import {BUILTIN_TIER_PRESETS,decodeTierPresets,saveTierPreset,TIER_PRESET_LIMIT} from "./tierPresets";
const options=BUILTIN_TIER_PRESETS[0]!.options;
describe("tier composition preset library",()=>{
  it("round trips valid settings without document or glyph data",()=>{
    const saved=saveTierPreset([],"p","  قالب شخصي  ",options)!;
    expect(decodeTierPresets(JSON.stringify(saved))).toEqual([{id:"p",name:"قالب شخصي",options}]);
    expect(saved[0]?.options).not.toBe(options);
  });
  it("updates an existing named template without duplicating it",()=>{
    const saved=saveTierPreset([],"p","قالب",options)!;
    const updated=saveTierPreset(saved,"new","قالب",{...options,rows:3})!;
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({id:"p",options:{rows:3}});
    expect(saved[0]?.options.rows).toBe(2);
  });
  it("filters malformed, duplicate and out-of-range entries",()=>{
    const good={id:"p",name:"قالب",options};
    expect(decodeTierPresets(JSON.stringify([null,good,good,{id:"bad",name:"غير صالح",options:{...options,rows:8}},{id:"bad2",name:"ثان",options:{...options,verticalGap:-1000}}]))).toEqual([good]);
    expect(decodeTierPresets("{")).toEqual([]);
  });
  it("limits local storage to thirty custom presets and allows updates at the limit",()=>{
    const saved=Array.from({length:TIER_PRESET_LIMIT},(_,i)=>({id:String(i),name:"قالب "+i,options}));
    expect(saveTierPreset(saved,"extra","جديد",options)).toBeNull();
    expect(saveTierPreset(saved,"0","قالب 0",{...options,rows:4})?.[0]?.options.rows).toBe(4);
  });
});
