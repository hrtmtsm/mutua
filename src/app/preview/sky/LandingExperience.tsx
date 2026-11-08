'use client';

import dynamic from 'next/dynamic';
import localFont from 'next/font/local';
import Link from 'next/link';
import SkyTimePicker from './SkyTimePicker';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { paletteAt, selectedHour, type SkyMode } from '@/components/sky/palette';
import StaticMeadow from '@/components/sky/StaticMeadow';
import PeoplePossibilities from './PeoplePossibilities';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { useLocale } from '@/components/LocaleProvider';
import './sky.css';
const logoFont = localFont({ src:'./fonts/Nunito-Variable.ttf', variable:'--font-study-logo', weight:'200 1000', display:'swap' });
const SkyCanvas = dynamic(() => import('@/components/sky/SkyCanvas'),{ssr:false});
export default function LandingExperience({ preview = false }: { preview?: boolean }) {
  const { t } = useLocale();
  const MODES: { value: SkyMode; label:string }[] = [{value:'auto',label:t('landing.modeAuto')},{value:'morning',label:t('landing.modeMorning')},{value:'day',label:t('landing.modeDay')},{value:'evening',label:t('landing.modeEvening')},{value:'night',label:t('landing.modeNight')}];
  const [grassStill,setGrassStill] = useState(false);
  const [mode,setMode] = useState<SkyMode>('auto');
  const [hour,setHour] = useState(12);
  const [progress,setProgress] = useState(0);
  const [mobile,setMobile] = useState(false);
  const [reduced,setReduced] = useState(false);
  const [hidden,setHidden] = useState(false);
  const [supported,setSupported] = useState(false);
  const [checked,setChecked] = useState(false);
  const [failed,setFailed] = useState(false);
  const [staticMode,setStaticMode] = useState(false);
  const root = useRef<HTMLElement>(null);
  const fail = useCallback(()=>setFailed(true),[]);
  const palette = paletteAt(hour);
  useEffect(()=>{
    const update=()=>setHour(selectedHour(mode,new Date()));
    update(); const timer=window.setInterval(update,30000);
    return ()=>clearInterval(timer);
  },[mode]);
  useEffect(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const small=window.matchMedia('(max-width: 700px)');
    const updateMedia=()=>{setReduced(motion.matches);setMobile(small.matches);};
    const updateVisibility=()=>setHidden(document.hidden);
    updateMedia();updateVisibility();
    motion.addEventListener('change',updateMedia);small.addEventListener('change',updateMedia);
    document.addEventListener('visibilitychange',updateVisibility);
    const test=document.createElement('canvas');
    const context=test.getContext('webgl2')||test.getContext('webgl');
    setSupported(!!context);setChecked(true);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return ()=>{motion.removeEventListener('change',updateMedia);small.removeEventListener('change',updateMedia);document.removeEventListener('visibilitychange',updateVisibility);};
  },[]);
  useEffect(()=>{
    let frame=0, trailing=0, lastUpdate=0;
    const update=()=>{
      clearTimeout(trailing);
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const max=Math.max(1,(root.current?.scrollHeight??document.documentElement.scrollHeight)-window.innerHeight);
        const next=Math.max(0,Math.min(1,window.scrollY/max));
        const now=performance.now();
        if(now-lastUpdate>=80||next===0||next===1){lastUpdate=now;setProgress(next);}
        else trailing=window.setTimeout(update,80);
      });
    };
    update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
    return ()=>{cancelAnimationFrame(frame);clearTimeout(trailing);window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[]);
  const live = supported&&!failed&&!staticMode;
  const ctaHref = '/app?start=text';
  const skyStyle={ '--study-top':palette.top,'--study-middle':palette.middle,'--study-horizon':palette.horizon,'--study-ink':palette.ink,'--study-ground':palette.foreground } as CSSProperties;
  return <main ref={root} className={`sky-study ${logoFont.variable}`} style={skyStyle} data-hero-tone={palette.night>.55?'night':'day'} data-mode={mode} data-renderer={live?'webgl':'static'} data-reduced-motion={reduced} data-paused={hidden} data-landscape="meadow">
    <div className="study-background" aria-hidden="true">
      <div className="study-sky" />
      <div className="study-stars" style={{opacity:palette.stars}}>{Array.from({length:32},(_,i)=><i key={i} style={{left:`${(i*37.71)%100}%`,top:`${(i*17.63)%72}%`,width:i%5===0?2:1,height:i%5===0?2:1}}/>)}</div>
      {live && <SkyCanvas hour={hour} palette={palette} progress={progress} mobile={mobile} reduced={reduced} paused={hidden} onFailure={fail} grassStill={grassStill}/>}
      {!live && <div className="study-static-clouds" style={{opacity:palette.night>.6?.23:.5}}>{[1,2,3,4].map((n,i)=><img key={n} src={`/clouds/cloud-0${n}${mobile?'-mobile':''}.png`} alt="" style={{filter:`brightness(${1-palette.night*.65})`,left:i%2===0?'-20%':'65%',top:`${i*23-8}%`}} />)}</div>}
      {!live && <StaticMeadow palette={palette} progress={progress}/>}
    </div>
    <header className="study-header">
      <div className="study-brand-time">
        <Link href="/" className="study-brand" aria-label="Mutua ホーム">Mutua{preview && <span>Landscape preview</span>}</Link>
        <SkyTimePicker value={mode} onChange={setMode} label={t('landing.skyTime')} options={MODES}/>
      </div>
      <div className="study-header-controls">
        <LocaleSwitcher />
      </div>
    </header>
    <section className="study-hero possibility-hero" aria-labelledby="exchange-heading">
      <div className="study-hero-copy">
        <p className="study-eyebrow">{t('landing.eyebrow')}</p>
        <h1 id="exchange-heading"><span>{t('landing.heading1')}</span><span>{t('landing.heading2')}</span></h1>
        <p className="study-subtitle">{t('landing.subtitle1')}{t('landing.subtitle2') && <><br/>{t('landing.subtitle2')}</>}</p>
        <div className="landing-cta-row">
          <Link href={ctaHref} className="study-button possibility-start">{t('landing.cta')}</Link>
          <Link href="/app?login=1" className="landing-login-button">{t('setup.login')}</Link>
        </div>
      </div>
      <PeoplePossibilities reduced={reduced} hidden={hidden} mobile={mobile}/>
    </section>
    <section className="study-how" aria-labelledby="how-heading">
      <div className="study-how-intro">
        <p className="study-eyebrow">{t('landing.howEyebrow')}</p>
        <h2 id="how-heading">{t('landing.howHeading1')}<br/>{t('landing.howHeading2')}</h2>
      </div>
      <ol className="study-how-steps">
        <li><span className="study-step-number" aria-hidden="true">01</span><h3>{t('landing.step1Title')}</h3><p>{t('landing.step1Body')}</p></li>
        <li><span className="study-step-number" aria-hidden="true">02</span><h3>{t('landing.step2Title')}</h3><p>{t('landing.step2Body')}</p></li>
        <li><span className="study-step-number" aria-hidden="true">03</span><h3>{t('landing.step3Title')}</h3><p>{t('landing.step3Body')}</p></li>
      </ol>
    </section>
    <section className="study-arrival">
      <h2>{t('landing.arrivalHeading1')}<br/>{t('landing.arrivalHeading2')}</h2>
      <Link href="/app" className="study-button">{t('landing.arrivalCta')}</Link>
      <p className="study-signature" aria-hidden="true">Mutua</p>

    </section>
    {preview ? (
    <footer className="study-footer">
      <span>Independent landscape preview</span>
      <label><input type="checkbox" checked={staticMode} onChange={event=>{setStaticMode(event.target.checked);if(!event.target.checked)setFailed(false);}}/> 静的表示で確認</label>
      <label><input type="checkbox" checked={reduced} onChange={event=>setReduced(event.target.checked)}/> 動きを抑えて確認</label>
      <label><input type="checkbox" checked={grassStill} onChange={event=>setGrassStill(event.target.checked)}/> 草の風を止めて確認</label>
      <span role="status">{!checked?'背景を準備中':live?`${mobile?'モバイル':'デスクトップ'} · ${reduced?'動きを抑制':hidden?'一時停止':'雲がゆっくり移動'}`:'静的な空を表示中'}{failed?'（WebGLまたは雲の読み込みに失敗）':''}</span>
      <a href="/clouds/ATTRIBUTION.md">Cloud credits · CC0</a>
    </footer>
    ) : (
      <footer className="study-footer"><Link href="/auth/send">{t('landing.footerSignIn')}</Link><a href="mailto:hello@trymutua.com">{t('landing.footerContact')}</a></footer>
    )}
  </main>;
}
