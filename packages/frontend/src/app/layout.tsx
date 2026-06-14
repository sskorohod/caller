import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
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
        {/* Google Tag Manager — placed as high as possible in <head>.
            Container GTM-MWTVH7RL manages GA4 (G-FZFVXEJMSD) and any future
            Google Ads conversions. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MWTVH7RL');`,
          }}
        />
        {/* End Google Tag Manager */}
        {/* Early-connect to the Google Fonts origins to shave a round-trip on mobile. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols — SUBSET to only the icons the app uses (icon_names);
            the full variable icon font is ~1.1 MB, the subset a few tens of KB.
            Loaded ASYNC (preload fetches it early; an rAF inserts the stylesheet
            after first paint) so it never blocks rendering. display=block hides
            the ligature text until the glyphs are ready. */}
        <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=account_balance,account_balance_wallet,add,add_call,ads_click,apartment,architecture,arrow_back,arrow_forward,article,auto_awesome,auto_stories,autorenew,balance,bolt,business_center,call,call_end,call_merge,call_missed,cancel,cell_tower,chat_bubble,check_circle,chevron_left,chevron_right,close,code,compare_arrows,confirmation_number,dark_mode,dashboard,description,dialpad,error,filter_alt,forum,gavel,graphic_eq,group,headphones,health_and_safety,hearing,help,history,hourglass_bottom,hourglass_empty,hourglass_top,hub,inbox,info,insights,language,light_mode,local_hospital,lock,login,loyalty,mail,mark_email_read,mark_email_unread,menu_book,mic,mic_off,monitoring,more_horiz,notifications,palette,payments,person,person_add,person_off,phone,phone_enabled,phone_in_talk,play_circle,policy,progress_activity,psychology,public,receipt_long,record_voice_over,redeem,remove_circle,repeat,rocket_launch,savings,schedule,search,send,sentiment_satisfied,settings,shield,show_chart,sim_card,sim_card_alert,sim_card_download,smart_toy,smartphone,spatial_audio_off,star,subtitles,support_agent,sync,sync_alt,thermostat,timeline,timer,touch_app,translate,travel_explore,trending_up,verified,visibility,volume_up,warning&display=block" />
        <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=account_balance,account_balance_wallet,add,add_call,ads_click,apartment,architecture,arrow_back,arrow_forward,article,auto_awesome,auto_stories,autorenew,balance,bolt,business_center,call,call_end,call_merge,call_missed,cancel,cell_tower,chat_bubble,check_circle,chevron_left,chevron_right,close,code,compare_arrows,confirmation_number,dark_mode,dashboard,description,dialpad,error,filter_alt,forum,gavel,graphic_eq,group,headphones,health_and_safety,hearing,help,history,hourglass_bottom,hourglass_empty,hourglass_top,hub,inbox,info,insights,language,light_mode,local_hospital,lock,login,loyalty,mail,mark_email_read,mark_email_unread,menu_book,mic,mic_off,monitoring,more_horiz,notifications,palette,payments,person,person_add,person_off,phone,phone_enabled,phone_in_talk,play_circle,policy,progress_activity,psychology,public,receipt_long,record_voice_over,redeem,remove_circle,repeat,rocket_launch,savings,schedule,search,send,sentiment_satisfied,settings,shield,show_chart,sim_card,sim_card_alert,sim_card_download,smart_toy,smartphone,spatial_audio_off,star,subtitles,support_agent,sync,sync_alt,thermostat,timeline,timer,touch_app,translate,travel_explore,trending_up,verified,visibility,volume_up,warning&display=block" /></noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `requestAnimationFrame(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=account_balance,account_balance_wallet,add,add_call,ads_click,apartment,architecture,arrow_back,arrow_forward,article,auto_awesome,auto_stories,autorenew,balance,bolt,business_center,call,call_end,call_merge,call_missed,cancel,cell_tower,chat_bubble,check_circle,chevron_left,chevron_right,close,code,compare_arrows,confirmation_number,dark_mode,dashboard,description,dialpad,error,filter_alt,forum,gavel,graphic_eq,group,headphones,health_and_safety,hearing,help,history,hourglass_bottom,hourglass_empty,hourglass_top,hub,inbox,info,insights,language,light_mode,local_hospital,lock,login,loyalty,mail,mark_email_read,mark_email_unread,menu_book,mic,mic_off,monitoring,more_horiz,notifications,palette,payments,person,person_add,person_off,phone,phone_enabled,phone_in_talk,play_circle,policy,progress_activity,psychology,public,receipt_long,record_voice_over,redeem,remove_circle,repeat,rocket_launch,savings,schedule,search,send,sentiment_satisfied,settings,shield,show_chart,sim_card,sim_card_alert,sim_card_download,smart_toy,smartphone,spatial_audio_off,star,subtitles,support_agent,sync,sync_alt,thermostat,timeline,timer,touch_app,translate,travel_explore,trending_up,verified,visibility,volume_up,warning&display=block';document.head.appendChild(l);});`,
          }}
        />
        <style>{`.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }`}</style>
      </head>
      <body>
        {/* Google Tag Manager (noscript) — must be immediately after <body>. */}
        <noscript dangerouslySetInnerHTML={{ __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MWTVH7RL" height="0" width="0" style="display:none;visibility:hidden"></iframe>` }} />
        {/* End Google Tag Manager (noscript) */}
        {/* Google Ads (gtag.js) — direct tag, kept for now. GA4 is managed
            inside GTM; do NOT add a GA4 gtag here to avoid double-counting.
            If this direct AW tag is removed later, recreate Google Ads
            conversions inside GTM. */}
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
        {/* First-party site analytics — self-gated to public pages */}
        <AnalyticsTracker />
      </body>
    </html>
  );
}
