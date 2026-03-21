import type { Metadata } from 'next';
import { Inter, Syne } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Mutua — Language exchange with purpose',
  description:
    'Answer 5 questions. Get matched with a language partner who complements you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${syne.variable} font-sans text-neutral-900 antialiased overflow-x-hidden bg-white`}>
        {children}
      </body>
    </html>
  );
}
