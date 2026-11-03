/** Decorative landscape. Seeded geometry keeps server and client output identical. */
export function CloudBank({ className = '' }: { className?: string }) {
  return <div className={`lp-cloud-bank ${className}`} aria-hidden="true">
    <div className="lp-cloud lp-cloud-left" /><div className="lp-cloud lp-cloud-right" />
  </div>;
}

export function Meadow() {
  const blades = Array.from({ length: 7 }, (_, group) => {
    let path = '';
    for (let i = 0; i < 150; i++) {
      const seed = group * 150 + i;
      const x = (seed * 137.508) % 1600;
      const y = 410 + ((seed * 37.13) % 260);
      const height = 24 + ((seed * 23.71) % 115);
      const lean = 8 + ((seed * 17.3) % 28);
      path += `M${x},${y}Q${x + 2},${y - height * .55} ${x - lean},${y - height}Q${x + 13},${y - height * .45} ${x + 5},${y}Z`;
    }
    return <path key={group} d={path} fill={`var(--grass-${group})`} />;
  });
  return <svg className="lp-meadow-art" viewBox="0 0 1600 680" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="meadow-haze" x2="0" y2="1"><stop stopColor="var(--hill-light)"/><stop offset="1" stopColor="var(--hill-dark)"/></linearGradient></defs>
    <path fill="var(--hill-far)" d="M0 265Q200 160 460 272T980 250T1600 225V680H0Z" />
    <path fill="url(#meadow-haze)" d="M0 295Q250 230 560 360Q850 455 1180 290Q1430 200 1600 290V680H0Z" />
    <path fill="var(--hill-dark)" d="M0 380Q270 285 610 470Q950 540 1230 370Q1440 315 1600 365V680H0Z" />
    {blades}
    {[170, 335, 1220, 1450, 870].map((x, i) => <g key={x} transform={`translate(${x} ${490 + (i % 3) * 48})`}>
      <path d="M0 25Q5 5 0-12" fill="none" stroke="var(--grass-4)" strokeWidth="3"/>
      {[0, 72, 144, 216, 288].map(angle => <ellipse key={angle} rx="4" ry="9" cy="-7" fill="#fff6da" transform={`rotate(${angle})`}/>)}
      <circle r="4" fill="#e5b74c"/>
    </g>)}
  </svg>;
}
