import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist',
});

const reckless = Fraunces({
  subsets: ['latin'],
  variable: '--font-reckless',
  weight: ['700', '900'],
});

export const metadata: Metadata = {
  title: 'Mutua — Language exchange with purpose',
  description:
    'Answer 5 questions. Get matched with a language partner who complements you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${reckless.variable} font-sans text-neutral-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
