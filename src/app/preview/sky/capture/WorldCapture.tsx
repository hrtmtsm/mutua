'use client';
import {useCallback,useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import {paletteAt} from '@/components/sky/palette';

const SkyCanvas=dynamic(()=>import('@/components/sky/SkyCanvas'),{ssr:false});
export default function WorldCapture({hour}:{hour:number}){
 const [ready,setReady]=useState(false);
 const [mobile,setMobile]=useState(false);
 useEffect(()=>{const media=matchMedia("(max-width:700px)");const update=()=>setMobile(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 const complete=useCallback(()=>setReady(true),[]);
 const palette=paletteAt(hour);
 return <main data-capture-ready={ready} style={{position:'fixed',inset:0,background:`linear-gradient(${palette.top},${palette.middle} 58%,${palette.horizon})`}}>
 <SkyCanvas hour={hour} palette={palette} progress={1} mobile={mobile} reduced paused={false} grassStill onSceneReady={complete} onFailure={()=>{}}/>
 </main>;
}
