'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { countryGreeting } from '@/lib/countryGreetings';
import firstPartners from './avatars/language-partners.png';
import worldPartners from './avatars/world-partners.png';

type Zone = 'hero' | 'crossing' | 'arrival';
const PEOPLE = [
  { id:'haru', flag:'🇯🇵', name:'Haru', language:'日本語', lang:'ja', hello:'こんにちは！', zone:'hero', side:'left', image:firstPartners, crop:'duo-left', ring:'#bddb9d', delay:'0s' },
  { id:'alex', flag:'🇺🇸', name:'Alex', language:'English', lang:'en', hello:'Hello!', zone:'hero', side:'right', image:firstPartners, crop:'duo-right', ring:'#e6bad0', delay:'-3s' },
  { id:'camille', flag:'🇫🇷', name:'Camille', language:'Français', lang:'fr', hello:'Bonjour !', zone:'crossing', side:'right', image:worldPartners, crop:'grid-tl', ring:'#adcfdc', delay:'-1s' },
  { id:'diego', flag:'🇪🇸', name:'Diego', language:'Español', lang:'es', hello:'¡Hola!', zone:'crossing', side:'right', image:worldPartners, crop:'grid-tr', ring:'#e3cf98', delay:'-4s' },
  { id:'mina', flag:'🇰🇷', name:'Mina', language:'한국어', lang:'ko', hello:'안녕하세요!', zone:'arrival', side:'left', image:worldPartners, crop:'grid-bl', ring:'#cdb9e0', delay:'-2s' },
  { id:'omar', flag:'🇸🇦', name:'Omar', language:'العربية', lang:'ar', hello:'مرحبًا!', zone:'arrival', side:'right', image:worldPartners, crop:'grid-br', ring:'#afcfc2', delay:'-5s' },
] as const;
const PLATE_COLORS = ['#b8553e','#34695e','#7152a2','#98601f','#3f609a','#a34265'];
function Greeting({ person }: { person:typeof PEOPLE[number] }) {
  const ref=useRef<HTMLElement>(null);
  const [seen,setSeen]=useState(false);
  const [active,setActive]=useState(false);
  const [greetingIndex,setGreetingIndex]=useState(person.id==='haru'?0:1);
  const [canCycle,setCanCycle]=useState(false);
  const profileIndex=greetingIndex % PEOPLE.length;
  const profile=PEOPLE[profileIndex];
  const flag=profile.flag;
  const greeting=countryGreeting(flag);
  useEffect(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setCanCycle(!motion.matches&&!document.hidden);
    update();motion.addEventListener('change',update);document.addEventListener('visibilitychange',update);
    return ()=>{motion.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
  },[]);
  useEffect(()=>{
    if(!active||!canCycle)return;
    const timer=window.setInterval(()=>setGreetingIndex(index=>(index+2)%PEOPLE.length),4500);
    return ()=>window.clearInterval(timer);
  },[active,canCycle]);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    if(!('IntersectionObserver' in window)){setSeen(true);setActive(true);return;}
    const observer=new IntersectionObserver(([entry])=>{
      setActive(entry.isIntersecting);
      if(entry.isIntersecting)setSeen(true);
    },{threshold:.22,rootMargin:'0px 0px -24px 0px'});
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  return <figure ref={ref} className={`greeting-card greeting-${person.id} greeting-side-${person.side}${seen?' is-seen':''}${active?' is-active':''}`} data-greeting={person.id} data-profile={profile.id} data-seen={seen} style={{'--greeting-float-delay':person.delay} as CSSProperties}>
    <div className="greeting-portrait">
      {PEOPLE.map((photo,index)=><div key={photo.id} className={`greeting-photo-layer greeting-crop-${photo.crop}${profileIndex===index?' is-current':''}`} aria-hidden={profileIndex!==index}>
        <Image src={photo.image} alt="An example language partner" sizes="(max-width: 700px) 176px, 224px" priority={person.zone==='hero'&&(index===0||index===2)}/>
      </div>)}
    </div>
    <p className="globe-greeting globe-greeting-static greeting-plate" lang={greeting.lang} dir="auto"
      style={{'--greeting-color':PLATE_COLORS[greetingIndex % PLATE_COLORS.length],'--greeting-tilt':`${greetingIndex%2===0?-4:4}deg`} as CSSProperties}>
      <span key={flag} className="greeting-cycle-text"><span aria-hidden="true">{flag}</span> {greeting.text}</span>
    </p>
  </figure>;
}
export default function ScrollGreetings({zone}:{zone:Zone}) {
  return <div className="scroll-greetings" role="group" aria-label="Example language partners saying hello">
    {PEOPLE.filter(person=>person.zone===zone).map(person=><Greeting key={person.id} person={person}/>)}
  </div>;
}
