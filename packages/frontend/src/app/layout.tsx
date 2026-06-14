import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/lib/toast';
import { ThemeProvider } from '@/lib/theme';
import AnalyticsTracker from '@/components/AnalyticsTracker';

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
        {/* Google Tag Manager + Google Ads — DEFERRED. Loaded on the first user
            interaction (scroll/touch/click/key) or shortly after load as a
            fallback, so ~286 KB of tag-manager JS stays off the critical path
            (better FCP/LCP/TBT). GTM-MWTVH7RL manages GA4 (G-FZFVXEJMSD);
            AW-18232663036 is the Google Ads tag. Adjust the 3500ms fallback to
            trade analytics coverage of non-interacting sessions vs. load speed. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var loaded=false;function load(){if(loaded)return;loaded=true;
window.dataLayer=window.dataLayer||[];
window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var g=document.createElement('script');g.async=true;g.src='https://www.googletagmanager.com/gtm.js?id=GTM-MWTVH7RL';document.head.appendChild(g);
var a=document.createElement('script');a.async=true;a.src='https://www.googletagmanager.com/gtag/js?id=AW-18232663036';document.head.appendChild(a);
function gtag(){window.dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18232663036');}
var evts=['scroll','mousemove','touchstart','keydown','pointerdown','click'];
function once(){load();evts.forEach(function(e){window.removeEventListener(e,once);});}
evts.forEach(function(e){window.addEventListener(e,once,{passive:true});});
window.addEventListener('load',function(){setTimeout(load,3500);});})();`,
          }}
        />
        {/* End Google Tag Manager (deferred) */}
        {/* Early-connect to the Google Fonts origins to shave a round-trip on mobile. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols — SELF-HOSTED subset (only the ~116 icons the app
            uses, 16 KB woff2). @font-face + the icon class are inlined so the
            glyph box is sized before first paint (no CLS), font-display:block hides
            the ligature text until the font loads (no flash), and there is NO
            external render-blocking CSS request — the woff2 is same-origin and
            preloaded. To change the icon set, re-fetch the subset from the css2
            `icon_names=` URL and bump the versioned filename below. */}
        <link rel="preload" href="/fonts/material-symbols-subset-v347.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <style>{`@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400;font-display:block;src:url(/fonts/material-symbols-subset-v347.woff2) format('woff2')}.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-feature-settings:'liga';-webkit-font-smoothing:antialiased;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24}`}</style>
      </head>
      <body>
        {/* Google Tag Manager (noscript) — must be immediately after <body>. */}
        <noscript dangerouslySetInnerHTML={{ __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MWTVH7RL" height="0" width="0" style="display:none;visibility:hidden"></iframe>` }} />
        {/* End Google Tag Manager (noscript) */}
        {/* GTM + Google Ads (AW-18232663036) load via the deferred loader in
            <head> on first interaction — see comment there. */}
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
        {/* First-party site analytics — self-gated to public pages */}
        <AnalyticsTracker />
      </body>
    </html>
  );
}
