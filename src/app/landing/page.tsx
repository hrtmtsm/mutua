import Link from 'next/link';

const HOW_IT_WORKS = [
  {
    n: '01',
    heading: 'Tell us who you are',
    body: 'Your native language, what you want to learn, your goal, how you like to communicate, and when you are free.',
    rotate: 'rotate-1',
  },
  {
    n: '02',
    heading: 'We do the matching',
    body: 'We find someone whose languages, goals, and schedule are the mirror image of yours. No browsing, no swiping.',
    rotate: '-rotate-1',
  },
  {
    n: '03',
    heading: 'Know why before you talk',
    body: 'See the exact reasons you were paired and get conversation starters — so the first minute is never awkward.',
    rotate: 'rotate-[0.5deg]',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">

      {/* Nav */}
      <nav className="px-6 py-4 border-b-2 border-neutral-900 flex items-center justify-between bg-[#f5ede0]">
        <span className="font-serif font-black text-xl tracking-tight">Mutua</span>
        <Link
          href="/onboarding"
          className="text-sm font-semibold border-2 border-neutral-900 px-4 py-1.5 rounded-lg bg-white shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          Get started
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[6px_6px_0_0_#111] px-10 py-14 max-w-xl w-full">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-5">
            Language exchange with purpose
          </p>
          <h1 className="font-serif font-black text-3xl md:text-5xl text-neutral-900 leading-[1.05] tracking-[-0.02em] mb-5">
            Stop searching for language partners.<br />Start speaking.
          </h1>
          <p className="text-base text-stone-600 leading-relaxed mb-10 max-w-sm mx-auto">
            Let us do the hard part.<br />
            We&rsquo;ll match you with a compatible learner.<br />
            Know exactly why before you say hello.
          </p>
          <Link
            href="/onboarding"
            className="inline-block px-8 py-4 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold text-base rounded-lg shadow-[4px_4px_0_0_#111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            Find a partner &rarr;
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-8 text-center">
            How it works
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(({ n, heading, body, rotate }) => (
              <div
                key={n}
                className={`bg-white border-2 border-neutral-900 rounded-xl shadow-[4px_4px_0_0_#111] p-6 flex flex-col gap-3 ${rotate}`}
              >
                <span className="font-serif font-black text-4xl text-amber-400 leading-none">{n}</span>
                <h3 className="font-bold text-neutral-900 text-base">{heading}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
