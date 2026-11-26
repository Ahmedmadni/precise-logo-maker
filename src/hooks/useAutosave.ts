import {useEffect} from "react";
import {autosavePayload,loadLargeAutosave,preferLargeSnapshot,readLocalSnapshot,saveAutosave,saveLargeAutosave} from "../objects/project";
import {useStudio,type StudioState,type DocumentState} from "../store/studioStore";

const DEBOUNCE_MS=800;

/** Restore a clean session, persist changed documents and report only
 * the latest save attempt. A failed write stays dirty for a later retry. */
export function useAutosave():void{
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    let cancelled=false,edited=false,applyingRestore=false;
    let revision=0;
    const status=(value:StudioState["autosaveStatus"])=>{if(!cancelled)useStudio.setState({autosaveStatus:value});};
    status("checking");
    const local=readLocalSnapshot();
    if(local)useStudio.getState().restoreAutosave(local.document,"Restored autosave");
    const initial=useStudio.getState().doc;
    let lastPersisted:DocumentState|null=local?.partial?null:initial;
    let dirty=false;
    const persist=()=>{
      if(timer){clearTimeout(timer);timer=undefined;}
      if(!dirty)return;
      const current=useStudio.getState().doc;
      if(current===lastPersisted){dirty=false;return;}
      const attempt=++revision;
      let payload:string;
      const stamp=new Date().toISOString();
      try{payload=autosavePayload(current,stamp);}
      catch{lastPersisted=null;status("failed");return;}
      dirty=false;
      const quality=saveAutosave(current,payload,stamp);
      if(quality==="full"){lastPersisted=current;status("saved");}
      else {lastPersisted=null;status("pending");}
      void saveLargeAutosave(current,payload).catch(()=>false).then(ok=>{
        if(cancelled||attempt!==revision||useStudio.getState().doc!==current)return;
        if(ok||quality==="full"){lastPersisted=current;dirty=false;status("saved");}
        else{lastPersisted=null;dirty=true;status(quality==="drawing-only"?"partial":"failed");}
      });
    };
    const unsubscribe=useStudio.subscribe((state,prev)=>{
      if(state.doc===prev.doc||applyingRestore)return;
      edited=true;dirty=true;revision++;
      // Even an undo back to the original document must replace a newer save.
      lastPersisted=null;status("pending");
      if(timer)clearTimeout(timer);
      timer=setTimeout(persist,DEBOUNCE_MS);
    });
    void loadLargeAutosave().catch(()=>null).then(large=>{
      if(cancelled||edited||dirty||useStudio.getState().doc!==initial)return;
      if(large&&preferLargeSnapshot(local,large)){
        applyingRestore=true;
        try{useStudio.getState().restoreAutosave(large.document,"Restored large project");}
        finally{applyingRestore=false;}
        lastPersisted=large.partial?null:large.document;
        dirty=false;status(large.partial?"partial":"saved");
      }else status(local?local.partial?"partial":"saved":"idle");
    });
    const onVisibility=()=>{if(document.visibilityState==="hidden")persist();};
    window.addEventListener("pagehide",persist);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{
      unsubscribe();
      persist();cancelled=true;
      window.removeEventListener("pagehide",persist);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);
}
