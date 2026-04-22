import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Sora } from 'next/font/google';
import './globals.css';
import 'flag-icons/css/flag-icons.min.css';
import PostHogProvider from '@/components/PostHogProvider';
import PageTransition from '@/components/PageTransition';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Mutua — Language exchange with purpose',
  description:
    'Answer 5 questions. Get matched with a language partner who complements you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${sora.variable}`}>
      <body className="font-sans text-neutral-900 antialiased overflow-x-hidden bg-white">
        <PostHogProvider><PageTransition>{children}</PageTransition></PostHogProvider>
      </body>
    </html>
  );
}
