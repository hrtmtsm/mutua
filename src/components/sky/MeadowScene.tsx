import type { Palette } from './palette';
const clamp = (x: number) => Math.max(0, Math.min(1,x));
const blades = Array.from({length:3},(_,group) => {
  let path='';
  for(let i=0;i<170;i++) {
    const seed=i+group*170, x=(seed*137.508)%1600, y=610+(seed*19.7)%95;
    const height=28+(seed*11.37)%100, lean=8+(seed*7.13)%26;
    path+=`M${x},${y}Q${x-4},${y-height*.6} ${x-lean},${y-height}Q${x+4},${y-height*.4} ${x+4},${y}Z`;
  }
  return path;
});
export default function MeadowScene({ palette:p, progress, reduced }: { palette:Palette; progress:number; reduced:boolean }) {
  const rise = (start:number) => `translate3d(0,${(1-clamp((progress-start)/(1-start)))*105}%,0)`;
  return <div className="study-meadow" aria-hidden="true">
    <svg className="study-terrain study-terrain-far" viewBox="0 0 1600 700" preserveAspectRatio="none" style={{ transform:rise(.08) }}>
      <path fill={p.far} d="M0 340Q210 240 470 330T980 320T1600 280V700H0Z"/>
    </svg>
    <svg className="study-terrain study-terrain-middle" viewBox="0 0 1600 700" preserveAspectRatio="none" style={{ transform:rise(.24) }}>
      <path fill={p.hill} d="M0 365Q230 270 550 420Q850 550 1150 370Q1380 270 1600 355V700H0Z"/>
      <path fill={p.grass} opacity=".55" d="M0 430Q300 360 620 505Q950 570 1250 420T1600 440V700H0Z"/>
    </svg>
    <svg className="study-terrain study-terrain-front" viewBox="0 0 1600 700" preserveAspectRatio="none" style={{ transform:rise(.45) }}>
      <path fill={p.foreground} d="M0 570Q300 500 650 625Q1040 670 1300 555Q1490 510 1600 550V700H0Z"/>
      {blades.map((d,i)=><path key={i} d={d} fill={i===0?p.foreground:i===1?p.grass:p.hill} opacity={i===2?.5:.9} />)}
    </svg>
    {/* Reduced motion keeps the natural reveal from normal scrolling, without extra sway. */}
    <span className="sr-only">{reduced ? 'Still landscape' : 'Landscape'}</span>
  </div>;
}
