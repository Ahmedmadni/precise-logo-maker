export const HISTORY_LIMIT=100;
export const HISTORY_BUDGET=24*1024*1024;
export interface SnapshotEntry<T extends object>{label:string;state:T}

/** Estimated incremental retained data, not a measurement of JS heap usage.
 * Unchanged shared values do not count again; moved array entries are matched
 * by reference. Cache immutable snapshot pairs to avoid rescanning old edits. */
const estimates=new WeakMap<object,WeakMap<object,number>>();
function extra(old:unknown,next:unknown):number{
  if(Object.is(old,next)||old==null)return 0;
  if(typeof old==="string")return old.length*2;
  if(typeof old!=="object")return 8;
  if(Array.isArray(old)){
    const shared=new Set(Array.isArray(next)?next:[]);
    return 32+old.length*8+old.reduce((sum,item,i)=>sum+(shared.has(item)?0:extra(item,Array.isArray(next)?next[i]:undefined)),0);
  }
  const previous=old as Record<string,unknown>;
  const newer=next&&typeof next==="object"&&!Array.isArray(next)?next as Record<string,unknown>:{};
  return 48+Object.keys(previous).reduce((sum,key)=>sum+16+extra(previous[key],newer[key]),0);
}
export function estimateRetained(old:object,next:object):number{
  let byNext=estimates.get(old);
  if(!byNext){byNext=new WeakMap();estimates.set(old,byNext);}
  const cached=byNext.get(next);
  if(cached!==undefined)return cached;
  const size=extra(old,next);
  byNext.set(next,size);
  return size;
}
/** Keep a contiguous suffix, always including the immediately preceding state.
 * A single unusually large edit can exceed the target budget deliberately. */
export function trimUndo<T extends object,E extends SnapshotEntry<T>>(past:E[],current:T,budget=HISTORY_BUDGET,limit=HISTORY_LIMIT):E[]{
  if(!past.length)return [];
  let start=past.length,used=0,newer=current;
  for(let i=past.length-1;i>=0&&past.length-i<=Math.max(1,limit);i--){
    const entry=past[i]!;
    const cost=estimateRetained(entry.state,newer)+64+entry.label.length*2;
    if(start<past.length&&used+cost>budget)break;
    used+=cost;start=i;newer=entry.state;
  }
  return past.slice(start);
}
/** Reconstruct the redo chain from the target to the present, preserving
 * any already-undone entries after the present. */
export function jumpHistory<T extends object>(past:SnapshotEntry<T>[],future:SnapshotEntry<T>[],current:T,index:number){
  if(!Number.isInteger(index)||index<0||index>=past.length)return null;
  return {state:past[index]!.state,past:past.slice(0,index),future:[...past.slice(index).map((entry,i)=>({label:entry.label,state:past[index+i+1]?.state??current})),...future]};
}
