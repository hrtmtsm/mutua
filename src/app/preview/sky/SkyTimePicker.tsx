'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Clock3,Sunrise,Sun,Sunset,Moon,ChevronDown,Check} from 'lucide-react';
import type {SkyMode} from '@/components/sky/palette';
const ICONS={auto:Clock3,morning:Sunrise,day:Sun,evening:Sunset,night:Moon};
export default function SkyTimePicker({value,onChange,label,options}:{value:SkyMode;onChange:(value:SkyMode)=>void;label:string;options:{value:SkyMode;label:string}[]}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const id=useId();const Icon=ICONS[value];const selected=options.find(option=>option.value===value)!;
 useEffect(()=>{
  if(!open)return;
  menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 return <div className="sky-time-picker" ref={root}>
  <button ref={trigger} type="button" className="sky-time-trigger" aria-label={`${label}: ${selected.label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}}}>
   <Icon size={17} strokeWidth={1.4} aria-hidden="true"/><span>{selected.label}</span><ChevronDown size={12} strokeWidth={1.5} aria-hidden="true"/>
  </button>
  {open&&<div ref={menu} id={id} className="sky-time-menu" role="menu" aria-label={label} onKeyDown={event=>{
   const buttons=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button')||[]);
   const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
   }else if(event.key==='Tab')setOpen(false);
  }}>
   {options.map(option=>{const ItemIcon=ICONS[option.value];return <button key={option.value} type="button" role="menuitemradio" aria-checked={value===option.value} onClick={()=>{onChange(option.value);setOpen(false);trigger.current?.focus();}}>
    <ItemIcon size={18} strokeWidth={1.4} aria-hidden="true"/><span>{option.label}</span>{value===option.value&&<Check size={14} strokeWidth={1.6} aria-hidden="true"/>}
   </button>;})}
  </div>}
 </div>;
}
