export type InkHsl = { h: number; s: number; l: number };
const clamp = (n:number,min:number,max:number) => Math.min(max,Math.max(min,n));
const isHex = (color:string) => /^#[0-9a-f]{6}$/i.test(color);

export function hexToInkHsl(hex:string):InkHsl|null {
  if(!isHex(hex))return null;
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number];
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  if(!d)return {h:0,s:0,l:l*100};
  const h=max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4;
  return {h:(h*60+360)%360,s:100*d/(1-Math.abs(2*l-1)),l:l*100};
}
export function inkHslToHex({h,s,l}:InkHsl):string|null {
  if(![h,s,l].every(Number.isFinite))return null;
  h=((h%360)+360)%360;s=clamp(s,0,100)/100;l=clamp(l,0,100)/100;
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return "#"+rgb.map(n=>Math.round(clamp(n+m,0,1)*255).toString(16).padStart(2,"0")).join("");
}
/** Shades use the selected hue and saturation, excluding the identical color. */
export function inkToneSwatches(hex:string):string[] {
  const hsl=hexToInkHsl(hex);
  if(!hsl)return [];
  return [...new Set([12,25,40,55,70,85,94].map(l=>inkHslToHex({...hsl,l})!))];
}
