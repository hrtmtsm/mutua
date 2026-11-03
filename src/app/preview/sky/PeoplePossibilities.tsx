'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import person0 from './avatars/tapback/person-0.png';
import person1 from './avatars/tapback/person-1.png';
import person2 from './avatars/tapback/person-2.png';
import person3 from './avatars/tapback/person-3.png';
import person4 from './avatars/tapback/person-4.png';
import person5 from './avatars/tapback/person-5.png';

// Tapback Memoji demo assets; see avatars/tapback/ATTRIBUTION.md.
const PEOPLE = [
  { id:'person-0', source:person0, delay:'-0s' },
  { id:'person-1', source:person1, delay:'-1s' },
  { id:'person-2', source:person2, delay:'-2s' },
  { id:'person-3', source:person3, delay:'-3s' },
  { id:'person-4', source:person4, delay:'-4s' },
  { id:'person-5', source:person5, delay:'-5s' },
];
const GREETINGS = ['こんにちは！', 'Hey there!', 'Salut !', '¡Hola!', '안녕하세요!', 'أهلاً!'];
const PHASES = [[0,1,2,4],[1,2,3,5],[0,3,4,5]];
const MOBILE_PHASES = [[0,1,2],[3,4,5],[0,4,2]];
export default function PeoplePossibilities({reduced,hidden,mobile}:{reduced:boolean;hidden:boolean;mobile:boolean}) {
  const element=useRef<HTMLDivElement>(null);
  const [inView,setInView]=useState(true);
  const [phase,setPhase]=useState(0);
  const visiblePeople = (mobile ? MOBILE_PHASES : PHASES)[phase];
  const moving=!reduced&&!hidden&&inView;
  useEffect(()=>{
    if(!element.current||!('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:.05});
    observer.observe(element.current);return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!moving)return;
    const timer=window.setInterval(()=>setPhase(value=>(value+1)%PHASES.length),8500);
    return ()=>window.clearInterval(timer);
  },[moving]);
  return <div ref={element} className="possibility-people" data-motion={moving?'on':'off'} data-phase={phase} role="group" aria-label="Illustrative language partners and the possibilities of a conversation">

    
    {PEOPLE.map((person,index)=><div key={person.id} className={`possibility-person possibility-person-${index}${visiblePeople.includes(index)?' is-visible':''}`} data-person={index} data-desktop-slot={PHASES[phase].indexOf(index)} data-mobile-slot={MOBILE_PHASES[phase].indexOf(index)} aria-hidden={!visiblePeople.includes(index)} style={{'--person-float-delay':person.delay,'--person-reveal-delay':'0ms'} as CSSProperties}>
      <div className="possibility-portrait tapback-portrait">
        <Image src={person.source} alt="Memoji language partner" style={{width:'100%',height:'100%',objectFit:'contain',transform:'none'}} unoptimized sizes="(max-width:700px) 76px, 112px" priority={index===0||index===2}/>
      </div>
      <span className="person-greeting" dir="auto">{GREETINGS[index]}</span>
    </div>)}
  </div>;
}
