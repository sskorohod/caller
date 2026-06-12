import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/lib/toast';
import { ThemeProvider } from '@/lib/theme';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e131f',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://lingoline.net'),
  title: {
    default: 'LingoLine — AI Live Phone Translator',
    template: '%s | LingoLine',
  },
  description: 'LingoLine translates your phone calls in real time, both ways. Merge it into any call or use speakerphone — no app, works from any phone, pay as you go.',
  keywords: ['live phone translator', 'real-time call translation', 'phone interpreter', 'over the phone interpretation', 'AI translator', 'expat'],
  authors: [{ name: 'LingoLine' }],
  creator: 'LingoLine',
  publisher: 'LingoLine',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lingoline.net',
    siteName: 'LingoLine',
    title: 'LingoLine — AI Live Phone Translator',
    description: 'Real-time, two-way translation on any phone call. Speak freely, live lighter.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 675, alt: 'LingoLine — AI live phone translator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LingoLine — AI Live Phone Translator',
    description: 'Real-time, two-way translation on any phone call. Speak freely, live lighter.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LingoLine',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
        <style>{`.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }`}</style>
      </head>
      <body>
        {/* Google Ads (gtag.js) */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=AW-18232663036" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-18232663036');`}
        </Script>
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
