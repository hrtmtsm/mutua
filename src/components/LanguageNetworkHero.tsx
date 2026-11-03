'use client';

// 装飾用のビジュアル(/app のマッチング前画面、地球儀の代わり)。
// 「世界各地の言語パートナーとゆるく繋がっている」感覚を、散らしたカードと
// 点線の曲線で表現する。実在の利用者データは一切使わない(キャラクターは
// 既存のイラストアバター素材、言語・タグも架空の演出)。クリック・選択・
// プロフィール閲覧などの操作は持たない、純粋な装飾。

interface Card {
  lang:   string;
  flag:   string;
  tag:    string;
  avatar: string;
  bg:     string;
  cx:     number; // center x, % of container
  cy:     number; // center y, % of container
  size:   number; // width/height, % of container
  rotate: number; // deg
}

const CARDS: Card[] = [
  { lang: '日本語',       flag: '🇯🇵', tag: '初心者歓迎',   avatar: '/avatars/adventurer/02.svg',          bg: '#cfe0c2', cx: 17, cy: 21, size: 28, rotate: -7 },
  { lang: 'スペイン語',   flag: '🇪🇸', tag: '気軽な雑談',   avatar: '/avatars/adventurer-neutral/05.svg',  bg: '#e3c9a8', cx: 15, cy: 64, size: 27, rotate: 6 },
  { lang: 'フランス語',   flag: '🇫🇷', tag: '文化交流',     avatar: '/avatars/adventurer/07.svg',          bg: '#b7cbdb', cx: 50, cy: 42, size: 32, rotate: -3 },
  { lang: '韓国語',       flag: '🇰🇷', tag: '推し活トーク', avatar: '/avatars/adventurer-neutral/09.svg',  bg: '#e8b9c6', cx: 83, cy: 19, size: 29, rotate: 8 },
  { lang: 'ポルトガル語', flag: '🇧🇷', tag: '旅好きさん',   avatar: '/avatars/adventurer/11.svg',          bg: '#9fb89f', cx: 85, cy: 63, size: 28, rotate: -6 },
  { lang: 'ヒンディー語', flag: '🇮🇳', tag: '新しい発見',   avatar: '/avatars/adventurer-neutral/03.svg',  bg: '#d7c3e0', cx: 53, cy: 87, size: 25, rotate: 4 },
];

// 中心(フランス語カード=index 2)から各カードへ軽く結ぶ、ゆるいネットワーク
const LINKS: [number, number][] = [[2, 0], [0, 1], [2, 3], [3, 4], [2, 5]];

const TAGS = [
  { text: '気軽に話せる',   top: '6%',  left: '38%' },
  { text: '新しい友達',     top: '48%', left: '2%' },
  { text: 'いつでも繋がる', top: '72%', left: '56%' },
];

const BADGES = [
  { icon: '💬', top: '2%',  left: '64%' },
  { icon: '🌍', top: '36%', left: '66%' },
  { icon: '✨', top: '62%', left: '18%' },
];

function curve(a: Card, b: Card) {
  const mx = (a.cx + b.cx) / 2;
  const my = (a.cy + b.cy) / 2;
  // perpendicular offset for a gentle arc, not a straight line
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  const nx = -dy, ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  const bow = 10;
  const cx = mx + (nx / len) * bow;
  const cy = my + (ny / len) * bow;
  return `M ${a.cx} ${a.cy} Q ${cx} ${cy} ${b.cx} ${b.cy}`;
}

export default function LanguageNetworkHero() {
  return (
    <div className="lang-net relative w-full h-full">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {LINKS.map(([a, b], i) => (
          <path key={i} d={curve(CARDS[a], CARDS[b])} pathLength={1} className="lang-net-line" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </svg>

      {BADGES.map((b, i) => (
        <span key={i} className="lang-net-badge" style={{ top: b.top, left: b.left, animationDelay: `${300 + i * 150}ms` }} aria-hidden="true">
          {b.icon}
        </span>
      ))}

      {TAGS.map((t, i) => (
        <span key={t.text} className="lang-net-tag" style={{ top: t.top, left: t.left, animationDelay: `${450 + i * 150}ms` }}>
          {t.text}
        </span>
      ))}

      {CARDS.map((c, i) => (
        <div
          key={c.lang}
          className="lang-net-card"
          style={{
            top: `${c.cy - c.size / 2}%`,
            left: `${c.cx - c.size / 2}%`,
            width: `${c.size}%`,
            aspectRatio: '0.82',
            background: c.bg,
            '--rotate': `${c.rotate}deg`,
            animationDelay: `${i * 90}ms`,
          } as React.CSSProperties}
        >
          <div className="lang-net-card-photo">
            <img src={c.avatar} alt="" />
          </div>
          <div className="lang-net-card-label">
            <p className="lang-net-card-lang">{c.flag} {c.lang}</p>
            <p className="lang-net-card-tag">{c.tag}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
