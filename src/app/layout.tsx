import type { Metadata } from 'next';
import { Inter, Spline_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist',
});

const splineSans = Spline_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: 'Mutua — Language exchange with purpose',
  description:
    'Answer 5 questions. Get matched with a language partner who complements you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${splineSans.variable} font-sans text-neutral-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
