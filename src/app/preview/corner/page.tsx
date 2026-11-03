'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { countryGreeting } from '@/lib/countryGreetings';
import { paletteAt } from '@/components/sky/palette';
import './corner.css';

// Standalone design preview — a static "floating objects in the sky" hero,
// styled after a reference screenshot the user supplied. Not linked from any
// production nav; no DB/API access; the only live link is the CTA to /app.
//
// The reference's product renders (croissant, disco ball, etc.) are replaced
// with our own illustrated avatars (existing /public/avatars assets, not
// real photos), each paired with a persistent greeting bubble in a different
// language — reusing the same countryGreeting() data GlobeHero uses.
//
// The cloud background reuses /preview/sky's SkyCanvas (real CC0 cloud
// photos drifting in an R3F canvas) at a fixed midday palette — showMeadow
// is off since this hero has no scroll journey or grass field. SkyCanvas's
// own meadow/cloud code is unchanged for /preview/sky (showMeadow defaults
// true there). If WebGL is unavailable, this falls back to painted CSS
// cloud blobs rather than silently showing a blank sky.

const SkyCanvas = dynamic(() => import('@/components/sky/SkyCanvas'), { ssr: false });
const DAY_PALETTE = paletteAt(12);

interface FloatItem {
  avatar: string;
  flag:   string;
  top:    string;
  left:   string;
  size:   number;
  rotate: number;
  bobDur: string;
  bobDelay: string;
  hideMobile?: boolean;
  hideNearText?: boolean;
}

const FLOCK: FloatItem[] = [
  { avatar: '/avatars/adventurer/01.svg',          flag: '🇯🇵', top: '23%', left: '6%',  size: 92, rotate: -6, bobDur: '6.5s', bobDelay: '0s' },
  { avatar: '/avatars/adventurer-neutral/03.svg',  flag: '🇫🇷', top: '46%', left: '4%',  size: 74, rotate: 5,  bobDur: '7.5s', bobDelay: '0.4s', hideNearText: true },
  { avatar: '/avatars/adventurer/05.svg',          flag: '🇰🇷', top: '24%', left: '85%', size: 82, rotate: 7,  bobDur: '6s',   bobDelay: '0.2s' },
  { avatar: '/avatars/adventurer-neutral/07.svg',  flag: '🇧🇷', top: '48%', left: '88%', size: 94, rotate: -5, bobDur: '8s',   bobDelay: '0.6s', hideNearText: true },
  { avatar: '/avatars/adventurer/09.svg',          flag: '🇮🇳', top: '74%', left: '10%', size: 72, rotate: 4,  bobDur: '7s',   bobDelay: '0.3s' },
  { avatar: '/avatars/adventurer-neutral/11.svg',  flag: '🇪🇸', top: '80%', left: '80%', size: 78, rotate: -4, bobDur: '6.8s', bobDelay: '0.5s' },
  { avatar: '/avatars/adventurer/12.svg',          flag: '🇺🇸', top: '26%', left: '19%', size: 58, rotate: 8,  bobDur: '5.5s', bobDelay: '0.1s', hideMobile: true },
  { avatar: '/avatars/adventurer-neutral/02.svg',  flag: '🇸🇦', top: '30%', left: '78%', size: 62, rotate: -8, bobDur: '6.2s', bobDelay: '0.7s', hideMobile: true },
];

export default function CornerPreview() {
  const [mobile, setMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [supported, setSupported] = useState(false);
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  const onFailure = useCallback(() => setFailed(true), []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const small = window.matchMedia('(max-width: 700px)');
    const updateMedia = () => { setReduced(motion.matches); setMobile(small.matches); };
    const updateVisibility = () => setHidden(document.hidden);
    updateMedia(); updateVisibility();
    motion.addEventListener('change', updateMedia);
    small.addEventListener('change', updateMedia);
    document.addEventListener('visibilitychange', updateVisibility);
    const test = document.createElement('canvas');
    const context = test.getContext('webgl2') || test.getContext('webgl');
    setSupported(!!context); setChecked(true);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return () => {
      motion.removeEventListener('change', updateMedia);
      small.removeEventListener('change', updateMedia);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  const live = checked && supported && !failed;

  return (
    <main className="corner-page">
      <div className="corner-cloud-layer" aria-hidden="true">
        {live ? (
          <SkyCanvas
            palette={DAY_PALETTE}
            progress={0}
            mobile={mobile}
            reduced={reduced}
            paused={hidden}
            grassStill
            showMeadow={false}
            onFailure={onFailure}
          />
        ) : (
          // WebGL unavailable — reuse the same real CC0 cloud photos /preview/sky
          // falls back to (public/clouds/), not a painted CSS substitute.
          checked && (
            <div className="corner-static-clouds">
              {[1, 2, 3, 4].map((n, i) => (
                <img
                  key={n}
                  src={`/clouds/cloud-0${n}${mobile ? '-mobile' : ''}.png`}
                  alt=""
                  style={{ left: i % 2 === 0 ? '-18%' : '62%', top: `${i * 22 - 6}%` }}
                />
              ))}
            </div>
          )
        )}
      </div>

      <nav className="corner-nav">
        <div className="corner-nav-links">
          <a href="#">使い方</a>
          <a href="#">アプリについて</a>
          <a href="#">よくある質問</a>
          <a href="#">お問い合わせ</a>
        </div>
        <Link href="/app" className="corner-nav-cta">
          <span aria-hidden="true">🌐</span> 無料ではじめる
        </Link>
      </nav>

      {FLOCK.map((item, i) => {
        const greeting = countryGreeting(item.flag);
        return (
          <div
            key={i}
            className="corner-float"
            data-hide-mobile={item.hideMobile ? 'true' : undefined}
            data-hide-near-text={item.hideNearText ? 'true' : undefined}
            style={{
              top: item.top,
              left: item.left,
              '--size': `${item.size}px`,
              '--rotate': `${item.rotate}deg`,
              '--bob-dur': item.bobDur,
              '--bob-delay': item.bobDelay,
              animationDelay: `${i * 90}ms`,
            } as React.CSSProperties}
          >
            <span className="corner-greeting" lang={greeting.lang} dir="auto">
              <span aria-hidden="true">{item.flag}</span> {greeting.text}
            </span>
            <span className="corner-avatar">
              <img src={item.avatar} alt="" />
            </span>
          </div>
        );
      })}

      <div className="corner-hero">
        <h1 className="corner-wordmark">Mutua</h1>
        <p className="corner-tagline">教科書は、置いていこう</p>
      </div>
    </main>
  );
}
