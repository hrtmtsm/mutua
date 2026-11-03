'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import scenes from './possibilities/scenes.png';

// Original generated illustrative scenes, not member photographs or testimonials.
const SCENES = [
 { id:'friends', alt:'Friends laughing over coffee at an outdoor café', position:'0%', angle:'-5deg', delay:'-2s' },
 { id:'music', alt:'Two friends making music together with guitar and keyboard', position:'50%', angle:'4deg', delay:'-5s' },
 { id:'sharing', alt:'A small creative group sharing an idea around a table', position:'100%', angle:'-3deg', delay:'-7s' },
];
const DESKTOP = [
 'M720 676 C716 711 662 715 625 704 C510 671 392 628 271 653',
 'M720 676 C716 711 662 715 625 704 C758 766 1010 648 1173 676',
 'M720 676 C716 711 662 715 625 704 C669 795 790 828 940 791',
];
const MOBILE = [
 'M180 36 C192 66 159 86 139 83 C113 78 102 125 74 148',
 'M180 36 C192 66 159 86 139 83 C193 115 250 101 289 126',
];
export default function ConversationPossibilities({mobile,reduced,hidden}:{mobile:boolean;reduced:boolean;hidden:boolean}) {
 const root=useRef<HTMLDivElement>(null);
 const [inView,setInView]=useState(true);
 const [branch,setBranch]=useState(0);
 const moving=!reduced&&!hidden&&inView;
 const paths=mobile?MOBILE:DESKTOP;
 useEffect(()=>{
  if(!root.current)return;
  const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting));
  observer.observe(root.current);return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!moving)return;
  const timer=setInterval(()=>setBranch(value=>(value+1)%paths.length),12000);
  return ()=>clearInterval(timer);
 },[moving,paths.length]);
 return <div className="conversation-collage" ref={root} data-motion={moving?'on':'off'} aria-label="Illustrative possibilities of a conversation">
  <svg className="conversation-paths" viewBox={mobile?'0 0 360 280':'0 0 1440 900'} preserveAspectRatio="none" aria-hidden="true">
   <g className="conversation-lines">{paths.map((d,i)=><path key={i} pathLength="1" d={d}/>)}</g>
   {moving&&<circle key={`${mobile}-${branch}`} className="conversation-spark" r="2"><animateMotion path={paths[branch%paths.length]} dur="10s" fill="freeze"/></circle>}
  </svg>
  <span className="conversation-hello">Hello!</span>
  {SCENES.map((scene,i)=><figure key={scene.id} className={`conversation-photo conversation-photo-${i}`} style={{'--photo-angle':scene.angle,'--photo-delay':scene.delay} as CSSProperties}>
   <div className="conversation-photo-window"><Image src={scenes} alt={scene.alt} sizes="(max-width:700px) 400px, 630px" priority style={{left:scene.position==='0%'?'0':scene.position==='50%'?'-100%':'-200%'}}/></div>
  </figure>)}
 </div>;
}
