import Link from 'next/link';
import dynamic from 'next/dynamic';

const GlobeHero = dynamic(() => import('@/components/GlobeHero'), { ssr: false });

const HOW_IT_WORKS = [
  {
    n: '01',
    heading: 'Tell us who you are',
    body: 'Your native language, what you want to learn, your goal, how you like to communicate, and when you are free.',
  },
  {
    n: '02',
    heading: 'We do the matching',
    body: 'We find someone whose languages, goals, and schedule are the mirror image of yours. No browsing, no swiping.',
  },
  {
    n: '03',
    heading: 'Know why before you talk',
    body: 'See the exact reasons you were paired and get conversation starters — so the first minute is never awkward.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">

      {/* ── HERO + GLOBE (single seamless background) ─────────────────────────── */}
      <div style={{ position: 'relative' }}>
        {/* Sky background with desaturation */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/sky.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(to bottom, rgba(10,40,100,0.18) 0%, transparent 45%, rgba(255,255,255,0.9) 94%, #ffffff 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Hero text */}
        <section className="flex flex-col">
          <nav className="px-8 py-5 flex items-center justify-between">
            <span className="font-serif font-black text-2xl tracking-tight text-white drop-shadow">Mutua</span>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-semibold px-4 py-2 rounded-full text-white border border-white/40 hover:bg-white/10 transition-all"
              >
                Sign in
              </Link>
              <Link
                href="/onboarding"
                className="text-sm font-bold px-5 py-2 rounded-lg bg-[#2B8FFF] text-white hover:bg-blue-600 transition-all shadow"
              >
                Join the waitlist
              </Link>
            </div>
          </nav>

          <div className="text-center px-6 pt-10 pb-6">
            <h1
              className="font-serif font-black text-white leading-[0.97] tracking-[-0.02em] mb-5"
              style={{ fontSize: 'clamp(44px, 5.5vw, 78px)', textShadow: '0 1px 6px rgba(0,0,0,0.22)' }}
            >
              Find someone who actually<br />wants to practice.
            </h1>
            <p className="text-white/80 text-base md:text-lg max-w-sm mx-auto mb-8 leading-relaxed">
              Stop searching.<br />Start speaking.
            </p>
            <Link
              href="/onboarding"
              className="inline-block px-8 py-3.5 bg-white text-blue-600 font-bold text-base rounded-full shadow-xl hover:bg-blue-50 transition-all"
            >
              Start speaking &rarr;
            </Link>
          </div>
        </section>

        {/* Globe — full circle, fully visible, centered */}
        <section className="flex justify-center items-center pt-0 pb-10">
          <div style={{ position: 'relative', width: 'min(96vw, 940px)', height: 'min(96vw, 940px)', flexShrink: 0 }}>
            {/* Radial glow behind globe */}
            <div style={{
              position: 'absolute',
              inset: '-12%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(130,206,239,0.18) 45%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            {/* Globe with saturation + brightness boost */}
            <div style={{ width: '100%', height: '100%', filter: 'saturate(1.22) contrast(1.08) brightness(1.04)' }}>
              <GlobeHero />
            </div>
          </div>
        </section>
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 mb-10 text-center">
            How it works
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(({ n, heading, body }) => (
              <div key={n} className="flex flex-col gap-3 p-6 rounded-2xl bg-sky-50 border border-sky-100">
                <span className="font-serif font-black text-4xl text-blue-400 leading-none">{n}</span>
                <h3 className="font-bold text-neutral-900 text-base">{heading}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-14">
            <Link
              href="/onboarding"
              className="inline-block px-8 py-3.5 bg-blue-500 text-white font-bold text-base rounded-full shadow-md hover:bg-blue-600 transition-all"
            >
              Join the waitlist &rarr;
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
