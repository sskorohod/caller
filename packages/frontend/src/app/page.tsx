import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Live Translator | AI Phone Interpreter',
  description: 'Real-time AI phone translation. No apps, no setup. Just merge our number into your call.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .glass-panel {
          background: rgba(26, 32, 44, 0.6);
          backdrop-filter: blur(20px);
          border: 0.5px solid rgba(140, 144, 159, 0.15);
        }
        .nebula-glow {
          background: radial-gradient(circle at 50% 50%, rgba(173, 198, 255, 0.1) 0%, rgba(14, 19, 31, 0) 70%);
        }
        .primary-gradient-text {
          background: linear-gradient(135deg, #adc6ff 0%, #d0bcff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>

      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 border-b" style={{ background: 'rgba(14, 19, 31, 0.6)', backdropFilter: 'blur(24px)', borderColor: 'rgba(221, 226, 243, 0.1)' }}>
        <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tighter flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined" style={{ color: '#adc6ff', fontVariationSettings: "'FILL' 1" }}>translate</span>
            Live Translator
          </div>
          <div className="hidden md:flex items-center gap-8 font-headline font-bold text-sm tracking-tight">
            <a href="#features" className="opacity-70 hover:opacity-100 transition-all duration-300">Features</a>
            <a href="#how-it-works" className="opacity-70 hover:opacity-100 transition-all duration-300">How it Works</a>
            <Link href="/pricing" className="opacity-70 hover:opacity-100 transition-all duration-300">Pricing</Link>
            <a href="#faq" className="opacity-70 hover:opacity-100 transition-all duration-300">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="px-5 py-2 font-headline font-bold text-sm opacity-70 hover:opacity-100 transition-all">Login</Link>
            <Link href="/login" className="px-6 py-2.5 rounded-xl font-headline font-bold text-sm transition-all active:scale-95" style={{ background: '#adc6ff', color: '#002e6a', boxShadow: '0 0 20px rgba(173, 198, 255, 0.2)' }}>Try Free</Link>
          </div>
        </nav>
      </header>

      <main className="relative">
        {/* Hero Section */}
        <section className="pt-40 pb-20 md:pt-56 md:pb-32 px-6 nebula-glow relative overflow-hidden">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest" style={{ background: '#242a36', border: '1px solid rgba(66, 71, 84, 0.2)', color: '#adc6ff' }}>
                <span className="flex h-2 w-2 rounded-full animate-pulse" style={{ background: '#adc6ff' }} />
                Real-time Phone AI
              </div>
              <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tight leading-[1.1]">
                Your AI interpreter. <br /><span className="primary-gradient-text">On every call.</span>
              </h1>
              <p className="text-xl md:text-2xl max-w-xl leading-relaxed" style={{ color: '#c2c6d6' }}>
                No apps, no setup. Just merge our number into your phone call and AI translates in real-time.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/login" className="px-8 py-4 rounded-xl font-headline font-bold text-lg transition-all flex items-center justify-center gap-3 group active:scale-95" style={{ background: '#adc6ff', color: '#002e6a' }}>
                  Try Free &mdash; 5 Minutes on Us
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Link>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute -inset-4 blur-3xl rounded-full opacity-50 group-hover:opacity-75 transition-opacity" style={{ background: 'rgba(173, 198, 255, 0.1)' }} />
              <div className="glass-panel p-4 rounded-[2.5rem] shadow-2xl relative">
                {/* Phone mockup with translation bubbles */}
                <div className="w-full aspect-[3/4] rounded-[2rem] flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #161c28 0%, #1a202c 100%)' }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full opacity-20 animate-pulse" style={{ background: 'radial-gradient(circle, #adc6ff, transparent)' }} />
                  </div>
                  <div className="absolute bottom-16 left-6 right-6 space-y-3">
                    <div className="glass-panel p-3 rounded-xl flex gap-3 items-center transform -translate-x-2" style={{ borderLeft: '4px solid #adc6ff' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(173, 198, 255, 0.2)' }}>
                        <span className="material-symbols-outlined text-sm" style={{ color: '#adc6ff' }}>person</span>
                      </div>
                      <p className="text-xs font-medium">How much for the export license?</p>
                    </div>
                    <div className="glass-panel p-3 rounded-xl flex gap-3 items-center transform translate-x-2" style={{ borderRight: '4px solid #d0bcff' }}>
                      <p className="text-xs font-medium text-right w-full">&iquest;Cu&aacute;nto cuesta la licencia de exportaci&oacute;n?</p>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(208, 188, 255, 0.2)' }}>
                        <span className="material-symbols-outlined text-sm" style={{ color: '#d0bcff' }}>support_agent</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="py-12 border-y" style={{ borderColor: 'rgba(66, 71, 84, 0.1)', background: '#161c28' }}>
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex flex-wrap items-center gap-10 opacity-60 grayscale hover:grayscale-0 transition-all">
              <span className="font-headline font-bold text-lg">OPENAI</span>
              <span className="font-headline font-bold text-lg">ELEVENLABS</span>
              <span className="font-headline font-bold text-lg">DEEPGRAM</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl" style={{ background: 'rgba(47, 53, 66, 0.3)', border: '1px solid rgba(173, 198, 255, 0.2)' }}>
              <span className="material-symbols-outlined" style={{ color: '#adc6ff', fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <span className="text-sm font-medium">No recording &mdash; your calls are never stored</span>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-24">
              <h2 className="text-4xl md:text-5xl font-headline font-extrabold mb-6">Seamless, In 3 Steps</h2>
              <p className="max-w-2xl mx-auto" style={{ color: '#c2c6d6' }}>Zero complexity. Our AI lives inside your phone line, ready to bridge the gap whenever you need it.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { num: '01', icon: 'add_call', title: 'Call our number', desc: 'Save our global access number to your contacts. Initiate a standard phone call whenever you need interpretation.', color: '#adc6ff' },
                { num: '02', icon: 'group_add', title: 'Merge the conversation', desc: 'Add the person you want to speak with and tap "Merge Calls". Our AI detects the languages automatically.', color: '#d0bcff' },
                { num: '03', icon: 'auto_awesome', title: 'AI translates real-time', desc: 'Speak naturally. The AI listens, translates, and speaks back in the target language with ultra-low latency.', color: '#adc6ff' },
              ].map((step) => (
                <div key={step.num} className="p-8 rounded-[2rem] group relative overflow-hidden transition-colors" style={{ background: '#161c28' }}>
                  <div className="absolute top-0 right-0 p-8 text-8xl font-black opacity-5 group-hover:opacity-10 transition-colors" style={{ color: step.color }}>{step.num}</div>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8" style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: step.color }}>{step.icon}</span>
                  </div>
                  <h3 className="text-2xl font-headline font-bold mb-4">{step.title}</h3>
                  <p style={{ color: '#c2c6d6' }} className="leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Transcript Demo */}
        <section id="features" className="py-32 px-6" style={{ background: 'rgba(8, 14, 26, 0.5)' }}>
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-20">
            <div className="lg:w-1/2 order-2 lg:order-1">
              <div className="relative max-w-sm mx-auto">
                <div className="absolute -inset-10 blur-[100px] rounded-full" style={{ background: 'rgba(208, 188, 255, 0.05)' }} />
                <div className="relative glass-panel rounded-[3rem] overflow-hidden shadow-2xl" style={{ border: '12px solid #2f3542' }}>
                  <div className="h-8 flex items-center justify-center" style={{ background: '#2f3542' }}>
                    <div className="w-16 h-1 rounded-full" style={{ background: 'rgba(66, 71, 84, 0.3)' }} />
                  </div>
                  <div className="p-6 space-y-6 h-[600px] overflow-y-auto" style={{ background: '#0e131f' }}>
                    <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'rgba(66, 71, 84, 0.1)' }}>
                      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c2c6d6' }}>Live Transcript</div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full animate-pulse" style={{ background: '#ffb4ab' }} />
                        <span className="text-[10px] font-bold" style={{ color: '#ffb4ab' }}>LIVE</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {[
                        { side: 'left', lang: 'You (English)', text: "I'm looking for the nearest train station to the airport.", color: '#adc6ff' },
                        { side: 'right', lang: 'Interpreter (French)', text: 'Je cherche la gare la plus proche de l\'a\u00e9roport.', color: '#d0bcff' },
                        { side: 'left', lang: 'You (English)', text: 'Is there a shuttle service available?', color: '#adc6ff' },
                        { side: 'right', lang: 'Interpreter (French)', text: 'Y a-t-il un service de navette disponible ?', color: '#d0bcff' },
                      ].map((msg, i) => (
                        <div key={i} className="p-4 rounded-2xl" style={{
                          background: msg.side === 'left' ? '#161c28' : '#2f3542',
                          borderLeft: msg.side === 'left' ? `2px solid ${msg.color}` : undefined,
                          borderRight: msg.side === 'right' ? `2px solid ${msg.color}` : undefined,
                        }}>
                          <div className={`text-[10px] font-bold mb-1 uppercase tracking-tighter ${msg.side === 'right' ? 'text-right' : ''}`} style={{ color: msg.color }}>{msg.lang}</div>
                          <p className={`text-sm ${msg.side === 'right' ? 'italic' : ''}`}>{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 space-y-8 order-1 lg:order-2">
              <h2 className="text-4xl font-headline font-extrabold leading-tight">Follow along with a <span className="primary-gradient-text">Live Transcript</span></h2>
              <p className="text-lg leading-relaxed" style={{ color: '#c2c6d6' }}>
                While you speak on the phone, you can optionally open a secure web link to see the conversation transcribed in both languages in real-time. Perfect for verifying technical details or addresses.
              </p>
              <ul className="space-y-4">
                {['Dual-language parallel view', 'Instant correction capability', 'End-to-end encrypted link'].map((item) => (
                  <li key={item} className="flex items-center gap-4">
                    <span className="material-symbols-outlined" style={{ color: '#adc6ff' }}>check_circle</span>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ + Pricing */}
        <section id="faq" className="py-32 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div>
              <h2 className="text-4xl font-headline font-extrabold mb-12">Common Questions</h2>
              <div className="space-y-6">
                {[
                  { q: 'Do I need to install an app?', a: 'No. It works with any phone service. You simply add our interpreter number as a third participant in your call.', highlight: true },
                  { q: 'How many languages are supported?', a: 'We currently support 75+ languages including major dialects for Spanish, Arabic, Chinese, and French.' },
                  { q: 'Is there any latency?', a: 'Our optimized pipeline processes speech in under 300ms, making the conversation feel natural and fluid.' },
                ].map((faq, i) => (
                  <div key={i} className="glass-panel p-6 rounded-2xl" style={faq.highlight ? { borderLeft: '4px solid #adc6ff' } : undefined}>
                    <h4 className="font-bold text-lg mb-2">{faq.q}</h4>
                    <p style={{ color: '#c2c6d6' }}>{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="glass-panel p-10 rounded-[2.5rem] relative overflow-hidden" style={{ borderTop: '1px solid rgba(173, 198, 255, 0.2)' }}>
                <div className="absolute -top-24 -right-24 w-64 h-64 blur-[80px] rounded-full" style={{ background: 'rgba(173, 198, 255, 0.1)' }} />
                <h3 className="text-3xl font-headline font-extrabold mb-4">Purely Pay-As-You-Go</h3>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-6xl font-headline font-extrabold" style={{ color: '#adc6ff' }}>$0.15</span>
                  <span className="font-bold" style={{ color: '#c2c6d6' }}>/ minute</span>
                </div>
                <ul className="space-y-4 mb-10" style={{ color: '#c2c6d6' }}>
                  {['No monthly subscription', 'Free 5-minute starter credit', 'Access to all 75+ languages', 'Web transcript dashboard included'].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-sm" style={{ color: '#adc6ff' }}>done</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="block w-full py-4 text-center font-headline font-bold rounded-xl transition-all active:scale-95" style={{ background: '#4d8eff', color: '#00285d' }}>
                  Setup My Account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="py-24 px-6 relative">
          <div className="max-w-4xl mx-auto glass-panel p-12 rounded-[3rem] text-center" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 className="text-4xl md:text-5xl font-headline font-extrabold mb-6">Get started in 30 seconds</h2>
            <p className="mb-10 text-lg" style={{ color: '#c2c6d6' }}>Enter your email or phone number to receive your private access number.</p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <input className="flex-grow border-none rounded-xl px-6 py-4 focus:ring-2 text-sm" style={{ background: '#2f3542', color: '#dde2f3', outline: 'none' }} placeholder="Email or Phone Number" type="text" />
              <button className="font-headline font-bold px-8 py-4 rounded-xl transition-all active:scale-95" style={{ background: '#adc6ff', color: '#002e6a' }}>Send Code</button>
            </div>
            <p className="mt-6 text-xs uppercase tracking-widest font-bold" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>Secure &bull; Private &bull; Instant</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t" style={{ background: '#161c28', borderColor: 'rgba(221, 226, 243, 0.05)' }}>
        <div className="max-w-7xl mx-auto px-8 py-16 flex flex-col md:flex-row justify-between gap-12">
          <div className="space-y-6">
            <div className="text-lg font-bold font-headline">Live Translator</div>
            <p className="text-sm max-w-xs" style={{ color: 'rgba(221, 226, 243, 0.6)' }}>Precision Ethereal AI for the globally connected professional.</p>
            <p className="text-sm" style={{ color: 'rgba(221, 226, 243, 0.6)' }}>&copy; 2025 Live Translator. All rights reserved.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Security'] },
              { title: 'Company', links: ['Privacy Policy', 'Terms of Service', 'Trust Center'] },
              { title: 'Support', links: ['Help Center', 'Contact Us', 'Status'] },
            ].map((col) => (
              <div key={col.title} className="space-y-4">
                <h5 className="font-bold text-sm">{col.title}</h5>
                <div className="flex flex-col gap-2 text-sm" style={{ color: 'rgba(221, 226, 243, 0.5)' }}>
                  {col.links.map((link) => (
                    <a key={link} href="#" className="hover:text-[#adc6ff] transition-colors cursor-pointer">{link}</a>
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
