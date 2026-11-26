/** Retain only a small number of fonts, share concurrent loads and allow retry.
 * Eviction never cancels an in-flight consumer; a stale rejected request cannot
 * remove a replacement cache entry for the same key. */
export function createFontCache<T>(limit=5){
  const cache=new Map<string,Promise<T>>();
  const capacity=Math.max(1,Math.floor(limit));
  return {
    get(key:string,load:()=>Promise<T>):Promise<T>{
      const existing=cache.get(key);
      if(existing){cache.delete(key);cache.set(key,existing);return existing;}
      const task=Promise.resolve().then(load).catch(error=>{
        if(cache.get(key)===task)cache.delete(key);
        throw error;
      });
      cache.set(key,task);
      while(cache.size>capacity){const first=cache.keys().next();if(first.done)break;cache.delete(first.value);}
      return task;
    },
  };
}
