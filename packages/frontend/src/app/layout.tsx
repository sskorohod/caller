import type { Metadata, Viewport } from 'next';
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
    default: 'LingoLine — AI Phone Agent Platform',
    template: '%s | LingoLine',
  },
  description: 'Deploy AI phone agents that handle calls 24/7, or merge a live translator into any conversation. One platform, zero complexity.',
  keywords: ['AI phone agent', 'live translator', 'phone translation', 'over the phone interpreter', 'voice AI'],
  authors: [{ name: 'LingoLine' }],
  creator: 'LingoLine',
  publisher: 'LingoLine',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lingoline.net',
    siteName: 'LingoLine',
    title: 'LingoLine — AI Phone Agent Platform',
    description: 'Deploy AI phone agents that handle calls 24/7, or merge a live translator into any conversation.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LingoLine — AI Phone Agent Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LingoLine — AI Phone Agent Platform',
    description: 'Deploy AI phone agents that handle calls 24/7, or merge a live translator into any conversation.',
    images: ['/og-image.png'],
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
