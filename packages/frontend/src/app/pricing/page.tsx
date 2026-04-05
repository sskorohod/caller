import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing | Live Translator',
  description: 'Simple pay-per-minute pricing. No subscriptions, no hidden fees.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .glass-panel {
          background: rgba(36, 42, 54, 0.6);
          backdrop-filter: blur(20px);
          border: 0.5px solid rgba(140, 144, 159, 0.15);
        }
        .nebula-glow {
          background: radial-gradient(circle at center, rgba(173, 198, 255, 0.08) 0%, transparent 70%);
        }
        .primary-gradient {
          background: linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%);
        }
        .flux-orb {
          width: 12px; height: 12px; border-radius: 50%;
          background: #adc6ff; filter: blur(4px);
          box-shadow: 0 0 12px #adc6ff;
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>

      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 border-b" style={{ background: 'rgba(14, 19, 31, 0.6)', backdropFilter: 'blur(24px)', borderColor: 'rgba(221, 226, 243, 0.1)' }}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tighter flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined" style={{ color: '#adc6ff', fontVariationSettings: "'FILL' 1" }}>translate</span>
            Live Translator
          </Link>
          <nav className="hidden md:flex items-center gap-8 font-headline font-bold text-sm tracking-tight">
            <Link href="/#features" className="opacity-70 hover:opacity-100 transition-all duration-300">Features</Link>
            <Link href="/#how-it-works" className="opacity-70 hover:opacity-100 transition-all duration-300">How it Works</Link>
            <span style={{ color: '#adc6ff', borderBottom: '2px solid #adc6ff', paddingBottom: '4px' }}>Pricing</span>
            <Link href="/#faq" className="opacity-70 hover:opacity-100 transition-all duration-300">FAQ</Link>
          </nav>
          <div className="flex items-center gap-4 font-headline font-bold text-sm">
            <Link href="/login" className="opacity-70 hover:opacity-100 px-4 py-2 transition-all">Login</Link>
            <Link href="/login" className="px-6 py-2.5 rounded-lg transition-all active:scale-95" style={{ background: '#adc6ff', color: '#002e6a', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>Try Free</Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24 overflow-hidden relative">
        {/* Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] nebula-glow pointer-events-none -z-10" />

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6" style={{ background: 'rgba(87, 27, 193, 0.2)', border: '1px solid rgba(208, 188, 255, 0.1)' }}>
            <div className="flux-orb" />
            <span className="text-xs font-bold tracking-widest uppercase font-headline" style={{ color: '#d0bcff' }}>Transparent Pricing</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tighter mb-6 leading-tight">
            Simple, transparent pricing. <br />
            <span style={{ color: '#adc6ff' }}>Pay only for what you use.</span>
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: '#c2c6d6' }}>
            No hidden fees. No restrictive monthly subscriptions. High-performance AI translation accessible to everyone, billed by the minute.
          </p>
        </section>

        {/* Pay-Per-Minute */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <div className="glass-panel rounded-3xl p-1 md:p-1.5 overflow-hidden">
            <div className="rounded-[calc(1.5rem-4px)] p-8 md:p-12 flex flex-col md:flex-row gap-12 items-center" style={{ background: '#242a36' }}>
              <div className="flex-1 space-y-6">
                <h2 className="text-3xl font-headline font-bold">The &ldquo;Pay Per Minute&rdquo; Standard</h2>
                <p className="leading-relaxed" style={{ color: '#c2c6d6' }}>
                  Perfect for occasional users and spontaneous conversations. Purchase credits and use them whenever you need translation &mdash; credits never expire.
                </p>
                <ul className="space-y-4">
                  {[
                    'No subscriptions or monthly bills',
                    'Credits never expire',
                    'No commitments \u2014 cancel anytime',
                    'All 10+ languages included',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl" style={{ color: '#adc6ff' }}>check_circle</span>
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-full md:w-80 h-80 glass-panel rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(173, 198, 255, 0.05)' }} />
                <div className="text-sm font-bold tracking-widest uppercase mb-2" style={{ color: '#adc6ff' }}>Base Rate</div>
                <div className="text-7xl font-headline font-extrabold tracking-tighter mb-2">$0.15</div>
                <div className="font-medium" style={{ color: '#c2c6d6' }}>per minute</div>
                <div className="mt-8">
                  <Link href="/login" className="primary-gradient px-8 py-3 rounded-xl font-bold tracking-tight shadow-xl hover:scale-105 active:scale-95 transition-all inline-block" style={{ color: '#002e6a' }}>Get Started</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Starter Bundles */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Starter', icon: 'rocket_launch', price: '$4.50', minutes: 30, perMin: '$0.15', popular: false },
              { name: 'Pro', icon: 'workspace_premium', price: '$7.50', minutes: 60, perMin: '$0.125', popular: true },
              { name: 'Executive', icon: 'stars', price: '$12.00', minutes: 120, perMin: '$0.10', popular: false },
            ].map((plan) => (
              <div key={plan.name} className={`glass-panel rounded-3xl p-8 flex flex-col transition-all relative ${plan.popular ? 'scale-105 z-10 ring-1' : 'hover:bg-opacity-20'}`}
                style={plan.popular ? { background: 'rgba(36, 42, 54, 0.8)', borderColor: 'rgba(173, 198, 255, 0.3)', boxShadow: '0 0 40px rgba(173, 198, 255, 0.05)' } : undefined}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-extrabold tracking-widest uppercase px-4 py-1.5 rounded-full shadow-lg" style={{ background: '#adc6ff', color: '#002e6a' }}>
                    Best Value
                  </div>
                )}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={plan.popular ? { background: 'linear-gradient(135deg, #adc6ff, #4d8eff)' } : { background: '#2f3542' }}>
                  <span className="material-symbols-outlined" style={{ color: plan.popular ? '#002e6a' : '#adc6ff' }}>{plan.icon}</span>
                </div>
                <h3 className="text-xl font-headline font-bold mb-1">{plan.name}</h3>
                <div className="text-xs mb-4" style={{ color: '#c2c6d6' }}>{plan.perMin}/min &bull; Save {plan.name === 'Starter' ? '0%' : plan.name === 'Pro' ? '17%' : '33%'}</div>
                <div className="text-4xl font-headline font-extrabold mb-4">{plan.price}</div>
                <div className="text-sm mb-8" style={{ color: '#c2c6d6' }}>Includes {plan.minutes} minutes of translation time.</div>
                <div className="mt-auto pt-8 border-t" style={{ borderColor: 'rgba(66, 71, 84, 0.1)' }}>
                  <Link href="/login" className={`block w-full py-3 rounded-xl font-bold text-center transition-all active:scale-[0.98] ${plan.popular ? 'shadow-lg hover:brightness-110' : 'hover:brightness-125'}`}
                    style={plan.popular
                      ? { background: 'linear-gradient(135deg, #adc6ff, #4d8eff)', color: '#002e6a' }
                      : { background: '#2f3542', color: '#dde2f3' }
                    }>
                    Buy Bundle
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Everything Included */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <div className="rounded-[2rem] p-12 relative overflow-hidden" style={{ background: '#161c28' }}>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl font-headline font-extrabold mb-6">Everything included. <br /><span style={{ color: '#a4c9ff' }}>No premium tiers.</span></h2>
                <p className="mb-10 text-lg" style={{ color: '#c2c6d6' }}>We don&apos;t hold features hostage. Every user gets access to our full suite of AI-powered translation tools from the very first minute.</p>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { icon: 'translate', label: '10+ Languages' },
                    { icon: 'description', label: 'Real-time Transcript' },
                    { icon: 'dynamic_form', label: 'Auto-detection' },
                    { icon: 'cloud_sync', label: 'Session History' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(173, 198, 255, 0.1)' }}>
                        <span className="material-symbols-outlined text-lg" style={{ color: '#adc6ff' }}>{f.icon}</span>
                      </div>
                      <span className="font-medium">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {['English', 'Spanish', 'Russian', 'Chinese', 'French', 'Arabic', 'German', 'Japanese', 'Korean', 'Portuguese'].map((lang, i) => (
                  <div key={lang} className="p-4 glass-panel rounded-2xl text-center">
                    <div className="font-bold text-sm mb-1">{lang}</div>
                    <div className="text-xs font-bold" style={{ color: i < 8 ? '#adc6ff' : '#c2c6d6' }}>{i < 8 ? 'ACTIVE' : 'AVAILABLE'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Cost Breakdown (transparency) */}
        <section className="max-w-4xl mx-auto px-6 mb-32">
          <h2 className="text-3xl font-headline font-extrabold text-center mb-4">Why $0.15/min?</h2>
          <p className="text-center mb-12" style={{ color: '#c2c6d6' }}>We use the best AI models available. Here&apos;s what powers every minute of your translation.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Speech-to-Text', tech: 'Deepgram Nova-2', icon: 'mic' },
              { label: 'Translation', tech: 'GPT-4o / Grok', icon: 'translate' },
              { label: 'Text-to-Speech', tech: 'ElevenLabs Flash', icon: 'record_voice_over' },
              { label: 'Telephony', tech: 'Twilio', icon: 'phone_in_talk' },
            ].map((item) => (
              <div key={item.label} className="glass-panel rounded-2xl p-5 text-center">
                <span className="material-symbols-outlined text-2xl mb-2 block" style={{ color: '#adc6ff' }}>{item.icon}</span>
                <div className="font-bold text-sm mb-1">{item.label}</div>
                <div className="text-xs" style={{ color: '#c2c6d6' }}>{item.tech}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="max-w-7xl mx-auto px-6 mb-32 text-center">
          <h4 className="text-sm font-bold uppercase tracking-widest mb-12" style={{ color: '#c2c6d6' }}>Trusted Security &amp; Infrastructure</h4>
          <div className="flex flex-wrap justify-center items-center gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
            {[
              { icon: 'payments', label: 'Stripe' },
              { icon: 'lock', label: '256-bit AES' },
              { icon: 'verified_user', label: 'PCI DSS Compliant' },
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl">{badge.icon}</span>
                <span className="font-headline font-bold text-xl">{badge.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-6 mb-32">
          <h2 className="text-3xl font-headline font-extrabold text-center mb-16">Billing Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'How does "Pay Per Minute" actually work?', a: 'You purchase credits in advance. When you start a translation session, we track usage to the second and deduct from your balance only for active translation time.' },
              { q: 'Do my credits ever expire?', a: 'No. Whether you use them today or next year, your credits remain in your account until used. No "use it or lose it" policies.' },
              { q: 'Can I get a refund for unused credits?', a: 'Yes, we offer a full refund for any unused credit balance within 30 days of purchase, no questions asked.' },
              { q: 'Are there any hidden connection fees?', a: 'None. You pay exactly $0.15 per minute of translation (or less with bundles). No charges for setup, storage, or transcript access.' },
            ].map((faq) => (
              <div key={faq.q} className="glass-panel rounded-2xl p-6">
                <h4 className="font-bold mb-2">{faq.q}</h4>
                <p className="text-sm" style={{ color: '#c2c6d6' }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t" style={{ background: '#161c28', borderColor: 'rgba(221, 226, 243, 0.05)' }}>
        <div className="max-w-7xl mx-auto px-8 py-16 flex flex-col md:flex-row justify-between gap-12">
          <div className="space-y-6 max-w-sm">
            <Link href="/" className="text-lg font-bold font-headline">Live Translator</Link>
            <p className="text-sm" style={{ color: 'rgba(221, 226, 243, 0.6)' }}>Break language barriers in real-time with precision AI. Built for the modern professional.</p>
            <p className="text-xs tracking-tight" style={{ color: 'rgba(221, 226, 243, 0.4)' }}>&copy; 2025 Live Translator. All rights reserved.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-8">
            {[
              { title: 'Product', links: [{ label: 'Features', href: '/landing#features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Trust Center', href: '#' }] },
              { title: 'Legal', links: [{ label: 'Privacy Policy', href: '#' }, { label: 'Terms of Service', href: '#' }, { label: 'Security', href: '#' }] },
            ].map((col) => (
              <div key={col.title}>
                <h5 className="font-bold text-sm mb-6 uppercase tracking-widest">{col.title}</h5>
                <ul className="space-y-4 text-sm">
                  {col.links.map((link) => (
                    <li key={link.label}><Link href={link.href} className="hover:text-[#adc6ff] transition-colors" style={{ color: 'rgba(221, 226, 243, 0.5)' }}>{link.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
