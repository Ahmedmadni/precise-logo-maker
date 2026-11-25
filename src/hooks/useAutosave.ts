import {useEffect} from "react";
import {autosavePayload,loadLargeAutosave,preferLargeSnapshot,readLocalSnapshot,saveAutosave,saveLargeAutosave} from "../objects/project";
import {useStudio} from "../store/studioStore";

const DEBOUNCE_MS=800;

/** Restore once per active editor mount, then persist only changed documents.
 * Do not write an initial/partial snapshot over an unread IndexedDB project. */
export function useAutosave():void{
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    let cancelled=false,restoring=true;
    const local=readLocalSnapshot();
    if(local)useStudio.setState({doc:local.document,historyLog:["Restored autosave"]});
    const initial=useStudio.getState().doc;
    let lastPersisted=initial;
    let dirty=false;
    const persist=()=>{
      if(timer){clearTimeout(timer);timer=undefined;}
      if(!dirty)return;
      const current=useStudio.getState().doc;
      if(current===lastPersisted){dirty=false;return;}
      const stamp=new Date().toISOString();
      const payload=autosavePayload(current,stamp);
      lastPersisted=current;dirty=false;
      const quality=saveAutosave(current,payload,stamp);
      void saveLargeAutosave(current,payload).then(ok=>{
        if(!ok&&quality!=="full"&&!cancelled&&useStudio.getState().doc===current){
          // A later change or lifecycle flush may retry the same document.
          lastPersisted=initial;dirty=true;
          console.warn("Logo Studio autosave incomplete; export a .logo backup.");
        }
      });
    };
    const unsubscribe=useStudio.subscribe((state,prev)=>{
      if(state.doc===prev.doc)return;
      dirty=true;
      if(timer)clearTimeout(timer);
      timer=setTimeout(persist,DEBOUNCE_MS);
    });
    void loadLargeAutosave().then(large=>{
      if(cancelled)return;
      if(large&&restoring&&!dirty&&useStudio.getState().doc===initial&&preferLargeSnapshot(local,large)){
        useStudio.setState({doc:large.document,historyLog:["Restored large project"]});
        lastPersisted=large.document;
        dirty=false;
        if(timer){clearTimeout(timer);timer=undefined;}
      }
      restoring=false;
    });
    const onVisibility=()=>{if(document.visibilityState==="hidden")persist();};
    window.addEventListener("pagehide",persist);
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{
      cancelled=true;
      unsubscribe();
      persist();
      window.removeEventListener("pagehide",persist);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);
}
