'use client';
import Link from 'next/link';
import { useState } from 'react';
import AnimatedSection from '@/app/_landing/AnimatedSection';
import FaqAccordion from '@/app/_landing/FaqAccordion';

/* ── Styles ─────────────────────────────────────────────────────────────── */
function TranslatorStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
      .font-headline { font-family: 'Manrope', sans-serif; }
      .glass-panel { background: rgba(26, 32, 44, 0.55); backdrop-filter: blur(24px); border: 0.5px solid rgba(140, 144, 159, 0.12); }
      .gradient-text-translator { background: linear-gradient(135deg, #22d3ee 0%, #818cf8 50%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200% 200%; animation: gradient-shift-t 6s ease infinite; }
      .gradient-text-cyan { background: linear-gradient(135deg, #22d3ee 0%, #67e8f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

      @keyframes gradient-shift-t { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
      @keyframes float-delayed { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2.2); opacity: 0; } }
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes typing-dots { 0%,20% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes slide-up { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
      @keyframes connection-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
      @keyframes lang-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-8px) rotate(2deg); } }
      @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

      .animate-float { animation: float 6s ease-in-out infinite; }
      .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite 1s; }
      .animate-connection { animation: connection-pulse 2s ease-in-out infinite; }
      .animate-lang-float { animation: lang-float 4s ease-in-out infinite; }

      .hero-glow { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }

      .bento-card { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      .bento-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(34,211,238,0.06); }

      .shimmer-border { background: linear-gradient(90deg, transparent, rgba(34,211,238,0.2), rgba(129,140,248,0.2), transparent); background-size: 200% 100%; animation: shimmer 3s ease infinite; }

      .cta-glow-cyan { box-shadow: 0 4px 32px rgba(34,211,238,0.25), 0 0 80px rgba(34,211,238,0.08); transition: all 0.3s ease; }
      .cta-glow-cyan:hover { box-shadow: 0 6px 40px rgba(34,211,238,0.4), 0 0 100px rgba(34,211,238,0.12); transform: translateY(-2px); }

      .step-connector { background: linear-gradient(90deg, #22d3ee, #818cf8, #c084fc); }

      .bubble-in { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .dot1 { animation: typing-dots 1.4s ease infinite 0s; }
      .dot2 { animation: typing-dots 1.4s ease infinite 0.2s; }
      .dot3 { animation: typing-dots 1.4s ease infinite 0.4s; }

      .lang-badge { transition: all 0.3s ease; cursor: default; }
      .lang-badge:hover { transform: scale(1.08); box-shadow: 0 0 20px rgba(34,211,238,0.2); }

      .nav-link { color: rgba(194,198,214,0.7); transition: color 0.2s ease; font-size: 0.875rem; font-weight: 500; }
      .nav-link:hover { color: #22d3ee; }

      @media (prefers-reduced-motion: reduce) {
        .animate-float, .animate-float-delayed, .animate-connection, .animate-lang-float { animation: none; }
        .gradient-text-translator { animation: none; }
      }
    `}</style>
  );
}

/* ── Navbar ──────────────────────────────────────────────────────────────── */
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50" style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(140,144,159,0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)' }}>
              <span className="material-symbols-outlined text-white text-base" style={{ fontSize: '18px' }}>phone_in_talk</span>
            </div>
            <span className="font-headline font-bold text-white text-lg">Caller</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#products" className="nav-link">Products</Link>
            <Link href="/help" className="nav-link">Help Center</Link>
            <Link href="/docs" className="nav-link">Documentation</Link>
          </div>

          {/* CTA */}
          <div className="hidden md:block">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)', boxShadow: '0 2px 16px rgba(34,211,238,0.2)' }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg"
            style={{ color: 'rgba(194,198,214,0.7)' }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-4 space-y-3 border-t" style={{ borderColor: 'rgba(140,144,159,0.08)' }}>
            <Link href="/#products" className="block nav-link py-2" onClick={() => setMenuOpen(false)}>Products</Link>
            <Link href="/help" className="block nav-link py-2" onClick={() => setMenuOpen(false)}>Help Center</Link>
            <Link href="/docs" className="block nav-link py-2" onClick={() => setMenuOpen(false)}>Documentation</Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white mt-2"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)' }}
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

/* ── Hero Visual ─────────────────────────────────────────────────────────── */
function HeroVisual() {
  const langLabels = [
    { label: 'EN', top: '8%', left: '12%', delay: '0s' },
    { label: 'ES', top: '15%', right: '10%', delay: '0.5s' },
    { label: 'ZH', top: '70%', left: '8%', delay: '1s' },
    { label: 'FR', top: '75%', right: '12%', delay: '1.5s' },
    { label: 'DE', top: '40%', left: '3%', delay: '0.8s' },
    { label: 'JA', top: '35%', right: '3%', delay: '1.2s' },
  ];

  return (
    <div className="relative w-full max-w-lg mx-auto h-72 md:h-96 select-none">
      {/* Floating language labels */}
      {langLabels.map((l) => (
        <div
          key={l.label}
          className="absolute animate-lang-float glass-panel rounded-xl px-3 py-1.5 text-xs font-bold"
          style={{
            top: l.top,
            left: l.left,
            right: l.right,
            animationDelay: l.delay,
            color: '#22d3ee',
            border: '1px solid rgba(34,211,238,0.2)',
            zIndex: 10,
          }}
        >
          {l.label}
        </div>
      ))}

      {/* Phone A */}
      <div
        className="animate-float absolute left-0 top-4 w-28 md:w-36 rounded-3xl p-2"
        style={{ background: 'rgba(26,32,44,0.8)', border: '1px solid rgba(34,211,238,0.25)', boxShadow: '0 0 40px rgba(34,211,238,0.1)' }}
      >
        <div className="rounded-2xl p-3" style={{ background: 'rgba(14,19,31,0.9)' }}>
          <div className="w-6 h-1 rounded-full mx-auto mb-3" style={{ background: 'rgba(140,144,159,0.3)' }} />
          <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)' }}>
            <span className="material-symbols-outlined text-white text-lg">person</span>
          </div>
          <div className="text-center text-xs font-semibold text-white mb-1">Maria</div>
          <div className="text-center" style={{ fontSize: '10px', color: 'rgba(194,198,214,0.5)' }}>Speaking ES</div>
          <div className="mt-3 space-y-1">
            <div className="h-1.5 rounded-full" style={{ background: 'rgba(34,211,238,0.4)', width: '80%' }} />
            <div className="h-1.5 rounded-full" style={{ background: 'rgba(34,211,238,0.25)', width: '60%' }} />
            <div className="h-1.5 rounded-full" style={{ background: 'rgba(34,211,238,0.15)', width: '70%' }} />
          </div>
          <div className="mt-3 flex justify-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#22d3ee' }}>mic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center translator orb */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center" style={{ zIndex: 20 }}>
        {/* Pulse rings */}
        <div className="absolute w-24 h-24 rounded-full" style={{ background: 'rgba(129,140,248,0.08)', animation: 'pulse-ring 2s ease-out infinite' }} />
        <div className="absolute w-24 h-24 rounded-full" style={{ background: 'rgba(34,211,238,0.06)', animation: 'pulse-ring 2s ease-out infinite 0.7s' }} />
        {/* Orb */}
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.3), rgba(129,140,248,0.3), rgba(192,132,252,0.3))', border: '1px solid rgba(129,140,248,0.4)', boxShadow: '0 0 60px rgba(129,140,248,0.3), inset 0 0 30px rgba(34,211,238,0.1)' }}>
          <span className="material-symbols-outlined text-2xl md:text-3xl" style={{ color: '#818cf8' }}>translate</span>
        </div>
        {/* Connection lines */}
        <div className="absolute" style={{ width: '90px', height: '2px', right: '100%', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.6))', animation: 'connection-pulse 2s ease-in-out infinite' }} />
        <div className="absolute" style={{ width: '90px', height: '2px', left: '100%', background: 'linear-gradient(90deg, rgba(192,132,252,0.6), transparent)', animation: 'connection-pulse 2s ease-in-out infinite 1s' }} />
      </div>

      {/* Phone B */}
      <div
        className="animate-float-delayed absolute right-0 top-4 w-28 md:w-36 rounded-3xl p-2"
        style={{ background: 'rgba(26,32,44,0.8)', border: '1px solid rgba(192,132,252,0.25)', boxShadow: '0 0 40px rgba(192,132,252,0.1)' }}
      >
        <div className="rounded-2xl p-3" style={{ background: 'rgba(14,19,31,0.9)' }}>
          <div className="w-6 h-1 rounded-full mx-auto mb-3" style={{ background: 'rgba(140,144,159,0.3)' }} />
          <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)' }}>
            <span className="material-symbols-outlined text-white text-lg">person</span>
          </div>
          <div className="text-center text-xs font-semibold text-white mb-1">John</div>
          <div className="text-center" style={{ fontSize: '10px', color: 'rgba(194,198,214,0.5)' }}>Hearing EN</div>
          <div className="mt-3 space-y-1">
            <div className="h-1.5 rounded-full ml-auto" style={{ background: 'rgba(192,132,252,0.4)', width: '80%' }} />
            <div className="h-1.5 rounded-full ml-auto" style={{ background: 'rgba(192,132,252,0.25)', width: '65%' }} />
            <div className="h-1.5 rounded-full ml-auto" style={{ background: 'rgba(192,132,252,0.15)', width: '50%' }} />
          </div>
          <div className="mt-3 flex justify-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.3)' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#c084fc' }}>headphones</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Translation Demo ────────────────────────────────────────────────────── */
function TranslationDemo() {
  return (
    <div className="w-full max-w-md mx-auto glass-panel rounded-3xl p-4 md:p-6" style={{ boxShadow: '0 20px 80px rgba(0,0,0,0.4)' }}>
      {/* Phone header */}
      <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid rgba(140,144,159,0.1)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)' }}>
          <span className="material-symbols-outlined text-white text-base">translate</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Live Translator</div>
          <div className="text-xs flex items-center gap-1.5" style={{ color: '#4ade80' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            Active · ES ↔ EN
          </div>
        </div>
        <div className="ml-auto text-xs font-mono" style={{ color: 'rgba(194,198,214,0.4)' }}>02:14</div>
      </div>

      {/* Speech bubbles */}
      <div className="space-y-4">
        {/* Incoming Spanish */}
        <div className="bubble-in" style={{ animationDelay: '0.1s' }}>
          <div className="text-xs mb-1.5 font-medium" style={{ color: '#22d3ee' }}>Maria · ES</div>
          <div className="inline-block rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-xs" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.15)', color: '#e2e8f0' }}>
            Hola, me gustaría confirmar mi reserva para mañana.
          </div>
        </div>

        {/* Translation */}
        <div className="bubble-in pl-4" style={{ animationDelay: '0.3s' }}>
          <div className="text-xs mb-1.5 font-medium" style={{ color: 'rgba(194,198,214,0.4)' }}>Translated · EN</div>
          <div className="inline-flex items-start gap-2 rounded-2xl px-4 py-3 text-sm max-w-xs" style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.15)', color: '#e2e8f0' }}>
            <span className="material-symbols-outlined text-sm mt-0.5 shrink-0" style={{ color: '#818cf8' }}>translate</span>
            Hello, I would like to confirm my reservation for tomorrow.
          </div>
        </div>

        {/* Outgoing English */}
        <div className="bubble-in flex flex-col items-end" style={{ animationDelay: '0.6s' }}>
          <div className="text-xs mb-1.5 font-medium" style={{ color: '#c084fc' }}>John · EN</div>
          <div className="inline-block rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-xs text-right" style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.15)', color: '#e2e8f0' }}>
            Of course! Your reservation is confirmed for 7 PM.
          </div>
        </div>

        {/* Typing indicator */}
        <div className="bubble-in" style={{ animationDelay: '0.9s' }}>
          <div className="text-xs mb-1.5 font-medium" style={{ color: 'rgba(194,198,214,0.4)' }}>Translating…</div>
          <div className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-3" style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.1)' }}>
            <span className="w-2 h-2 rounded-full dot1" style={{ background: '#818cf8' }} />
            <span className="w-2 h-2 rounded-full dot2" style={{ background: '#818cf8' }} />
            <span className="w-2 h-2 rounded-full dot3" style={{ background: '#818cf8' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Language Pairs Grid ─────────────────────────────────────────────────── */
function LanguagePairsGrid() {
  const pairs = [
    'EN ↔ ES', 'EN ↔ FR', 'EN ↔ DE', 'EN ↔ ZH', 'EN ↔ JA',
    'EN ↔ KO', 'EN ↔ AR', 'EN ↔ RU', 'EN ↔ PT', 'EN ↔ IT',
    'EN ↔ HI', 'EN ↔ TR', 'EN ↔ PL', 'EN ↔ NL', 'ES ↔ FR',
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {pairs.map((pair, i) => (
        <div
          key={pair}
          className="lang-badge glass-panel px-3 py-1.5 rounded-xl text-xs font-mono font-semibold"
          style={{
            color: i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#818cf8' : '#c084fc',
            border: `1px solid ${i % 3 === 0 ? 'rgba(34,211,238,0.2)' : i % 3 === 1 ? 'rgba(129,140,248,0.2)' : 'rgba(192,132,252,0.2)'}`,
          }}
        >
          {pair}
        </div>
      ))}
      <div
        className="lang-badge px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
        style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(192,132,252,0.15))', border: '1px solid rgba(34,211,238,0.25)', color: '#22d3ee' }}
      >
        <span className="material-symbols-outlined text-sm">auto_awesome</span>
        Auto-detect
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function TranslatorPageClient() {
  const faqItems = [
    {
      q: 'How does the translator join my call?',
      a: 'Simply merge our translator number into your active call. It joins within seconds, introduces itself briefly, and begins translating both sides of the conversation in real-time.',
    },
    {
      q: 'What languages are supported?',
      a: 'We support 15+ language pairs including English, Spanish, French, German, Chinese, Japanese, Korean, Arabic, Russian, Portuguese, Italian, and more. Auto-detection is available so you don\'t need to specify the language upfront.',
    },
    {
      q: 'Can I use it on inbound calls too?',
      a: 'Yes! Whether you\'re making a call or receiving one, you can merge the translator at any point during the conversation. It works seamlessly for both directions.',
    },
    {
      q: 'Do I need to install any app?',
      a: 'No apps needed. The translator works with any phone — landline, mobile, or VoIP. Just merge the number into your call and the translator handles everything.',
    },
    {
      q: 'How does the Telegram integration work?',
      a: 'Connect your Telegram account in settings. After each translated call, you\'ll receive a call summary and a link to the live transcript directly in Telegram — perfect for keeping records.',
    },
    {
      q: 'What voices are available?',
      a: 'Choose from premium AI voices by xAI (Grok TTS), OpenAI, and ElevenLabs. Each provider offers multiple voice options with different characteristics to match your preferred tone.',
    },
  ];

  const features = [
    {
      icon: 'language',
      title: '15+ Languages',
      desc: 'English, Spanish, French, German, Chinese, Japanese, Korean, Arabic, Russian, Portuguese, Italian, and more.',
      accent: '#22d3ee',
      accentBg: 'rgba(34,211,238,0.08)',
      accentBorder: 'rgba(34,211,238,0.15)',
    },
    {
      icon: 'record_voice_over',
      title: '6 Tones of Voice',
      desc: 'Professional, Friendly, Casual, Formal, Medical, Legal — choose the right tone for every situation.',
      accent: '#818cf8',
      accentBg: 'rgba(129,140,248,0.08)',
      accentBorder: 'rgba(129,140,248,0.15)',
    },
    {
      icon: 'spatial_audio_off',
      title: 'Premium AI Voices',
      desc: 'Choose from xAI, OpenAI, and ElevenLabs voice engines for natural-sounding, human-like translation.',
      accent: '#c084fc',
      accentBg: 'rgba(192,132,252,0.08)',
      accentBorder: 'rgba(192,132,252,0.15)',
    },
    {
      icon: 'send',
      title: 'Telegram Integration',
      desc: 'Get call summaries and live translation links delivered straight to your Telegram after every call.',
      accent: '#22d3ee',
      accentBg: 'rgba(34,211,238,0.08)',
      accentBorder: 'rgba(34,211,238,0.15)',
    },
    {
      icon: 'subtitles',
      title: 'Live Transcript',
      desc: 'Watch the translated conversation unfold in real-time via a shareable web link — visible to anyone.',
      accent: '#818cf8',
      accentBg: 'rgba(129,140,248,0.08)',
      accentBorder: 'rgba(129,140,248,0.15)',
    },
    {
      icon: 'phone_enabled',
      title: 'Any Phone, No Apps',
      desc: 'Works with any phone number — landline, mobile, or VoIP. No downloads, no special equipment.',
      accent: '#c084fc',
      accentBg: 'rgba(192,132,252,0.08)',
      accentBorder: 'rgba(192,132,252,0.15)',
    },
  ];

  const steps = [
    {
      number: '01',
      icon: 'call',
      title: 'Make or receive a call',
      desc: 'Call anyone or receive a call as usual on any phone — mobile, landline, or VoIP. Nothing special required.',
      accent: '#22d3ee',
    },
    {
      number: '02',
      icon: 'call_merge',
      title: 'Merge the translator',
      desc: 'Add our translator number to the call. It joins in seconds, introduces itself, and is ready to translate.',
      accent: '#818cf8',
    },
    {
      number: '03',
      icon: 'translate',
      title: 'Speak freely',
      desc: 'Talk naturally in your language. The AI translator handles both directions in real-time, so everyone understands.',
      accent: '#c084fc',
    },
  ];

  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      <TranslatorStyles />

      {/* Material Symbols font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        rel="stylesheet"
      />

      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
        {/* Background glows */}
        <div className="hero-glow" style={{ top: '-10%', left: '10%', width: '700px', height: '700px', background: 'rgba(34,211,238,0.05)' }} />
        <div className="hero-glow" style={{ top: '5%', right: '5%', width: '600px', height: '600px', background: 'rgba(192,132,252,0.05)' }} />
        <div className="hero-glow" style={{ bottom: '-10%', left: '40%', width: '500px', height: '500px', background: 'rgba(129,140,248,0.06)' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: `linear-gradient(rgba(34,211,238,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.4) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <AnimatedSection animation="fade-up">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee' }}>
                <span className="material-symbols-outlined text-sm">translate</span>
                Live Translation · 15+ Languages
              </div>
            </div>
          </AnimatedSection>

          {/* Headline */}
          <AnimatedSection animation="fade-up" delay={100}>
            <h1 className="font-headline text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6" style={{ color: '#f1f5ff' }}>
              Merge a Live Translator<br />
              <span className="gradient-text-translator">into Any Call</span>
            </h1>
          </AnimatedSection>

          {/* Subtitle */}
          <AnimatedSection animation="fade-up" delay={200}>
            <p className="text-center text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: 'rgba(194,198,214,0.75)' }}>
              No apps. No special equipment. Just merge our AI translator into your active call and both sides
              hear each other in their own language — instantly.
            </p>
          </AnimatedSection>

          {/* CTAs */}
          <AnimatedSection animation="fade-up" delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/auth/signup"
                className="cta-glow-cyan inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8, #c084fc)' }}
              >
                <span className="material-symbols-outlined text-xl">phone_in_talk</span>
                Start Translating
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-semibold transition-all glass-panel"
                style={{ color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}
              >
                <span className="material-symbols-outlined text-xl">play_circle</span>
                See How It Works
              </a>
            </div>
          </AnimatedSection>

          {/* Hero visual */}
          <AnimatedSection animation="scale-in" delay={400}>
            <HeroVisual />
          </AnimatedSection>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#22d3ee' }}>Simple by design</p>
              <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-extrabold" style={{ color: '#f1f5ff' }}>
                How It Works
              </h2>
              <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color: 'rgba(194,198,214,0.65)' }}>
                Three steps to breaking the language barrier on any phone call.
              </p>
            </div>
          </AnimatedSection>

          <div className="relative">
            {/* Connector line — desktop */}
            <div className="hidden md:block absolute top-12 left-1/2 -translate-x-1/2 w-2/3 h-px step-connector opacity-20" style={{ zIndex: 0 }} />

            <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative" style={{ zIndex: 1 }}>
              {steps.map((step, i) => (
                <AnimatedSection key={step.number} animation="fade-up" delay={i * 120}>
                  <div className="flex flex-col items-center text-center">
                    {/* Icon circle */}
                    <div className="relative mb-6">
                      <div className="w-24 h-24 rounded-full flex items-center justify-center"
                        style={{ background: `rgba(${step.accent === '#22d3ee' ? '34,211,238' : step.accent === '#818cf8' ? '129,140,248' : '192,132,252'},0.1)`, border: `1.5px solid ${step.accent}33` }}>
                        <span className="material-symbols-outlined text-4xl" style={{ color: step.accent }}>{step.icon}</span>
                      </div>
                      {/* Step number badge */}
                      <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${step.accent}, #818cf8)` }}>
                        {i + 1}
                      </div>
                    </div>
                    <h3 className="font-headline text-xl font-bold mb-3" style={{ color: '#f1f5ff' }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(194,198,214,0.65)' }}>{step.desc}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#818cf8' }}>Built for real conversations</p>
              <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-extrabold" style={{ color: '#f1f5ff' }}>
                Everything You Need
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {features.map((f, i) => (
              <AnimatedSection key={f.title} animation="fade-up" delay={i * 80}>
                <div
                  className="bento-card glass-panel rounded-2xl p-6 h-full"
                  style={{ border: `1px solid ${f.accentBorder}`, background: f.accentBg }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `linear-gradient(135deg, ${f.accent}22, ${f.accent}11)`, border: `1px solid ${f.accentBorder}` }}>
                    <span className="material-symbols-outlined text-2xl" style={{ color: f.accent }}>{f.icon}</span>
                  </div>
                  <h3 className="font-headline text-lg font-bold mb-2" style={{ color: '#f1f5ff' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(194,198,214,0.65)' }}>{f.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Translation Demo ─────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <AnimatedSection animation="fade-right">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#22d3ee' }}>Real-time magic</p>
                <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6" style={{ color: '#f1f5ff' }}>
                  How Translation{' '}
                  <span className="gradient-text-translator">Feels</span>
                </h2>
                <p className="text-lg leading-relaxed mb-8" style={{ color: 'rgba(194,198,214,0.7)' }}>
                  Each speaker talks in their own language. The AI translator instantly renders the other side in theirs.
                  No delays, no awkward pauses — just natural conversation.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: 'bolt', text: 'Sub-second translation latency', color: '#22d3ee' },
                    { icon: 'hearing', text: 'Natural AI voices, not robotic', color: '#818cf8' },
                    { icon: 'autorenew', text: 'Bidirectional, both sides translated', color: '#c084fc' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
                        <span className="material-symbols-outlined text-base" style={{ color: item.color }}>{item.icon}</span>
                      </div>
                      <span className="text-sm font-medium" style={{ color: '#dde2f3' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection animation="fade-left" delay={150}>
              <TranslationDemo />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Language Pairs ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#c084fc' }}>Broad coverage</p>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold mb-4" style={{ color: '#f1f5ff' }}>
                15+ Language Pairs
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(194,198,214,0.65)' }}>
                From common to specialized, we cover the languages your business needs most.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="scale-in" delay={100}>
            <LanguagePairsGrid />
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={200}>
            <p className="text-center text-sm mt-8" style={{ color: 'rgba(194,198,214,0.4)' }}>
              More language pairs added regularly. Contact us if you need a specific pair.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Tones Showcase ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <AnimatedSection animation="fade-right">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { tone: 'Professional', icon: 'business_center', desc: 'Polished, precise language for business calls', color: '#22d3ee' },
                  { tone: 'Friendly', icon: 'sentiment_satisfied', desc: 'Warm and approachable for client relations', color: '#818cf8' },
                  { tone: 'Casual', icon: 'chat_bubble', desc: 'Relaxed and natural for everyday conversations', color: '#c084fc' },
                  { tone: 'Formal', icon: 'gavel', desc: 'Proper and structured for official contexts', color: '#22d3ee' },
                  { tone: 'Medical', icon: 'local_hospital', desc: 'Clinical accuracy for healthcare conversations', color: '#818cf8' },
                  { tone: 'Legal', icon: 'balance', desc: 'Precise terminology for legal discussions', color: '#c084fc' },
                ].map((item, i) => (
                  <div
                    key={item.tone}
                    className="bento-card glass-panel rounded-2xl p-4 flex flex-col items-center text-center gap-2"
                    style={{ border: `1px solid ${item.color}20` }}
                  >
                    <span className="material-symbols-outlined text-2xl mb-1" style={{ color: item.color }}>{item.icon}</span>
                    <div className="text-sm font-bold" style={{ color: '#f1f5ff' }}>{item.tone}</div>
                    <div className="text-xs leading-snug" style={{ color: 'rgba(194,198,214,0.5)' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </AnimatedSection>

            <AnimatedSection animation="fade-left" delay={100}>
              <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#818cf8' }}>Context matters</p>
              <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6" style={{ color: '#f1f5ff' }}>
                Six Tones for Every{' '}
                <span className="gradient-text-translator">Situation</span>
              </h2>
              <p className="text-lg leading-relaxed mb-6" style={{ color: 'rgba(194,198,214,0.7)' }}>
                Translation isn't just about words — it's about tone. Pick the right voice for every context,
                from board meetings to hospital consultations.
              </p>
              <p className="text-sm" style={{ color: 'rgba(194,198,214,0.45)' }}>
                Switch tones between calls, or set a default for your workspace.
              </p>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Pricing CTA ──────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="scale-in">
            <div
              className="rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
              style={{ background: 'rgba(26,32,44,0.6)', border: '1px solid rgba(34,211,238,0.12)', backdropFilter: 'blur(24px)' }}
            >
              {/* Glow */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.07) 0%, transparent 60%)' }} />
              {/* Shimmer top border */}
              <div className="absolute top-0 left-0 right-0 h-px shimmer-border" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee' }}>
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Pay As You Go · No Subscription
                </div>

                <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4" style={{ color: '#f1f5ff' }}>
                  Only Pay for What You Use
                </h2>
                <p className="text-lg mb-4 max-w-xl mx-auto" style={{ color: 'rgba(194,198,214,0.7)' }}>
                  Top up your deposit and use minutes when you need them. No commitments, no wasted fees.
                </p>
                <div className="text-4xl font-headline font-extrabold mb-2 gradient-text-translator">
                  From $0.15<span className="text-2xl">/min</span>
                </div>
                <p className="text-sm mb-10" style={{ color: 'rgba(194,198,214,0.4)' }}>Pricing varies by language pair and voice engine</p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/auth/signup"
                    className="cta-glow-cyan inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8, #c084fc)' }}
                  >
                    <span className="material-symbols-outlined text-xl">rocket_launch</span>
                    Get Started Free
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold glass-panel transition-all"
                    style={{ color: 'rgba(194,198,214,0.8)', border: '1px solid rgba(140,144,159,0.15)' }}
                  >
                    View full pricing
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-12">
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold mb-4" style={{ color: '#f1f5ff' }}>
                Frequently Asked Questions
              </h2>
              <p className="text-lg" style={{ color: 'rgba(194,198,214,0.55)' }}>
                Everything you need to know about Live Translator.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={100}>
            <FaqAccordion items={faqItems} />
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={200}>
            <p className="text-center text-sm mt-10" style={{ color: 'rgba(194,198,214,0.4)' }}>
              Still have questions?{' '}
              <Link href="/help" className="underline" style={{ color: '#22d3ee' }}>
                Visit the Help Center
              </Link>
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="hero-glow" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '400px', background: 'rgba(34,211,238,0.05)' }} />
        <div className="hero-glow" style={{ top: '30%', right: '10%', width: '500px', height: '500px', background: 'rgba(192,132,252,0.04)' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="scale-in">
            <h2 className="font-headline text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ color: '#f1f5ff' }}>
              Try Your First{' '}
              <span className="gradient-text-translator">Translated Call</span>
            </h2>
            <p className="text-xl mb-10 max-w-xl mx-auto" style={{ color: 'rgba(194,198,214,0.65)' }}>
              No setup, no subscriptions. Just add minutes and start breaking language barriers on any call.
            </p>
            <Link
              href="/auth/signup"
              className="cta-glow-cyan inline-flex items-center gap-3 px-10 py-5 rounded-2xl text-lg font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8, #c084fc)' }}
            >
              <span className="material-symbols-outlined text-2xl">phone_in_talk</span>
              Start Translating Now
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(140,144,159,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)' }}>
                  <span className="material-symbols-outlined text-white text-base" style={{ fontSize: '18px' }}>phone_in_talk</span>
                </div>
                <span className="font-headline font-bold text-white text-lg">Caller</span>
              </Link>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(194,198,214,0.45)' }}>
                AI phone agents and live translation for modern businesses.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(194,198,214,0.35)' }}>Product</h4>
              <ul className="space-y-3">
                {[
                  { label: 'AI Phone Agents', href: '/#products' },
                  { label: 'Live Translator', href: '/translator' },
                  { label: 'Pricing', href: '/pricing' },
                  { label: 'Dashboard', href: '/dashboard' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm transition-colors" style={{ color: 'rgba(194,198,214,0.55)' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#22d3ee')}
                      onMouseOut={e => (e.currentTarget.style.color = 'rgba(194,198,214,0.55)')}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(194,198,214,0.35)' }}>Resources</h4>
              <ul className="space-y-3">
                {[
                  { label: 'Documentation', href: '/docs' },
                  { label: 'Help Center', href: '/help' },
                  { label: 'API Reference', href: '/docs/api' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm transition-colors" style={{ color: 'rgba(194,198,214,0.55)' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#22d3ee')}
                      onMouseOut={e => (e.currentTarget.style.color = 'rgba(194,198,214,0.55)')}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(194,198,214,0.35)' }}>Legal</h4>
              <ul className="space-y-3">
                {[
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                  { label: 'Acceptable Use', href: '/acceptable-use' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm transition-colors" style={{ color: 'rgba(194,198,214,0.55)' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#22d3ee')}
                      onMouseOut={e => (e.currentTarget.style.color = 'rgba(194,198,214,0.55)')}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: '1px solid rgba(140,144,159,0.07)' }}>
            <p className="text-xs" style={{ color: 'rgba(194,198,214,0.3)' }}>
              © {new Date().getFullYear()} Caller. All rights reserved.
            </p>
            <p className="text-xs" style={{ color: 'rgba(194,198,214,0.25)' }}>
              Built with AI · Powered by xAI, OpenAI, ElevenLabs
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
