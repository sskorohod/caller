'use client';
import Link from 'next/link';
import { useState } from 'react';
import AnimatedSection from './AnimatedSection';
import AnimatedCounter from './AnimatedCounter';
import FaqAccordion from './FaqAccordion';

/* ── Inline styles tag ───────────────────────────────────────────────── */
function LandingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
      .font-headline { font-family: 'Manrope', sans-serif; }
      .glass-panel { background: rgba(26, 32, 44, 0.55); backdrop-filter: blur(24px); border: 0.5px solid rgba(140, 144, 159, 0.12); }

      .gradient-text { background: linear-gradient(135deg, #adc6ff 0%, #818cf8 50%, #d0bcff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200% 200%; animation: gradient-shift 6s ease infinite; }
      .gradient-text-green { background: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .gradient-text-amber { background: linear-gradient(135deg, #fbbf24 0%, #fb923c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

      @keyframes gradient-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
      @keyframes float-slow { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(3deg); } }
      @keyframes float-delayed { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(2.5); opacity: 0; } }
      @keyframes pulse-glow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      @keyframes orbit { 0% { transform: rotate(0deg) translateX(120px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(120px) rotate(-360deg); } }
      @keyframes orbit-reverse { 0% { transform: rotate(0deg) translateX(90px) rotate(0deg); } 100% { transform: rotate(-360deg) translateX(90px) rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      @keyframes wave-flow { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

      .animate-float { animation: float 6s ease-in-out infinite; }
      .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
      .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite 1s; }
      .animate-orbit { animation: orbit 20s linear infinite; }
      .animate-orbit-reverse { animation: orbit-reverse 15s linear infinite; }

      .hero-glow { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }

      .bento-card { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      .bento-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(173,198,255,0.05); }

      .shimmer-border { background: linear-gradient(90deg, transparent, rgba(173,198,255,0.15), transparent); background-size: 200% 100%; animation: shimmer 3s ease infinite; }

      .cta-glow { box-shadow: 0 4px 32px rgba(77,142,255,0.3), 0 0 80px rgba(77,142,255,0.1); transition: all 0.3s ease; }
      .cta-glow:hover { box-shadow: 0 6px 40px rgba(77,142,255,0.45), 0 0 100px rgba(77,142,255,0.15); transform: translateY(-2px); }

      @media (prefers-reduced-motion: reduce) {
        .animate-float, .animate-float-slow, .animate-float-delayed, .animate-orbit, .animate-orbit-reverse { animation: none; }
        .gradient-text { animation: none; }
      }
    `}</style>
  );
}

/* ── Orb component for hero background ───────────────────────────────── */
function HeroOrbs() {
  return (
    <>
      <div className="hero-glow" style={{ top: '-10%', left: '15%', width: '600px', height: '600px', background: 'rgba(99,102,241,0.08)' }} />
      <div className="hero-glow" style={{ top: '10%', right: '10%', width: '500px', height: '500px', background: 'rgba(139,92,246,0.06)' }} />
      <div className="hero-glow animate-float-slow" style={{ bottom: '0', left: '40%', width: '400px', height: '400px', background: 'rgba(34,211,238,0.04)' }} />
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(173,198,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(173,198,255,0.3) 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
      }} />
    </>
  );
}

/* ── Phone illustration for hero ─────────────────────────────────────── */
function HeroVisual() {
  return (
    <div className="relative w-full max-w-5xl mx-auto mt-16 md:mt-20">
      {/* Orbiting elements */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="animate-orbit">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)', backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#4ade80' }}>mic</span>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="animate-orbit-reverse">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(173,198,255,0.12)', border: '1px solid rgba(173,198,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#adc6ff' }}>translate</span>
          </div>
        </div>
      </div>

      {/* Main dashboard mockup */}
      <div className="glass-panel rounded-2xl md:rounded-3xl p-1 md:p-1.5 relative" style={{ boxShadow: '0 32px 100px rgba(0,0,0,0.5), 0 0 60px rgba(99,102,241,0.08)' }}>
        {/* Shimmer top border */}
        <div className="absolute top-0 left-0 right-0 h-px shimmer-border" />

        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-t-xl md:rounded-t-2xl" style={{ background: 'rgba(14,19,31,0.9)' }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full" style={{ background: '#febc2e' }} />
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <div className="flex-1 mx-4 py-1 px-3 rounded-md text-[9px] md:text-[10px] font-mono text-center" style={{ background: 'rgba(255,255,255,0.04)', color: '#c2c6d6' }}>
            caller.n8nskorx.top/dashboard
          </div>
        </div>

        {/* Dashboard content */}
        <div className="rounded-b-xl md:rounded-b-2xl overflow-hidden" style={{ background: '#111318' }}>
          <div className="flex">
            {/* Sidebar */}
            <div className="hidden md:block w-44 p-3 space-y-0.5" style={{ background: '#0a0e16', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              {[
                { label: 'Dashboard', icon: 'dashboard', active: true },
                { label: 'Calls', icon: 'call', active: false },
                { label: 'Agents', icon: 'smart_toy', active: false },
                { label: 'Translator', icon: 'translate', active: false },
                { label: 'Knowledge', icon: 'auto_stories', active: false },
                { label: 'Settings', icon: 'settings', active: false },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium"
                  style={item.active ? { background: 'rgba(173,198,255,0.08)', color: '#adc6ff' } : { color: 'rgba(194,198,214,0.35)' }}>
                  <span className="material-symbols-outlined text-sm">{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 md:p-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
                {[
                  { label: 'Total Calls', value: '1,247', change: '+12%', icon: 'call', color: '#adc6ff', glow: 'rgba(173,198,255,0.06)' },
                  { label: 'Active Now', value: '3', change: 'live', icon: 'sensors', color: '#4ade80', glow: 'rgba(74,222,128,0.06)' },
                  { label: 'Success Rate', value: '94%', change: '+3%', icon: 'check_circle', color: '#818cf8', glow: 'rgba(129,140,248,0.06)' },
                  { label: 'Cost (30d)', value: '$142', change: '-8%', icon: 'savings', color: '#fbbf24', glow: 'rgba(251,191,36,0.06)' },
                ].map(kpi => (
                  <div key={kpi.label} className="p-3 rounded-xl relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full" style={{ background: kpi.glow, filter: 'blur(20px)' }} />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] md:text-[9px] uppercase tracking-wider font-medium" style={{ color: 'rgba(194,198,214,0.4)' }}>{kpi.label}</span>
                        <span className="material-symbols-outlined text-xs md:text-sm" style={{ color: kpi.color, opacity: 0.6 }}>{kpi.icon}</span>
                      </div>
                      <div className="text-base md:text-lg font-headline font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                      <div className="text-[8px] font-medium mt-0.5" style={{ color: kpi.change === 'live' ? '#4ade80' : kpi.change.startsWith('+') ? '#4ade80' : '#22d3ee' }}>
                        {kpi.change === 'live' ? (
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} /> Live</span>
                        ) : kpi.change}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart + Recent calls */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="text-[9px] uppercase tracking-wider font-medium mb-3" style={{ color: 'rgba(194,198,214,0.4)' }}>Calls This Week</div>
                  <div className="flex items-end gap-1.5 h-20 md:h-24">
                    {[35, 52, 41, 68, 55, 78, 62].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t transition-all" style={{
                        height: `${h}%`,
                        background: i === 5 ? 'linear-gradient(to top, #4d8eff, #adc6ff)' : 'rgba(173,198,255,0.12)',
                        boxShadow: i === 5 ? '0 0 12px rgba(77,142,255,0.3)' : 'none',
                      }} />
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="text-[9px] uppercase tracking-wider font-medium mb-3" style={{ color: 'rgba(194,198,214,0.4)' }}>Recent</div>
                  <div className="space-y-2">
                    {[
                      { phone: '+1 (818) 277-****', status: 'completed', dur: '2:34' },
                      { phone: '+1 (415) 923-****', status: 'completed', dur: '1:12' },
                      { phone: '+1 (212) 555-****', status: 'in_progress', dur: 'live' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{
                          background: c.status === 'in_progress' ? 'rgba(99,102,241,0.15)' : 'rgba(74,222,128,0.15)',
                        }}>
                          <span className="material-symbols-outlined text-[10px]" style={{
                            color: c.status === 'in_progress' ? '#818cf8' : '#4ade80',
                          }}>call</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium truncate">{c.phone}</div>
                        </div>
                        <span className="text-[9px] tabular-nums" style={{ color: c.dur === 'live' ? '#818cf8' : 'rgba(194,198,214,0.4)' }}>{c.dur}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges around dashboard */}
      <div className="absolute -top-4 -right-2 md:-right-8 animate-float hidden sm:block">
        <div className="glass-panel rounded-xl px-3 py-2 flex items-center gap-2" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.15)' }}>
            <span className="material-symbols-outlined text-xs" style={{ color: '#4ade80' }}>check</span>
          </div>
          <span className="text-[10px] font-semibold">Call completed</span>
        </div>
      </div>
      <div className="absolute -bottom-2 -left-2 md:-left-6 animate-float-delayed hidden sm:block">
        <div className="glass-panel rounded-xl px-3 py-2 flex items-center gap-2" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(173,198,255,0.15)' }}>
            <span className="material-symbols-outlined text-xs" style={{ color: '#adc6ff' }}>translate</span>
          </div>
          <span className="text-[10px] font-semibold">EN ↔ ES translating...</span>
        </div>
      </div>
    </div>
  );
}

/* ── Scrolling logos ─────────────────────────────────────────────────── */
function LogoStrip() {
  const logos = ['Twilio', 'Anthropic', 'OpenAI', 'xAI', 'Deepgram', 'ElevenLabs', 'Twilio', 'Anthropic', 'OpenAI', 'xAI', 'Deepgram', 'ElevenLabs'];
  return (
    <div className="overflow-hidden relative py-6" style={{ maskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 15%, black 85%, transparent)' }}>
      <div className="flex gap-12 items-center whitespace-nowrap" style={{ animation: 'marquee 30s linear infinite' }}>
        {logos.map((name, i) => (
          <span key={i} className="font-headline font-bold text-sm md:text-base opacity-30 hover:opacity-60 transition-opacity cursor-default select-none">{name}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Waveform animation ──────────────────────────────────────────────── */
function WaveformBars({ color = '#adc6ff', count = 24 }: { color?: string; count?: number }) {
  return (
    <div className="flex items-center gap-[2px] h-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full"
          style={{
            height: `${20 + Math.sin(i * 0.8) * 60 + Math.random() * 20}%`,
            background: color,
            opacity: 0.4 + Math.sin(i * 0.5) * 0.3,
            animation: `float ${2 + (i % 3) * 0.5}s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── MAIN LANDING COMPONENT ──────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════ */

export default function LandingClient() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <LandingStyles />

      {/* ═══ Navigation ═══════════════════════════════════════════════ */}
      <header className="fixed top-0 w-full z-50" style={{ background: 'rgba(14, 19, 31, 0.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(221,226,243,0.06)' }}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)' }}>
              <span className="material-symbols-outlined text-base" style={{ color: '#fff', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="text-lg font-headline font-extrabold tracking-tight">Caller</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {[
              { label: 'Products', href: '#products' },
              { label: 'How it Works', href: '#how-it-works' },
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'FAQ', href: '#faq' },
            ].map(l => (
              <a key={l.label} href={l.href} className="transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-sm font-medium transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>Log in</Link>
            <Link href="/login?mode=register" className="px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 cta-glow hidden sm:inline-flex"
              style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
              Get Started
            </Link>
            {/* Mobile hamburger */}
            <button className="md:hidden w-10 h-10 flex items-center justify-center" onClick={() => setMobileNav(!mobileNav)}>
              <span className="material-symbols-outlined">{mobileNav ? 'close' : 'menu'}</span>
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        {mobileNav && (
          <div className="md:hidden px-4 pb-4 space-y-1" style={{ background: 'rgba(14, 19, 31, 0.95)', backdropFilter: 'blur(24px)' }}>
            {['Products', 'How it Works', 'Features', 'Pricing', 'FAQ'].map(label => (
              <a key={label} href={label === 'Pricing' ? '/pricing' : `#${label.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => setMobileNav(false)}
                className="block py-3 text-sm font-medium" style={{ color: '#a0a8c0' }}>
                {label}
              </a>
            ))}
            <div className="pt-3 mt-2 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Link href="/login?mode=register" onClick={() => setMobileNav(false)}
                className="w-full py-3 rounded-xl text-sm font-bold text-center cta-glow"
                style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ═══ Hero ═══════════════════════════════════════════════════ */}
        <section className="pt-24 pb-12 sm:pt-32 sm:pb-16 md:pt-40 md:pb-24 px-4 sm:px-6 relative overflow-hidden">
          <HeroOrbs />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              {/* Animated badge */}
              <AnimatedSection animation="fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 md:mb-8"
                  style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: '#818cf8' }}>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#4ade80' }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#4ade80' }} />
                  </span>
                  AI Phone Agents + Live Translator
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-headline font-extrabold tracking-tight leading-[1.08] mb-6">
                  Your phone calls,{' '}
                  <span className="gradient-text">powered by AI</span>
                </h1>
              </AnimatedSection>

              <AnimatedSection delay={200}>
                <p className="text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-8 md:mb-10" style={{ color: '#a0a8c0' }}>
                  Deploy AI agents that handle inbound and outbound calls.
                  Merge a live translator into any conversation.
                  One platform, zero complexity.
                </p>
              </AnimatedSection>

              <AnimatedSection delay={300}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <Link href="/login?mode=register"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold transition-all active:scale-[.97] flex items-center justify-center gap-3 group cta-glow"
                    style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
                    Start Free
                    <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </Link>
                  <Link href="/pricing"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-medium transition-all active:scale-[.97] text-center flex items-center justify-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="material-symbols-outlined text-lg" style={{ color: '#818cf8' }}>play_circle</span>
                    View Pricing
                  </Link>
                </div>
                <p className="text-xs mt-4 font-medium" style={{ color: 'rgba(160,168,192,0.5)' }}>
                  Free credit included &bull; No credit card required
                </p>
              </AnimatedSection>
            </div>

            {/* Hero Visual */}
            <AnimatedSection delay={500} animation="scale-in">
              <HeroVisual />
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Logo Strip + Stats ═══════════════════════════════════ */}
        <section className="border-y" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(22,28,40,0.5)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] shrink-0" style={{ color: 'rgba(194,198,214,0.35)' }}>Powered by</span>
              <div className="flex-1 overflow-hidden">
                <LogoStrip />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg shrink-0" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                <span className="material-symbols-outlined text-sm" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <span className="text-xs font-medium" style={{ color: '#4ade80' }}>E2E Encrypted</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Stats Counters ═══════════════════════════════════════ */}
        <section className="py-14 md:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {[
                { value: 10000, suffix: '+', label: 'Calls Handled', icon: 'call', color: '#adc6ff' },
                { value: 15, suffix: '+', label: 'Languages', icon: 'translate', color: '#4ade80' },
                { value: 99, suffix: '%', label: 'Uptime', icon: 'speed', color: '#818cf8' },
                { value: 300, suffix: 'ms', label: 'Avg Latency', icon: 'bolt', color: '#fbbf24' },
              ].map((stat, i) => (
                <AnimatedSection key={stat.label} delay={i * 100}>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: `${stat.color}10`, border: `1px solid ${stat.color}20` }}>
                      <span className="material-symbols-outlined text-xl" style={{ color: stat.color }}>{stat.icon}</span>
                    </div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold" style={{ color: stat.color }}>
                      <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs mt-1 font-medium" style={{ color: 'rgba(194,198,214,0.5)' }}>{stat.label}</div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Two Products ═══════════════════════════════════════ */}
        <section id="products" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <AnimatedSection className="text-center mb-12 md:mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)', color: '#818cf8' }}>
                Two-in-one platform
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                Two products. <span className="gradient-text">One platform.</span>
              </h2>
              <p className="text-sm sm:text-lg max-w-2xl mx-auto" style={{ color: '#a0a8c0' }}>
                AI agents for your phone lines, or real-time translation on calls.
              </p>
            </AnimatedSection>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              {/* AI Agents */}
              <AnimatedSection delay={100} animation="fade-left">
                <div className="rounded-2xl md:rounded-3xl p-6 md:p-8 relative overflow-hidden group bento-card h-full"
                  style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.04), rgba(34,211,238,0.02))', border: '1px solid rgba(74,222,128,0.12)' }}>
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.08), transparent)', filter: 'blur(60px)' }} />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(34,211,238,0.15))', border: '1px solid rgba(74,222,128,0.2)' }}>
                        <span className="material-symbols-outlined text-2xl" style={{ color: '#4ade80' }}>smart_toy</span>
                      </div>
                      <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.15)' }}>
                        From $49/mo
                      </div>
                    </div>

                    <h3 className="text-xl md:text-2xl font-headline font-extrabold mb-3">
                      AI Phone <span className="gradient-text-green">Agents</span>
                    </h3>
                    <p className="text-sm leading-relaxed mb-6" style={{ color: '#a0a8c0' }}>
                      Intelligent agents that answer inbound calls, make outbound calls, handle appointments, qualify leads, and more.
                    </p>

                    {/* Mini waveform */}
                    <div className="mb-6 opacity-40">
                      <WaveformBars color="#4ade80" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {['Inbound & outbound calls', 'Custom voice & persona', 'Knowledge base RAG', 'Call recording & transcription', 'Skill packs & workflows', 'MCP API integration'].map(f => (
                        <div key={f} className="flex items-start gap-2 text-xs leading-snug">
                          <span className="material-symbols-outlined text-sm mt-0.5 shrink-0" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    <Link href="/login?mode=register" className="inline-flex items-center gap-2 text-sm font-bold group/link transition-all" style={{ color: '#4ade80' }}>
                      Start building agents
                      <span className="material-symbols-outlined text-base group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </AnimatedSection>

              {/* Live Translator */}
              <AnimatedSection delay={200} animation="fade-right">
                <div className="rounded-2xl md:rounded-3xl p-6 md:p-8 relative overflow-hidden group bento-card h-full"
                  style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.04), rgba(139,92,246,0.02))', border: '1px solid rgba(173,198,255,0.12)' }}>
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'radial-gradient(circle, rgba(173,198,255,0.08), transparent)', filter: 'blur(60px)' }} />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(173,198,255,0.2)' }}>
                        <span className="material-symbols-outlined text-2xl" style={{ color: '#adc6ff' }}>translate</span>
                      </div>
                      <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase" style={{ background: 'rgba(173,198,255,0.08)', color: '#adc6ff', border: '1px solid rgba(173,198,255,0.15)' }}>
                        Pay as you go
                      </div>
                    </div>

                    <h3 className="text-xl md:text-2xl font-headline font-extrabold mb-3">
                      Live <span className="gradient-text">Translator</span>
                    </h3>
                    <p className="text-sm leading-relaxed mb-6" style={{ color: '#a0a8c0' }}>
                      Merge our number into any phone call — AI translates both sides in real-time.
                      No apps, no setup. Works with any phone.
                    </p>

                    {/* Mini waveform */}
                    <div className="mb-6 opacity-40">
                      <WaveformBars color="#adc6ff" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {['Real-time voice translation', '15+ language pairs', 'Live text transcript', 'Telegram alerts', 'Pay-as-you-go pricing', 'Free credit to start'].map(f => (
                        <div key={f} className="flex items-start gap-2 text-xs leading-snug">
                          <span className="material-symbols-outlined text-sm mt-0.5 shrink-0" style={{ color: '#adc6ff', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    <Link href="/login?mode=register" className="inline-flex items-center gap-2 text-sm font-bold group/link transition-all" style={{ color: '#adc6ff' }}>
                      Try translator free
                      <span className="material-symbols-outlined text-base group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ How It Works ═══════════════════════════════════════ */}
        <section id="how-it-works" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 relative" style={{ background: 'rgba(22,28,40,0.4)' }}>
          <div className="max-w-7xl mx-auto">
            <AnimatedSection className="text-center mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                Up and running in <span className="gradient-text">minutes</span>
              </h2>
              <p className="text-sm sm:text-lg max-w-xl mx-auto" style={{ color: '#a0a8c0' }}>No complex setup. Sign up, choose your plan, and start.</p>
            </AnimatedSection>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 relative">
              {/* Connector line (desktop only) */}
              <div className="absolute top-1/3 left-[12%] right-[12%] h-px hidden md:block" style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.2), rgba(129,140,248,0.2), transparent)' }} />

              {[
                { num: '01', icon: 'person_add', title: 'Create account', desc: 'Email and password. Your workspace is ready in seconds.', color: '#adc6ff' },
                { num: '02', icon: 'tune', title: 'Choose plan', desc: 'Translator, Agents, or both. Start with free credit.', color: '#4ade80' },
                { num: '03', icon: 'settings', title: 'Configure', desc: 'Set up agents with voice, prompts, and knowledge base.', color: '#d0bcff' },
                { num: '04', icon: 'rocket_launch', title: 'Go live', desc: 'Your agents answer calls. Your translator joins conversations.', color: '#67e8f9' },
              ].map((step, i) => (
                <AnimatedSection key={step.num} delay={i * 120}>
                  <div className="rounded-2xl p-5 md:p-6 relative group bento-card"
                    style={{ background: 'rgba(26,32,44,0.6)', border: '1px solid rgba(140,144,159,0.08)' }}>
                    <div className="absolute top-3 right-3 text-4xl md:text-5xl font-headline font-extrabold opacity-[0.04] group-hover:opacity-[0.1] transition-opacity"
                      style={{ color: step.color }}>{step.num}</div>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 relative" style={{ background: `${step.color}12`, border: `1px solid ${step.color}25` }}>
                      <span className="material-symbols-outlined text-xl" style={{ color: step.color }}>{step.icon}</span>
                    </div>
                    <h3 className="text-sm md:text-base font-headline font-bold mb-2">{step.title}</h3>
                    <p className="text-[11px] md:text-xs leading-relaxed" style={{ color: '#a0a8c0' }}>{step.desc}</p>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Features Bento Grid ═══════════════════════════════ */}
        <section id="features" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <AnimatedSection className="text-center mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                Everything you need to <span className="gradient-text">scale</span>
              </h2>
              <p className="text-sm sm:text-lg max-w-xl mx-auto" style={{ color: '#a0a8c0' }}>Enterprise-grade features, startup-friendly pricing.</p>
            </AnimatedSection>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {[
                { icon: 'mic', title: 'Premium Voices', desc: 'xAI Grok, OpenAI TTS, ElevenLabs. Choose the perfect voice for your brand and switch with one click.', color: '#adc6ff', accent: 'rgba(173,198,255,0.05)' },
                { icon: 'psychology', title: 'Top AI Models', desc: 'Claude, GPT-4o, Grok. Use the best LLM for each use case. Bring your own keys or use ours.', color: '#d0bcff', accent: 'rgba(208,188,255,0.05)' },
                { icon: 'key', title: 'Bring Your Own Keys', desc: 'Connect your own API keys and pay nothing extra. Or use our platform providers from your deposit.', color: '#4ade80', accent: 'rgba(74,222,128,0.05)' },
                { icon: 'auto_stories', title: 'Knowledge Base', desc: 'Upload docs, FAQs, product info. RAG-powered agents learn your business and give accurate answers.', color: '#67e8f9', accent: 'rgba(103,232,249,0.05)' },
                { icon: 'record_voice_over', title: 'Recording & Transcription', desc: 'Every call recorded, transcribed, summarized, and analyzed with sentiment and QA scores.', color: '#fbbf24', accent: 'rgba(251,191,36,0.05)' },
                { icon: 'api', title: 'MCP API', desc: 'Integrate Caller into your workflow. Trigger calls, manage agents, and sync data via our MCP server.', color: '#f87171', accent: 'rgba(248,113,113,0.05)' },
              ].map((f, i) => (
                <AnimatedSection key={f.title} delay={i * 80}>
                  <div className="glass-panel rounded-2xl p-6 bento-card h-full relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: f.accent }} />
                    <div className="relative z-10">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}12`, border: `1px solid ${f.color}20` }}>
                        <span className="material-symbols-outlined text-xl" style={{ color: f.color }}>{f.icon}</span>
                      </div>
                      <h3 className="text-base font-headline font-bold mb-2">{f.title}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: '#a0a8c0' }}>{f.desc}</p>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Provider Toggle Explainer ═════════════════════════ */}
        <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6" style={{ background: 'rgba(22,28,40,0.4)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
              <AnimatedSection animation="fade-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>swap_horiz</span>
                  Flexible Providers
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tight mb-4 leading-tight">
                  Your keys or ours.{' '}
                  <span className="gradient-text-green">You choose.</span>
                </h2>
                <p className="text-base leading-relaxed mb-8" style={{ color: '#a0a8c0' }}>
                  Connect your own Twilio, OpenAI, Anthropic, or xAI API keys and pay nothing extra.
                  Or use our platform providers — usage costs deducted from your deposit. Mix and match. Switch anytime.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: 'key', text: 'Your keys = $0 platform fees', color: '#4ade80' },
                    { icon: 'savings', text: 'Our providers = transparent deposit billing', color: '#adc6ff' },
                    { icon: 'shuffle', text: 'Mix: your Twilio + our Claude + your xAI TTS', color: '#d0bcff' },
                    { icon: 'swap_horiz', text: 'Switch between modes in one click', color: '#67e8f9' },
                  ].map(item => (
                    <div key={item.text} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}10` }}>
                        <span className="material-symbols-outlined text-base" style={{ color: item.color }}>{item.icon}</span>
                      </div>
                      <span className="text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>
              </AnimatedSection>

              <AnimatedSection animation="fade-right" delay={200}>
                <div className="glass-panel rounded-2xl md:rounded-3xl p-5 md:p-6">
                  <div className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: 'rgba(194,198,214,0.4)' }}>Provider Configuration</div>
                  <div className="space-y-2.5">
                    {[
                      { name: 'Twilio', icon: 'call', mode: 'own', color: '#adc6ff' },
                      { name: 'Anthropic', icon: 'psychology', mode: 'platform', color: '#d0bcff' },
                      { name: 'xAI (Grok)', icon: 'record_voice_over', mode: 'own', color: '#4ade80' },
                      { name: 'Deepgram', icon: 'mic', mode: 'platform', color: '#67e8f9' },
                      { name: 'OpenAI', icon: 'auto_awesome', mode: 'platform', color: '#fbbf24' },
                    ].map(p => (
                      <div key={p.name} className="flex items-center justify-between p-3.5 rounded-xl transition-all group/provider hover:scale-[1.01]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${p.color}10` }}>
                            <span className="material-symbols-outlined text-base" style={{ color: p.color }}>{p.icon}</span>
                          </div>
                          <span className="text-sm font-medium">{p.name}</span>
                        </div>
                        <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={p.mode === 'own'
                            ? { background: 'rgba(173,198,255,0.1)', color: '#adc6ff' }
                            : { background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                          {p.mode === 'own' ? 'Own Key' : 'Platform'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══════════════════════════════════════════════ */}
        <section id="faq" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <AnimatedSection className="text-center mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-4xl font-headline font-extrabold mb-4">
                Frequently asked <span className="gradient-text">questions</span>
              </h2>
            </AnimatedSection>

            <AnimatedSection delay={100}>
              <FaqAccordion items={[
                { q: 'Do I need to install anything?', a: 'No. AI Agents work through your Twilio phone numbers. The Live Translator works by merging our number into any standard phone call. No apps needed.' },
                { q: 'What happens when my deposit runs out?', a: 'Calls using platform providers will pause. If you use your own API keys, everything keeps working. Top up your deposit instantly via Stripe.' },
                { q: 'Can I switch between my own keys and platform providers?', a: 'Yes. Per-provider toggle in the dashboard. Use your own Twilio but our Claude, for example. Switch anytime with one click.' },
                { q: 'How many languages does the translator support?', a: 'We support 15+ language pairs with real-time voice translation and live text transcription. Language auto-detection is included.' },
                { q: 'Is there a free trial?', a: 'Every new account gets free deposit credit. No credit card required to start. Use it for AI agent calls or live translation.' },
                { q: 'What AI models are available?', a: 'Claude Sonnet by Anthropic, GPT-4o by OpenAI, and Grok by xAI. For voice: xAI Grok TTS (primary), OpenAI TTS, and ElevenLabs. For transcription: Deepgram Nova-2.' },
              ]} />
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Final CTA ═══════════════════════════════════════ */}
        <section className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto relative">
            {/* Background glow */}
            <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at center, rgba(129,140,248,0.08), transparent 70%)' }} />

            <AnimatedSection>
              <div className="relative glass-panel rounded-3xl p-8 sm:p-12 md:p-16 text-center overflow-hidden">
                {/* Animated gradient border */}
                <div className="absolute top-0 left-0 right-0 h-px shimmer-border" />

                <h2 className="text-2xl sm:text-3xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                  Ready to <span className="gradient-text">automate</span> your calls?
                </h2>
                <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: '#a0a8c0' }}>
                  Create your account in 30 seconds. Free credit included, no credit card.
                </p>
                <Link href="/login?mode=register"
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-base font-bold transition-all active:scale-[.97] group cta-glow"
                  style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
                  Get Started Free
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Link>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>

      {/* ═══ Footer ═══════════════════════════════════════════════ */}
      <footer className="border-t" style={{ background: '#080b14', borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
          <div className="flex flex-col md:flex-row justify-between gap-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)' }}>
                  <span className="material-symbols-outlined text-base" style={{ color: '#fff', fontVariationSettings: "'FILL' 1" }}>call</span>
                </div>
                <span className="font-headline font-extrabold text-lg">Caller</span>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(194,198,214,0.4)' }}>
                AI phone agents and live translation for the globally connected business. One platform, zero complexity.
              </p>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
                <span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>All systems operational</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-12">
              {[
                { title: 'Product', links: [
                  { label: 'AI Agents', href: '#products' },
                  { label: 'Live Translator', href: '/translator' },
                  { label: 'Pricing', href: '/pricing' },
                  { label: 'Features', href: '#features' },
                ] },
                { title: 'Resources', links: [
                  { label: 'Documentation', href: '/docs' },
                  { label: 'API Reference', href: '/docs?section=api' },
                  { label: 'Help Center', href: '/help' },
                ] },
                { title: 'Legal', links: [
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                  { label: 'Acceptable Use', href: '/acceptable-use' },
                ] },
              ].map(col => (
                <div key={col.title}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'rgba(194,198,214,0.3)' }}>{col.title}</div>
                  <div className="space-y-2.5">
                    {col.links.map(link => (
                      <Link key={link.label} href={link.href} className="block text-xs transition-colors hover:text-white" style={{ color: 'rgba(194,198,214,0.5)' }}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-[11px]" style={{ color: 'rgba(194,198,214,0.25)' }}>&copy; {new Date().getFullYear()} Caller. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
