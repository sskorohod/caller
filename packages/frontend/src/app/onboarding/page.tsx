'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const plans = [
  {
    id: 'translator',
    name: 'Translator',
    tagline: 'Live translation on any call',
    price: null,
    priceLabel: 'Free to start',
    priceNote: '$2 credit included. Pay as you go.',
    icon: 'translate',
    color: '#adc6ff',
    gradient: 'from-blue-500/10 to-indigo-500/10',
    border: 'border-blue-500/20',
    features: [
      'Live translator (merge to call)',
      '10+ language pairs',
      'Real-time text translation',
      'Telegram notifications',
    ],
    cta: 'Start Free',
    ctaStyle: 'bg-white/10 hover:bg-white/15 border border-white/20',
  },
  {
    id: 'agents',
    name: 'Agents',
    tagline: 'AI phone agents for your business',
    price: 49,
    priceLabel: '$49/mo',
    priceNote: 'Bring your own keys or use ours.',
    icon: 'smart_toy',
    color: '#4ade80',
    gradient: 'from-green-500/10 to-emerald-500/10',
    border: 'border-green-500/30',
    popular: true,
    features: [
      'Everything in Translator',
      'AI Phone Agents (up to 10)',
      'Inbound & outbound calls',
      'Call recording & transcription',
      'Knowledge base & workflows',
    ],
    cta: 'Subscribe',
    ctaStyle: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold',
  },
  {
    id: 'agents_mcp',
    name: 'Agents + MCP',
    tagline: 'Full platform with API access',
    price: 99,
    priceLabel: '$99/mo',
    priceNote: 'Unlimited agents & numbers.',
    icon: 'hub',
    color: '#d0bcff',
    gradient: 'from-purple-500/10 to-violet-500/10',
    border: 'border-purple-500/20',
    features: [
      'Everything in Agents',
      'MCP Server API Access',
      'Unlimited agent profiles',
      'Unlimited phone numbers',
      'OAuth 2.0 & webhooks',
    ],
    cta: 'Subscribe',
    ctaStyle: 'bg-white/10 hover:bg-white/15 border border-white/20',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { workspace } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const selectPlan = async (planId: string) => {
    setLoading(planId);
    try {
      if (planId === 'translator') {
        // Already on translator plan by default, just go to dashboard
        router.push('/dashboard');
        return;
      }

      // For paid plans, create Stripe subscription checkout
      const result = await api.post<{ url: string }>('/billing/subscription', { plan: planId });
      if (result.url) {
        window.location.href = result.url;
      } else {
        // Fallback if no Stripe configured yet
        router.push('/dashboard');
      }
    } catch (err) {
      // If subscription creation fails (e.g., no Stripe price configured), just go to dashboard
      console.error('Subscription error:', err);
      router.push('/dashboard');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>

      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(173,198,255,0.1)', color: '#adc6ff' }}>
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Account created{workspace ? ` — ${workspace.name}` : ''}
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold tracking-tight mb-3">
            Choose your plan
          </h1>
          <p className="text-base" style={{ color: '#c2c6d6' }}>
            Start with Translator for free, or unlock AI Agents with a subscription.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map(plan => (
            <div key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col bg-gradient-to-br ${plan.gradient} border ${plan.border} transition-all hover:scale-[1.02]`}
              style={{ backdropFilter: 'blur(20px)' }}>

              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: plan.color, color: '#0e131f' }}>
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined" style={{ color: plan.color }}>{plan.icon}</span>
                <h3 className="font-headline font-bold text-lg">{plan.name}</h3>
              </div>

              <p className="text-xs mb-4" style={{ color: '#c2c6d6' }}>{plan.tagline}</p>

              <div className="mb-4">
                {plan.price !== null ? (
                  <>
                    <span className="text-3xl font-headline font-extrabold">${plan.price}</span>
                    <span className="text-sm" style={{ color: '#c2c6d6' }}>/mo</span>
                  </>
                ) : (
                  <span className="text-2xl font-headline font-bold" style={{ color: plan.color }}>
                    {plan.priceLabel}
                  </span>
                )}
                <div className="text-[11px] mt-0.5" style={{ color: '#c2c6d6' }}>{plan.priceNote}</div>
              </div>

              <div className="space-y-2 mb-6 flex-1">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: plan.color, fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    {f}
                  </div>
                ))}
              </div>

              <button
                onClick={() => selectPlan(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${plan.ctaStyle} disabled:opacity-50`}>
                {loading === plan.id ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Skip */}
        <div className="text-center mt-6">
          <button onClick={() => router.push('/dashboard')}
            className="text-xs hover:underline transition" style={{ color: '#c2c6d6' }}>
            Skip for now — you can always upgrade later
          </button>
        </div>
      </div>
    </div>
  );
}
