import {useEffect} from "react";
import {useStudio} from "../store/studioStore";

/** One live custom face per mounted editor. Outlined glyphs are unaffected. */
export function useCustomTypeface():void{
  const fontData=useStudio(s=>s.doc.customThuluthFont);
  useEffect(()=>{
    if(!fontData||typeof FontFace==="undefined"||!document.fonts)return;
    let active=true;
    let face:FontFace;
    try{face=new FontFace("Custom Thuluth",`url("${fontData}")`);}
    catch{return;}
    void face.load().then(loaded=>{if(active)document.fonts.add(loaded);}).catch(()=>{});
    return ()=>{active=false;document.fonts.delete(face);};
  },[fontData]);
}
