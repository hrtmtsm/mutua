'use client';
import type {Palette} from './palette';
export default function StaticMeadow({palette,progress}:{palette:Palette;progress:number}){
 return <div className="meadow-static" aria-hidden="true" style={{transform:`translateY(${(1-Math.max(0,Math.min(1,(progress-.12)/.88)))*100}%)`}}>
  <img src="/worlds/meadow-day.jpg" alt="" loading="lazy"/>
  <img src="/worlds/meadow-night.jpg" alt="" loading="lazy" style={{opacity:palette.night}}/>
 </div>;
}
