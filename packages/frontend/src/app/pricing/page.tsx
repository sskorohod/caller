'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlanData {
  id: string;
  name: string;
  monthly_price: number;
  trial_days: number;
}

const PLAN_META: Record<string, { tagline: string; highlight: boolean; cta: string; priceNote: string; features: string[]; excluded: string[] }> = {
  translator: {
    tagline: 'Live translation on any call',
    priceNote: 'No monthly fee — pay only for what you use',
    highlight: false,
    cta: 'Get Started',
    features: ['Free credit on signup', 'Live translator (merge to call)', '10+ language pairs', 'Real-time text translation', 'Telegram notifications', 'Pay-as-you-go from deposit'],
    excluded: ['AI Phone Agents', 'MCP API Access', 'Custom agent profiles'],
  },
  agents: {
    tagline: 'AI phone agents for your business',
    priceNote: '+ deposit for platform provider usage',
    highlight: true,
    cta: 'Subscribe',
    features: ['Everything in Translator', 'AI Phone Agents (up to 10)', 'Up to 5 phone numbers', 'Inbound & outbound calls', 'Call recording & transcription', 'Knowledge base & prompts', 'Missions & workflows', 'Use your own API keys (free)', 'Or use platform providers (from deposit)'],
    excluded: ['MCP API Access'],
  },
  agents_mcp: {
    tagline: 'Full platform with API access',
    priceNote: '+ deposit for platform provider usage',
    highlight: false,
    cta: 'Subscribe',
    features: ['Everything in Agents', 'MCP Server API Access', 'Unlimited agent profiles', 'Unlimited phone numbers', 'OAuth 2.0 integration', 'Webhooks & connectors', 'Priority support'],
    excluded: [],
  },
};

export default function PricingPage() {
  const [plans, setPlans] = useState<PlanData[]>([]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin + '/api' : '/api');
    fetch(`${apiUrl}/billing/plans`)
      .then(r => r.json())
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {
        // Fallback defaults
        setPlans([
          { id: 'translator', name: 'Translator', monthly_price: 0, trial_days: 0 },
          { id: 'agents', name: 'Agents', monthly_price: 49, trial_days: 15 },
          { id: 'agents_mcp', name: 'Agents + MCP', monthly_price: 99, trial_days: 15 },
        ]);
      });
  }, []);

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
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b" style={{ background: 'rgba(14, 19, 31, 0.6)', backdropFilter: 'blur(24px)', borderColor: 'rgba(221, 226, 243, 0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tighter flex items-center gap-2 font-headline">
            <span className="material-symbols-outlined" style={{ color: '#adc6ff', fontVariationSettings: "'FILL' 1" }}>call</span>
            Caller
          </Link>
          <div className="flex items-center gap-4 font-headline font-bold text-sm">
            <Link href="/login" className="opacity-70 hover:opacity-100 transition">Log In</Link>
            <Link href="/login?mode=register" className="px-5 py-2.5 rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)' }}>
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 sm:pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Title */}
          <div className="text-center mb-16">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-sm sm:text-lg max-w-2xl mx-auto" style={{ color: '#c2c6d6' }}>
              Start free with the Translator plan. Upgrade to Agents when you need AI phone automation.
              Bring your own API keys or use ours from your deposit.
            </p>
          </div>

          {/* Plan Cards */}
          <div className="flex flex-col md:grid md:grid-cols-3 gap-4 sm:gap-6 md:overflow-visible">
            {plans.map(plan => {
              const meta = PLAN_META[plan.id];
              if (!meta) return null;
              const price = plan.monthly_price;
              return (
              <div key={plan.id}
                className="glass-panel rounded-2xl p-6 sm:p-8 flex flex-col relative"
                style={meta.highlight ? {
                  border: '1px solid rgba(77, 142, 255, 0.4)',
                  boxShadow: '0 0 40px rgba(77, 142, 255, 0.08)',
                } : undefined}>

                {meta.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)', color: '#0e131f' }}>
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-headline font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm" style={{ color: '#c2c6d6' }}>{meta.tagline}</p>
                </div>

                <div className="mb-6">
                  {price > 0 ? (
                    <>
                      <span className="text-4xl font-headline font-extrabold">${price}</span>
                      <span className="text-sm" style={{ color: '#c2c6d6' }}>/month</span>
                    </>
                  ) : (
                    <span className="text-2xl font-headline font-bold" style={{ color: '#4ade80' }}>Free to start</span>
                  )}
                  <div className="text-xs mt-1" style={{ color: '#c2c6d6' }}>{meta.priceNote}</div>
                  {plan.trial_days > 0 && (
                    <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(74, 222, 128, 0.12)', color: '#4ade80' }}>
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                      {plan.trial_days}-day free trial
                    </div>
                  )}
                </div>

                <Link href="/login?mode=register"
                  className="block text-center py-3 rounded-xl text-sm font-bold transition mb-6 min-h-[44px]"
                  style={meta.highlight
                    ? { background: 'linear-gradient(135deg, #adc6ff, #4d8eff)', color: '#0e131f' }
                    : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {plan.trial_days > 0 ? 'Start Free Trial' : meta.cta}
                </Link>

                <div className="space-y-2.5 flex-1">
                  {meta.features.map(f => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <span className="material-symbols-outlined text-base mt-0.5" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {f}
                    </div>
                  ))}
                  {meta.excluded.map(f => (
                    <div key={f} className="flex items-start gap-2 text-sm" style={{ color: '#6b7280' }}>
                      <span className="material-symbols-outlined text-base mt-0.5">cancel</span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>

          {/* Provider Toggle Explainer */}
          <div className="mt-12 sm:mt-16 glass-panel rounded-2xl p-5 sm:p-8 max-w-3xl mx-auto text-center">
            <span className="material-symbols-outlined text-3xl mb-3 block" style={{ color: '#adc6ff' }}>swap_horiz</span>
            <h3 className="text-xl font-headline font-bold mb-2">Bring Your Own Keys or Use Ours</h3>
            <p className="text-sm" style={{ color: '#c2c6d6' }}>
              With the Agents plan, you can connect your own API keys for Twilio, OpenAI, Anthropic, ElevenLabs, and more.
              Your keys = no usage charges. Or use our platform providers and pay from your deposit.
              Mix and match — use your Twilio but our AI, for example.
            </p>
          </div>

          {/* Deposit Explainer */}
          <div className="mt-6 sm:mt-8 glass-panel rounded-2xl p-5 sm:p-8 max-w-3xl mx-auto text-center">
            <span className="material-symbols-outlined text-3xl mb-3 block" style={{ color: '#4ade80' }}>account_balance_wallet</span>
            <h3 className="text-xl font-headline font-bold mb-2">How the Deposit Works</h3>
            <p className="text-sm" style={{ color: '#c2c6d6' }}>
              Top up your USD deposit via Stripe. When you use our providers (STT, LLM, TTS, telephony),
              usage costs are deducted from your balance.
              When your balance runs out, platform provider calls are paused — but your own keys keep working.
              No surprises, no overcharges.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
