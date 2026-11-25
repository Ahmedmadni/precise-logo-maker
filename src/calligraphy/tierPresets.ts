import type {TierOptions} from "./tieredComposition";
export type TierPreset={id:string;name:string;options:TierOptions};
export const TIER_PRESET_KEY="logo-studio.tier-presets.v1";
export const TIER_PRESET_LIMIT=30;
export const BUILTIN_TIER_PRESETS:TierPreset[]=[
  {id:"balanced",name:"صفان متوازنان",options:{rows:2,style:"balanced",horizontalGap:12,verticalGap:8,stagger:0}},
  {id:"compact",name:"تراصّ متداخل",options:{rows:2,style:"balanced",horizontalGap:4,verticalGap:-5,stagger:0}},
  {id:"pyramid",name:"هرم ثلاثي",options:{rows:3,style:"pyramid",horizontalGap:12,verticalGap:8,stagger:0}},
  {id:"cascade",name:"تدرّج قطري",options:{rows:3,style:"cascade",horizontalGap:10,verticalGap:6,stagger:25}},
];
function optionsOf(value:unknown):TierOptions|null{
  if(!value||typeof value!=="object")return null;
  const v=value as Record<string,unknown>;
  const finite=(n:unknown,min:number,max:number):n is number=>typeof n==="number"&&Number.isFinite(n)&&n>=min&&n<=max;
  if(!finite(v["rows"],2,6)||!Number.isInteger(v["rows"])||!finite(v["horizontalGap"],0,100)||!finite(v["verticalGap"],-50,100)||!finite(v["stagger"],-100,100)||(v["style"]!=="balanced"&&v["style"]!=="pyramid"&&v["style"]!=="cascade"))return null;
  return {rows:v["rows"],style:v["style"],horizontalGap:v["horizontalGap"],verticalGap:v["verticalGap"],stagger:v["stagger"]};
}
export function decodeTierPresets(raw:string):TierPreset[]{
  if(raw.length>50000)return [];
  try{
    const parsed=JSON.parse(raw) as unknown;
    if(!Array.isArray(parsed))return [];
    const result:TierPreset[]=[],ids=new Set<string>(),names=new Set<string>();
    for(const row of parsed){
      if(!row||typeof row!=="object"||typeof row.id!=="string"||typeof row.name!=="string")continue;
      const name=row.name.trim(),id=row.id;
      const options=optionsOf(row.options);
      if(!name||name.length>60||!id||id.length>100||ids.has(id)||names.has(name)||!options)continue;
      result.push({id,name,options});ids.add(id);names.add(name);
      if(result.length===TIER_PRESET_LIMIT)break;
    }
    return result;
  }catch{return [];}
}
export function saveTierPreset(existing:TierPreset[],id:string,name:string,options:TierOptions):TierPreset[]|null{
  const clean=name.trim(),valid=optionsOf(options);
  if(!clean||clean.length>60||!valid||!id||id.length>100)return null;
  const match=existing.find(p=>p.name===clean);
  if(match)return existing.map(p=>p.id===match.id?{...p,options:valid}:p);
  if(existing.length>=TIER_PRESET_LIMIT||existing.some(p=>p.id===id))return null;
  return [...existing,{id,name:clean,options:valid}];
}
