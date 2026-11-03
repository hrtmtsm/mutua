'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { label:'YOUR LANGUAGES', title:'Share your languages', body:'Tell us which language you speak and which one you’re learning.' },
  { label:'YOUR PARTNER', title:'Find your partner', body:'Choose text or voice. Match with someone whose languages complement yours.' },
  { label:'YOUR CONVERSATION', title:'Help each other practice', body:'Exchange messages or talk by voice. Take turns learning from each other.' },
];
function Demo({step}:{step:number}) {
  return <div className={`how-demo how-demo-${step}`} aria-hidden="true">
    <span className="how-demo-label">{STEPS[step].label}</span>
    {step===0 ? <div className="how-demo-language-pair">
      <div><span>I speak</span><strong><span>🇯🇵</span> Japanese</strong></div>
      <span className="how-demo-arrow">↘</span>
      <div><span>I’m learning</span><strong><span>🇬🇧</span> English</strong></div>
    </div> : step===1 ? <div className="how-demo-match">
      <div><span>You</span><strong>Japanese <i>→</i> English</strong></div>
      <span className="how-demo-match-link">↕</span>
      <div><span>Your partner</span><strong>English <i>→</i> Japanese</strong></div>
    </div> : <div className="how-demo-conversation">
      <p>How do you say hello?</p><p lang="ja">こんにちは！</p>
      <span className="how-demo-voice"><svg viewBox="0 0 52 20" width="52" height="20"><path d="M2 8v4m6-8v12m6-10v8m6-13v18m6-14v10m6-12v14m6-11v8m6-6v4m6-3v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Chat or voice</span>
    </div>}
  </div>;
}
export default function HowItWorks() {
  const [active,setActive]=useState(0);
  const steps=useRef<(HTMLLIElement|null)[]>([]);
  useEffect(()=>{
    if(!('IntersectionObserver' in window))return;
    const observer=new IntersectionObserver(()=>{
      let closest=-1,distance=Infinity;
      steps.current.forEach((element,index)=>{
        if(!element)return;
        const rect=element.getBoundingClientRect();
        if(rect.bottom<=window.innerHeight*.25||rect.top>=window.innerHeight*.75)return;
        const value=Math.abs((rect.top+rect.bottom)/2-window.innerHeight*.5);
        if(value<distance){closest=index;distance=value;}
      });
      if(closest!==-1)setActive(closest);
    },{rootMargin:'-25% 0px -25% 0px',threshold:[0,.2,.4,.6,.8,1]});
    steps.current.forEach(element=>{if(element)observer.observe(element);});
    return ()=>observer.disconnect();
  },[]);
  return <section className="study-how how-story" aria-labelledby="how-heading" data-active-step={active+1}>
    <div className="study-how-intro"><p className="study-eyebrow">HOW IT WORKS</p><h2 id="how-heading">Your next conversation,<br/>in three simple steps.</h2></div>
    <div className="how-story-grid">
      <div className="how-story-visual"><div key={active} className="how-demo-change"><Demo step={active}/></div></div>
      <ol className="how-story-steps">
        {STEPS.map((step,index)=><li key={step.label} ref={element=>{steps.current[index]=element;}} className={`how-story-step${active===index?' is-current':''}`} aria-current={active===index?'step':undefined} data-step={index+1}>
          <div className="how-story-mobile-demo"><Demo step={index}/></div>
          <p className="how-story-kicker">0{index+1} <span aria-hidden="true">/</span> {step.label}</p>
          <h3>{step.title}</h3><p className="how-story-body">{step.body}</p>
        </li>)}
      </ol>
    </div>
  </section>;
}
