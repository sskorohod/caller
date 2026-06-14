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
        {/* Material Symbols — SUBSET to only the icons the app uses (icon_names);
            the full variable icon font is ~1.1 MB, the subset ~17 KB. Loaded
            synchronously (render-blocking but tiny + preconnected) so the icon
            glyph box is sized before first paint — async loading shifted the hero
            CTAs (CLS). display=block avoids any ligature-text flash. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=account_balance,account_balance_wallet,add,add_call,ads_click,apartment,architecture,arrow_back,arrow_forward,article,auto_awesome,auto_stories,autorenew,balance,bolt,business_center,call,call_end,call_merge,call_missed,cancel,cell_tower,chat_bubble,check_circle,chevron_left,chevron_right,close,code,compare_arrows,confirmation_number,dark_mode,dashboard,description,dialpad,error,filter_alt,forum,gavel,graphic_eq,group,headphones,health_and_safety,hearing,help,history,hourglass_bottom,hourglass_empty,hourglass_top,hub,inbox,info,insights,language,light_mode,local_hospital,lock,login,loyalty,mail,mark_email_read,mark_email_unread,menu_book,mic,mic_off,monitoring,more_horiz,notifications,palette,payments,person,person_add,person_off,phone,phone_enabled,phone_in_talk,play_circle,policy,progress_activity,psychology,public,receipt_long,record_voice_over,redeem,remove_circle,repeat,rocket_launch,savings,schedule,search,send,sentiment_satisfied,settings,shield,show_chart,sim_card,sim_card_alert,sim_card_download,smart_toy,smartphone,spatial_audio_off,star,subtitles,support_agent,sync,sync_alt,thermostat,timeline,timer,touch_app,translate,travel_explore,trending_up,verified,visibility,volume_up,warning&display=block" />
        <style>{`.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }`}</style>
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
