import type { LetteringItem } from "../../calligraphy/model";
import { inspectRibbonChainIntersections } from "../../calligraphy/ribbonChainIntersections";

/** Selected-chain review only. No SVG export or stored project geometry. */
export function RibbonChainCrossingOverlay({ribbonId,items,zoom}:{
  ribbonId:string;
  items:LetteringItem[];
  zoom:number;
}){
  if(!Number.isFinite(zoom)||zoom<=0)return null;
  const points=inspectRibbonChainIntersections(items,ribbonId);
  if(points.length===0)return null;
  return <g data-ribbon-chain-diagnostic="true"
    aria-label={"نقاط مراجعة تقاطع الكشائد: "+points.length}
    pointerEvents="none">
    {points.map(({point,firstRibbonId,secondRibbonId},index)=>(
      <g key={firstRibbonId+"-"+secondRibbonId+"-"+index}>
        <circle cx={point.x} cy={point.y} r={12/zoom}
          fill="#eeba5a" fillOpacity={0.18} stroke="#f0b151"
          strokeWidth={1.8/zoom} strokeDasharray={3/zoom+" "+2/zoom}/>
        <path d={"M "+(point.x-5/zoom)+" "+(point.y-5/zoom)+
          " L "+(point.x+5/zoom)+" "+(point.y+5/zoom)+
          " M "+(point.x+5/zoom)+" "+(point.y-5/zoom)+
          " L "+(point.x-5/zoom)+" "+(point.y+5/zoom)}
          stroke="#f0b151" strokeWidth={1.5/zoom}/>
      </g>
    ))}
  </g>;
}
