import {describe,it,expect,vi} from "vitest";
import {createFontCache} from "./fontCache";

describe("font cache",()=>{
  it("shares concurrent requests and retains resolved faces",async()=>{
    const cache=createFontCache<number>(2);
    const load=vi.fn(async()=>42);
    const first=cache.get("a",load);
    expect(cache.get("a",load)).toBe(first);
    expect(await first).toBe(42);
    expect(await cache.get("a",load)).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("evicts the least recently used font",async()=>{
    const cache=createFontCache<number>(2);
    const load=vi.fn(async()=>1);
    await cache.get("a",load);
    await cache.get("b",load);
    await cache.get("a",load);
    await cache.get("c",load);
    await cache.get("b",load);
    expect(load).toHaveBeenCalledTimes(4);
  });
  it("allows retry after a failed load",async()=>{
    const cache=createFontCache<number>();
    await expect(cache.get("a",async()=>{throw Error("invalid font");})).rejects.toThrow("invalid font");
    expect(await cache.get("a",async()=>7)).toBe(7);
  });
  it("does not let a rejected evicted request delete its replacement",async()=>{
    const cache=createFontCache<number>(1);
    let fail!:(reason:Error)=>void;
    const old=cache.get("a",()=>new Promise<number>((_,reject)=>{fail=reject;}));
    await Promise.resolve();
    await cache.get("b",async()=>2);
    const replacement=cache.get("a",async()=>3);
    fail(Error("old"));
    await expect(old).rejects.toThrow("old");
    expect(cache.get("a",async()=>4)).toBe(replacement);
    expect(await replacement).toBe(3);
  });
});
