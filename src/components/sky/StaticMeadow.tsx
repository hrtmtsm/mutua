'use client';
import type {RefObject} from 'react';
import type {Palette} from './palette';
export default function StaticMeadow({palette,meadowRef}:{palette:Palette;meadowRef:RefObject<HTMLDivElement>}){
 return <div ref={meadowRef} className="meadow-static" aria-hidden="true" style={{transform:'translateY(100%)'}}>
  <img src="/worlds/meadow-day.jpg" alt="" loading="lazy"/>
  <img src="/worlds/meadow-night.jpg" alt="" loading="lazy" style={{opacity:palette.night}}/>
 </div>;
}
