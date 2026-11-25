import type { GuideChain, FreePathOptions } from "./freePathLayout";

export interface CompositionPreset {
  id:string;
  name:string;
  description:string;
  minWords:number;
  guide:GuideChain;
  options:FreePathOptions;
}
const options=(scale:number,margin:number,tangent=false):FreePathOptions=>({scale,margin,tangent,reverse:false,upright:true,sizeAware:true,wordGap:.2});

/** Geometric placement templates only. No claim to authentic historic scripts. */
export const COMPOSITION_PRESETS:CompositionPreset[]=[
  {id:"seal",name:"ختم دائري مفتوح",description:"كلمات موزعة حول قوس شبه دائري مع فتحة سفلية.",minWords:3,
    guide:[{x:78,y:88},{x:100,y:70},{x:100,y:30},{x:78,y:12},{x:60,y:0},{x:40,y:0},{x:22,y:12},{x:0,y:30},{x:0,y:70},{x:22,y:88}],options:options(1.8,.02,true)},
  {id:"crown",name:"تاج مقوّس",description:"تركيب صاعد في الوسط مع طرفين منخفضين.",minWords:3,
    guide:[{x:95,y:75},{x:78,y:8},{x:22,y:8},{x:5,y:75}],options:options(1.4,.03,true)},
  {id:"cascade",name:"تدرج قطري",description:"مستويات متدرجة من أعلى اليمين إلى أسفل اليسار.",minWords:2,
    guide:[{x:90,y:10},{x:65,y:20},{x:35,y:80},{x:10,y:90}],options:options(1.1,.04)},
  {id:"stack",name:"تركيب رأسي",description:"كلمات متراصة على محور رأسي دون تدوير.",minWords:2,
    guide:[{x:50,y:5},{x:50,y:35},{x:50,y:65},{x:50,y:95}],options:options(1,.02)},
  {id:"tiers",name:"مستويان متعاكسان",description:"مسار متصل ينتقل بين مستويين أفقيين.",minWords:4,
    guide:[{x:90,y:20},{x:65,y:20},{x:35,y:20},{x:10,y:20},{x:0,y:20},{x:0,y:80},{x:10,y:80},{x:35,y:80},{x:65,y:80},{x:90,y:80}],options:options(1.7,.03)},
  {id:"wave",name:"موجة مزدوجة",description:"مسار متتابع مناسب لتكوين زخرفي حر.",minWords:4,
    guide:[{x:95,y:50},{x:82,y:5},{x:70,y:5},{x:50,y:50},{x:30,y:95},{x:18,y:95},{x:5,y:50}],options:options(1.6,.02,true)},
];

export function guideSvgPath(guide:GuideChain):string{
  if(guide.length<4||(guide.length-1)%3!==0)return "";
  return "M "+guide[0]!.x+" "+guide[0]!.y+" "+Array.from({length:(guide.length-1)/3},(_,i)=>"C "+guide.slice(i*3+1,i*3+4).map(p=>p.x+" "+p.y).join(" ")).join(" ");
}
