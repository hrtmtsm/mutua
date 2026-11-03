import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Sora } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import 'flag-icons/css/flag-icons.min.css';
import PostHogProvider from '@/components/PostHogProvider';
import PageTransition from '@/components/PageTransition';
import BanGate from '@/components/BanGate';
import ThemeProvider from '@/components/ThemeProvider';
import LocaleProvider from '@/components/LocaleProvider';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '600', '700', '800'],
});

// Same wordmark font as the landing page (/) — so the "Mutua" logo reads
// identically whether you're on the marketing page or inside the app.
const logoFont = localFont({
  src: './preview/sky/fonts/Nunito-Variable.ttf',
  variable: '--font-logo',
  weight: '200 1000',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mutua — Language exchange with purpose',
  description:
    'Answer 5 questions. Get matched with a language partner who complements you.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en" className={`${GeistSans.variable} ${sora.variable} ${logoFont.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=localStorage.getItem('yonder-theme');var h=new Date().getHours();var t=p==='light'||p==='night'?p:(h>=7&&h<19?'light':'night');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==='night'?'dark':'light'}catch(e){}try{var l=localStorage.getItem('yonder-locale');if(l)document.documentElement.lang=l}catch(e){}})()` }} /></head>
      <body className="font-sans text-neutral-900 antialiased bg-white">
        <div className="overflow-hidden w-full">
          <ThemeProvider><LocaleProvider><PostHogProvider><BanGate><PageTransition>{children}</PageTransition></BanGate></PostHogProvider></LocaleProvider></ThemeProvider>
        </div>
      </body>
    </html>
  );
}
