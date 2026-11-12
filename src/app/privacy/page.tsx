'use client';

import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';

const policy = {
  ja: {
    intro: 'Mutuaでアカウントを作成し、言語交換やAI練習を使うときのデータの取り扱いを説明します。',
    sections: [
      {
        id: 'account',
        title: 'アカウントと利用データ',
        paragraphs: [
          'メールアドレスはSupabase Authでアカウントの作成とログインに使います。プロフィールや言語設定は、プロフィール表示や言語パートナーとのマッチングに使います。',
          '利用状況の計測が有効なサイトでは、ページ閲覧や操作の情報、セッション識別子、言語設定をPostHogに送信することがあります。',
        ],
      },
      {
        id: 'call-transcription',
        title: '人との通話と文字起こし',
        paragraphs: [
          '文字起こしは初期状態でオフです。招待する人と承諾する人の両方がその通話で選択した場合に限り、音声をOpenAIに送り、話者付きの会話ログを保存します。参加者は履歴からそのログを確認できます。文字起こしには誤りが含まれることがあります。',
          '文字起こしをオフにしたまま通話できます。接続した通話の日時、参加者、言語、通話時間などの基本履歴は、文字起こしの設定にかかわらず保存されます。Mutuaは通話の原音を履歴に保存しません。',
        ],
      },
      {
        id: 'ai-practice',
        title: 'AIとの音声練習',
        paragraphs: [
          'AIとの音声練習を選ぶと、音声や練習設定がOpenAIに送信されます。練習の通話履歴と文字起こしが保存されます。',
          'AI練習で過去の会話を使う設定をオンにすると、同じ学習言語での過去の通話から、あなた自身の確定発話の一部もOpenAIに送信します。聞き返した単語や言い直した表現を練習し、会話の難しさを合わせるために使います。',
        ],
      },
      {
        id: 'ai-review',
        title: '通話後にAIに質問する',
        paragraphs: [
          'AIに質問を送ると、その質問と対象の通話ログの文脈、同じ通話についてのあなたの振り返りチャット履歴がOpenAIに送信されます。質問と回答はあなたの履歴に保存され、通話相手には表示されません。',
        ],
      },
    ],
  },
  en: {
    intro: 'How Mutua handles data when you create an account, exchange languages, or practice with AI.',
    sections: [
      {
        id: 'account',
        title: 'Account and usage data',
        paragraphs: [
          'Supabase Auth uses your email address to create your account and sign you in. Mutua uses your profile and language preferences to show your profile and match you with language partners.',
          'Where usage analytics are enabled, Mutua may send page views, interaction events, a session identifier, and language preferences to PostHog.',
        ],
      },
      {
        id: 'call-transcription',
        title: 'Calls with people and transcription',
        paragraphs: [
          'Transcription is off by default. If both people opt in for the call, audio is sent to OpenAI for transcription and a speaker-labeled transcript is saved. Both participants can see it in their call history. Transcripts may contain errors.',
          'You can make a call with transcription off. Basic history for connected calls, such as when you called, who participated, languages, and call duration, is saved with or without transcription. Mutua does not store original call audio in your history.',
        ],
      },
      {
        id: 'ai-practice',
        title: 'Voice practice with AI',
        paragraphs: [
          'When you choose to practice with AI, OpenAI receives your audio and practice settings. Mutua saves the practice call in your history along with its transcript.',
          'If you choose to personalize AI practice using past conversations, Mutua also sends short excerpts of your own finalized speech from past calls for the same learning language to OpenAI. The AI can use these excerpts to revisit words or expressions and adjust the difficulty of the conversation.',
        ],
      },
      {
        id: 'ai-review',
        title: 'Asking AI about a call',
        paragraphs: [
          'When you ask AI a question, OpenAI receives your question, context from that call’s transcript, and your review chat history for the same call. Mutua saves the questions and answers in your history, visible only to you in the app.',
        ],
      },
    ],
  },
};

export default function PrivacyPage() {
  const { locale } = useLocale();
  const japanese = locale === 'ja';
  const content = japanese ? policy.ja : policy.en;

  return (
    <main lang={japanese ? 'ja' : 'en'} className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <Link href="/" className="font-semibold underline underline-offset-4">Mutua</Link>
      <h1 className="mt-8 text-3xl font-bold text-balance sm:text-4xl">
        {japanese ? 'プライバシーポリシー' : 'Privacy Policy'}
      </h1>
      <p className="mt-4 leading-relaxed text-pretty">{content.intro}</p>
      {content.sections.map(section => (
        <section key={section.id} id={section.id} className="mt-8 scroll-mt-6">
          <h2 className="text-xl font-semibold text-balance">{section.title}</h2>
          {section.paragraphs.map(paragraph => (
            <p key={paragraph} className="mt-2 leading-relaxed text-pretty">{paragraph}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
