import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Caller — AI Phone Agents & Live Translator',
  description: 'Automate phone calls with AI agents or get real-time translation on any call. Start with $2 free credit.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .glass-panel { background: rgba(26, 32, 44, 0.6); backdrop-filter: blur(20px); border: 0.5px solid rgba(140, 144, 159, 0.15); }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .gradient-text { background: linear-gradient(135deg, #adc6ff 0%, #d0bcff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .gradient-text-green { background: linear-gradient(135deg, #4ade80 0%, #67e8f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(2); opacity: 0; } }
      `}</style>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 border-b" style={{ background: 'rgba(14, 19, 31, 0.7)', backdropFilter: 'blur(24px)', borderColor: 'rgba(221, 226, 243, 0.06)' }}>
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)' }}>
              <span className="material-symbols-outlined text-base" style={{ color: '#0e131f', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="text-lg font-headline font-extrabold tracking-tight">Caller</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#products" className="transition-colors hover:text-white" style={{ color: '#c2c6d6' }}>Products</a>
            <a href="#how-it-works" className="transition-colors hover:text-white" style={{ color: '#c2c6d6' }}>How it Works</a>
            <Link href="/pricing" className="transition-colors hover:text-white" style={{ color: '#c2c6d6' }}>Pricing</Link>
            <a href="#faq" className="transition-colors hover:text-white" style={{ color: '#c2c6d6' }}>FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium transition-colors hover:text-white" style={{ color: '#c2c6d6' }}>Log in</Link>
            <Link href="/login?mode=register" className="px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)', color: '#0e131f' }}>
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="pt-32 pb-20 md:pt-44 md:pb-32 px-6 relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(173,198,255,0.08), transparent 70%)', filter: 'blur(40px)' }} />
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(208,188,255,0.06), transparent 70%)', filter: 'blur(40px)' }} />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
                style={{ background: 'rgba(173,198,255,0.08)', border: '1px solid rgba(173,198,255,0.15)', color: '#adc6ff' }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: '#4ade80' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#4ade80' }} />
                </span>
                Now with AI Phone Agents
              </div>

              <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tight leading-[1.08] mb-6">
                Phone calls,{' '}
                <span className="gradient-text">automated</span>
                <br className="hidden md:block" />
                {' '}and{' '}
                <span className="gradient-text">translated</span>
              </h1>

              <p className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: '#c2c6d6' }}>
                Deploy AI agents that answer and make calls for your business.
                Or merge a live translator into any conversation. One platform, zero complexity.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/login?mode=register"
                  className="px-8 py-4 rounded-xl text-base font-bold transition-all active:scale-[.97] flex items-center gap-3 group"
                  style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)', color: '#0e131f', boxShadow: '0 4px 32px rgba(77,142,255,0.25)' }}>
                  Start Free
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Link>
                <Link href="/pricing"
                  className="px-8 py-4 rounded-xl text-base font-medium transition-all active:scale-[.97]"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  View Pricing
                </Link>
              </div>

              <p className="text-xs mt-5 font-medium" style={{ color: 'rgba(194,198,214,0.5)' }}>
                $2 free credit included &bull; No credit card required
              </p>
            </div>

            {/* Hero Visual — Dashboard Preview */}
            <div className="mt-16 max-w-5xl mx-auto">
              <div className="glass-panel rounded-2xl p-1.5 relative" style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl" style={{ background: 'rgba(14,19,31,0.8)' }}>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
                  </div>
                  <div className="flex-1 mx-4 py-1 px-3 rounded text-[10px] font-mono text-center" style={{ background: 'rgba(255,255,255,0.04)', color: '#c2c6d6' }}>
                    caller.app/dashboard
                  </div>
                </div>
                {/* Dashboard mockup */}
                <div className="rounded-b-xl overflow-hidden" style={{ background: '#111318', minHeight: '320px' }}>
                  <div className="flex">
                    {/* Sidebar mock */}
                    <div className="hidden md:block w-48 p-3 space-y-1" style={{ background: '#0a0e16', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      {['Dashboard', 'Calls', 'Agents', 'Billing', 'Settings'].map((item, i) => (
                        <div key={item} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                          style={i === 0 ? { background: 'rgba(173,198,255,0.08)', color: '#adc6ff' } : { color: 'rgba(194,198,214,0.5)' }}>
                          <span className="material-symbols-outlined text-sm">
                            {['dashboard', 'call', 'smart_toy', 'payments', 'settings'][i]}
                          </span>
                          {item}
                        </div>
                      ))}
                    </div>
                    {/* Content mock */}
                    <div className="flex-1 p-5">
                      {/* KPI row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        {[
                          { label: 'Total Calls', value: '1,247', icon: 'call', color: '#adc6ff' },
                          { label: 'AI Agents', value: '5', icon: 'smart_toy', color: '#4ade80' },
                          { label: 'Balance', value: '$142.50', icon: 'account_balance', color: '#d0bcff' },
                          { label: 'Avg Latency', value: '0.3s', icon: 'speed', color: '#67e8f9' },
                        ].map(kpi => (
                          <div key={kpi.label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: 'rgba(194,198,214,0.4)' }}>{kpi.label}</span>
                              <span className="material-symbols-outlined text-sm" style={{ color: kpi.color, opacity: 0.5 }}>{kpi.icon}</span>
                            </div>
                            <div className="text-lg font-headline font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Chart mock */}
                      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="text-[9px] uppercase tracking-wider font-medium mb-3" style={{ color: 'rgba(194,198,214,0.4)' }}>Calls This Week</div>
                        <div className="flex items-end gap-1.5 h-24">
                          {[35, 52, 41, 68, 55, 72, 48].map((h, i) => (
                            <div key={i} className="flex-1 rounded-t transition-all" style={{
                              height: `${h}%`,
                              background: i === 5 ? 'linear-gradient(to top, #4d8eff, #adc6ff)' : 'rgba(173,198,255,0.15)',
                            }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Social Proof ─────────────────────────────────────── */}
        <section className="py-10 border-y" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(22,28,40,0.5)' }}>
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-8 opacity-40">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c2c6d6' }}>Powered by</span>
              {['Twilio', 'Anthropic', 'OpenAI', 'ElevenLabs', 'Deepgram'].map(name => (
                <span key={name} className="font-headline font-bold text-sm">{name}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <span className="text-xs font-medium" style={{ color: '#4ade80' }}>SOC 2 Compliant &bull; E2E Encrypted</span>
            </div>
          </div>
        </section>

        {/* ── Two Products ─────────────────────────────────────── */}
        <section id="products" className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                Two products. <span className="gradient-text">One platform.</span>
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: '#c2c6d6' }}>
                Whether you need AI agents handling your phone lines or real-time translation on calls — Caller has you covered.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Agents Card */}
              <div className="rounded-2xl p-8 md:p-10 relative overflow-hidden group transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.04), rgba(103,232,249,0.04))', border: '1px solid rgba(74,222,128,0.12)' }}>
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.06), transparent)', filter: 'blur(60px)' }} />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <span className="material-symbols-outlined text-2xl" style={{ color: '#4ade80' }}>smart_toy</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-headline font-extrabold mb-3">AI Phone Agents</h3>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: '#c2c6d6' }}>
                    Deploy intelligent agents that answer inbound calls, make outbound calls, handle appointments, qualify leads, and more.
                    Configure voice, personality, and knowledge base — your agents, your rules.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {['Inbound & outbound', 'Custom voice & persona', 'Knowledge base', 'Call recording', 'Missions & workflows', 'MCP API'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs">
                        <span className="material-symbols-outlined text-sm" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        {f}
                      </div>
                    ))}
                  </div>
                  <Link href="/login?mode=register" className="inline-flex items-center gap-2 text-sm font-bold group/link" style={{ color: '#4ade80' }}>
                    Start building agents
                    <span className="material-symbols-outlined text-base group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                  </Link>
                </div>
              </div>

              {/* Live Translator Card */}
              <div className="rounded-2xl p-8 md:p-10 relative overflow-hidden group transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.04), rgba(208,188,255,0.04))', border: '1px solid rgba(173,198,255,0.12)' }}>
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'radial-gradient(circle, rgba(173,198,255,0.06), transparent)', filter: 'blur(60px)' }} />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(173,198,255,0.1)', border: '1px solid rgba(173,198,255,0.2)' }}>
                    <span className="material-symbols-outlined text-2xl" style={{ color: '#adc6ff' }}>translate</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-headline font-extrabold mb-3">Live Translator</h3>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: '#c2c6d6' }}>
                    Merge our number into any phone call and AI translates both sides in real-time.
                    No apps, no setup. Works with any phone. 10+ language pairs.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {['Real-time voice translation', '10+ languages', 'Live text transcript', 'Telegram alerts', 'Pay-as-you-go', '$2 free credit'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs">
                        <span className="material-symbols-outlined text-sm" style={{ color: '#adc6ff', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        {f}
                      </div>
                    ))}
                  </div>
                  <Link href="/login?mode=register" className="inline-flex items-center gap-2 text-sm font-bold group/link" style={{ color: '#adc6ff' }}>
                    Try translator free
                    <span className="material-symbols-outlined text-base group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 md:py-32 px-6" style={{ background: 'rgba(22,28,40,0.4)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                Up and running in <span className="gradient-text">minutes</span>
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: '#c2c6d6' }}>
                No complex setup. Sign up, choose your plan, and start.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {[
                { num: '01', icon: 'person_add', title: 'Create account', desc: 'Email and password. That\'s it. Your workspace is ready in seconds.', color: '#adc6ff' },
                { num: '02', icon: 'tune', title: 'Choose your plan', desc: 'Translator for calls, Agents for automation, or both. Start with $2 free.', color: '#4ade80' },
                { num: '03', icon: 'settings', title: 'Configure', desc: 'Set up AI agents with custom voice and prompts, or just start translating.', color: '#d0bcff' },
                { num: '04', icon: 'rocket_launch', title: 'Go live', desc: 'Your agents answer calls. Your translator joins conferences. All from day one.', color: '#67e8f9' },
              ].map(step => (
                <div key={step.num} className="rounded-2xl p-6 relative group transition-all"
                  style={{ background: 'rgba(26,32,44,0.4)', border: '1px solid rgba(140,144,159,0.08)' }}>
                  <div className="absolute top-4 right-4 text-5xl font-headline font-extrabold opacity-[0.04] group-hover:opacity-[0.08] transition-opacity"
                    style={{ color: step.color }}>{step.num}</div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${step.color}10`, border: `1px solid ${step.color}20` }}>
                    <span className="material-symbols-outlined text-xl" style={{ color: step.color }}>{step.icon}</span>
                  </div>
                  <h3 className="text-base font-headline font-bold mb-2">{step.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#c2c6d6' }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Grid ────────────────────────────────────── */}
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                Everything you need
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: '#c2c6d6' }}>
                Enterprise-grade features, startup-friendly pricing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: 'mic', title: 'Premium Voices', desc: 'ElevenLabs, OpenAI TTS, xAI Grok — choose the perfect voice for your brand.', color: '#adc6ff' },
                { icon: 'psychology', title: 'Top AI Models', desc: 'Claude Sonnet, GPT-4o, Grok — use the best LLM for each use case.', color: '#d0bcff' },
                { icon: 'key', title: 'Bring Your Own Keys', desc: 'Use your own API keys for zero markup. Or use ours from your deposit.', color: '#4ade80' },
                { icon: 'menu_book', title: 'Knowledge Base', desc: 'Upload docs, FAQs, product catalogs. Your agents learn your business.', color: '#67e8f9' },
                { icon: 'record_voice_over', title: 'Call Recording', desc: 'Every call recorded, transcribed, and analyzed. Full audit trail.', color: '#fbbf24' },
                { icon: 'api', title: 'MCP API', desc: 'Integrate Caller into your workflow with our MCP server and webhooks.', color: '#f87171' },
              ].map(f => (
                <div key={f.title} className="glass-panel rounded-2xl p-6 group hover:scale-[1.01] transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}10` }}>
                    <span className="material-symbols-outlined text-xl" style={{ color: f.color }}>{f.icon}</span>
                  </div>
                  <h3 className="text-base font-headline font-bold mb-2">{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#c2c6d6' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Provider Toggle Explainer ─────────────────────────── */}
        <section className="py-24 md:py-32 px-6" style={{ background: 'rgba(22,28,40,0.4)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>swap_horiz</span>
                  Flexible Provider Model
                </div>
                <h2 className="text-3xl md:text-4xl font-headline font-extrabold tracking-tight mb-4 leading-tight">
                  Your keys or ours.{' '}
                  <span className="gradient-text-green">You choose.</span>
                </h2>
                <p className="text-base leading-relaxed mb-8" style={{ color: '#c2c6d6' }}>
                  Connect your own Twilio, OpenAI, Anthropic, or ElevenLabs API keys and pay nothing extra.
                  Or use our platform providers — costs are charged from your USD deposit at a transparent 3x markup.
                  Mix and match per provider. Switch anytime.
                </p>
                <div className="space-y-3">
                  {[
                    'Your keys = $0 platform usage fees',
                    'Our providers = transparent deposit-based billing',
                    'Mix: e.g., your Twilio + our Claude',
                    'Switch between modes in one click',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-base" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Provider toggle mockup */}
              <div className="glass-panel rounded-2xl p-6">
                <div className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: 'rgba(194,198,214,0.4)' }}>Provider Configuration</div>
                <div className="space-y-3">
                  {[
                    { name: 'Twilio', icon: 'call', mode: 'own', color: '#adc6ff' },
                    { name: 'Anthropic', icon: 'psychology', mode: 'platform', color: '#d0bcff' },
                    { name: 'ElevenLabs', icon: 'record_voice_over', mode: 'platform', color: '#4ade80' },
                    { name: 'Deepgram', icon: 'mic', mode: 'own', color: '#67e8f9' },
                  ].map(p => (
                    <div key={p.name} className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-lg" style={{ color: p.color }}>{p.icon}</span>
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
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" className="py-24 md:py-32 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-headline font-extrabold mb-4">Questions & Answers</h2>
            </div>
            <div className="space-y-4">
              {[
                { q: 'Do I need to install anything?', a: 'No. AI Agents work through your Twilio phone numbers. The Live Translator works by merging our number into any standard phone call. No apps needed.' },
                { q: 'What happens when my deposit runs out?', a: 'Calls using platform providers will pause. If you use your own API keys, everything keeps working. You can top up your deposit instantly via Stripe.' },
                { q: 'Can I switch between my own keys and platform providers?', a: 'Yes. Per-provider toggle in the dashboard. You can use your own Twilio but our AI, for example. Switch anytime with one click.' },
                { q: 'How many languages does the translator support?', a: 'We support 10+ language pairs with real-time voice translation and live text transcription. Language auto-detection included.' },
                { q: 'Is there a free trial?', a: 'Every new account gets $2 free deposit credit. No credit card required to start. Use it for translation or AI agent calls.' },
              ].map((faq, i) => (
                <div key={i} className="glass-panel rounded-xl p-5">
                  <h4 className="text-sm font-bold mb-2">{faq.q}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: '#c2c6d6' }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center relative">
            <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at center, rgba(173,198,255,0.06), transparent 70%)' }} />
            <div className="relative glass-panel rounded-3xl p-12 md:p-16">
              <h2 className="text-3xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                Ready to automate your calls?
              </h2>
              <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: '#c2c6d6' }}>
                Create your account in 30 seconds. $2 free credit, no credit card.
              </p>
              <Link href="/login?mode=register"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-base font-bold transition-all active:scale-[.97] group"
                style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)', color: '#0e131f', boxShadow: '0 4px 32px rgba(77,142,255,0.25)' }}>
                Get Started Free
                <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t" style={{ background: '#0a0e16', borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between gap-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)' }}>
                <span className="material-symbols-outlined text-sm" style={{ color: '#0e131f', fontVariationSettings: "'FILL' 1" }}>call</span>
              </div>
              <span className="font-headline font-bold">Caller</span>
            </div>
            <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'rgba(194,198,214,0.4)' }}>
              AI phone agents and live translation for the globally connected business.
            </p>
            <p className="text-xs mt-4" style={{ color: 'rgba(194,198,214,0.25)' }}>&copy; {new Date().getFullYear()} Caller. All rights reserved.</p>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {[
              { title: 'Product', links: [{ label: 'AI Agents', href: '#products' }, { label: 'Translator', href: '#products' }, { label: 'Pricing', href: '/pricing' }] },
              { title: 'Resources', links: [{ label: 'API Docs', href: '#' }, { label: 'Help Center', href: '#' }, { label: 'Status', href: '#' }] },
              { title: 'Legal', links: [{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }, { label: 'Security', href: '#' }] },
            ].map(col => (
              <div key={col.title}>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(194,198,214,0.3)' }}>{col.title}</div>
                <div className="space-y-2">
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
      </footer>
    </div>
  );
}
