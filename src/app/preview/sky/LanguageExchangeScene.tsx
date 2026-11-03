import Image from 'next/image';
import portraits from './avatars/language-partners.png';

const PEOPLE = [
  { name:'Haru', speaks:'Japanese', learning:'English', className:'exchange-haru' },
  { name:'Alex', speaks:'English', learning:'Japanese', className:'exchange-alex' },
];
export default function LanguageExchangeScene({ orbit = false }: { orbit?: boolean }) {
  return <div className={`exchange-scene${orbit ? ' exchange-orbit' : ''}`} aria-label="Two language partners practicing together">
    <div className="exchange-people">
      {PEOPLE.map(person=><figure key={person.name} className={`exchange-person ${person.className}`}>
        <div className="exchange-portrait exchange-photo"><Image src={portraits} alt={`Portrait of ${person.name}, an example language partner`} sizes="248px" priority /></div>
        <figcaption>
          <h2>{person.name}</h2>
          <dl className="exchange-languages">
            <div><dt>Speaks</dt><dd>{person.speaks}</dd></div>
            <div><dt>Learning</dt><dd>{person.learning}</dd></div>
          </dl>
        </figcaption>
      </figure>)}
    </div>
    <ol className="exchange-dialogue" aria-label="Example language exchange conversation">
      <li className="exchange-message exchange-message-haru"><b>Haru:</b> How do you say “nice to meet you” in Japanese?</li>
      <li className="exchange-message exchange-message-alex"><b>Alex:</b> <span lang="ja">「はじめまして」</span>… did I get that right?</li>
      <li className="exchange-message exchange-message-haru exchange-message-short"><b>Haru:</b> Perfect!</li>
    </ol>
    <p className="exchange-caption">
      <svg viewBox="0 0 52 20" width="52" height="20" aria-hidden="true"><path d="M2 8v4m6-8v12m6-10v8m6-13v18m6-14v10m6-12v14m6-11v8m6-6v4m6-3v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      <span>Chat or voice <span aria-hidden="true">·</span> Example conversation</span>
    </p>
  </div>;
}
