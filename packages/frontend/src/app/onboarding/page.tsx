'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const PLAN_META: Record<string, {
  tagline: string; icon: string; color: string; gradient: string; border: string;
  popular?: boolean; features: string[]; cta: string; ctaStyle: string;
}> = {
  translator: {
    tagline: 'Live translation on any call',
    icon: 'translate', color: '#adc6ff',
    gradient: 'from-blue-500/10 to-indigo-500/10', border: 'border-blue-500/20',
    features: ['Live translator (merge to call)', '10+ language pairs', 'Real-time text translation', 'Telegram notifications'],
    cta: 'Start Free', ctaStyle: 'bg-white/10 hover:bg-white/15 border border-white/20',
  },
  agents: {
    tagline: 'AI phone agents for your business',
    icon: 'smart_toy', color: '#4ade80',
    gradient: 'from-green-500/10 to-emerald-500/10', border: 'border-green-500/30',
    popular: true,
    features: ['Everything in Translator', 'AI Phone Agents (up to 10)', 'Inbound & outbound calls', 'Call recording & transcription', 'Knowledge base & workflows'],
    cta: 'Start Free Trial', ctaStyle: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold',
  },
  agents_mcp: {
    tagline: 'Full platform with API access',
    icon: 'hub', color: '#d0bcff',
    gradient: 'from-purple-500/10 to-violet-500/10', border: 'border-purple-500/20',
    features: ['Everything in Agents', 'MCP Server API Access', 'Unlimited agent profiles', 'Unlimited phone numbers', 'OAuth 2.0 & webhooks'],
    cta: 'Start Free Trial', ctaStyle: 'bg-white/10 hover:bg-white/15 border border-white/20',
  },
};

interface PlanData { id: string; name: string; monthly_price: number; trial_days: number; }

export default function OnboardingPage() {
  const router = useRouter();
  const { workspace } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanData[]>([]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin + '/api' : '/api');
    fetch(`${apiUrl}/billing/plans`)
      .then(r => r.json())
      .then(data => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {
        setPlans([
          { id: 'translator', name: 'Translator', monthly_price: 0, trial_days: 0 },
          { id: 'agents', name: 'Agents', monthly_price: 49, trial_days: 15 },
          { id: 'agents_mcp', name: 'Agents + MCP', monthly_price: 99, trial_days: 15 },
        ]);
      });
  }, []);

  const selectPlan = async (planId: string) => {
    setLoading(planId);
    try {
      if (planId === 'translator') {
        // Already on translator plan by default, just go to dashboard
        router.push('/dashboard');
        return;
      }

      // Start free trial — no credit card required
      await api.post('/billing/start-trial', { plan: planId });
      router.push('/dashboard');
    } catch (err) {
      console.error('Trial start error:', err);
      router.push('/dashboard');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6 md:p-6"
      style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>

      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-6 md:mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-4 md:mb-6"
            style={{ background: 'rgba(173,198,255,0.1)', color: '#adc6ff' }}>
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Account created{workspace ? ` — ${workspace.name}` : ''}
          </div>
          <h1 className="text-2xl md:text-4xl font-headline font-extrabold tracking-tight mb-2 md:mb-3">
            Choose your plan
          </h1>
          <p className="text-sm md:text-base" style={{ color: '#c2c6d6' }}>
            Start with Translator for free, or unlock AI Agents with a subscription.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {plans.map(plan => {
            const meta = PLAN_META[plan.id];
            if (!meta) return null;
            const price = plan.monthly_price;
            return (
            <div key={plan.id}
              className={`relative rounded-2xl p-5 md:p-6 flex flex-col bg-gradient-to-br ${meta.gradient} border ${meta.border} transition-all hover:scale-[1.02]`}
              style={{ backdropFilter: 'blur(20px)' }}>

              {meta.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: meta.color, color: '#0e131f' }}>
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined" style={{ color: meta.color }}>{meta.icon}</span>
                <h3 className="font-headline font-bold text-lg">{plan.name}</h3>
              </div>

              <p className="text-xs mb-4" style={{ color: '#c2c6d6' }}>{meta.tagline}</p>

              <div className="mb-4">
                {price > 0 ? (
                  <>
                    <span className="text-3xl font-headline font-extrabold">${price}</span>
                    <span className="text-sm" style={{ color: '#c2c6d6' }}>/mo</span>
                  </>
                ) : (
                  <span className="text-2xl font-headline font-bold" style={{ color: meta.color }}>
                    Free to start
                  </span>
                )}
                <div className="text-[11px] mt-0.5" style={{ color: '#c2c6d6' }}>
                  {price > 0 ? `${plan.trial_days}-day free trial, then $${price}/mo.` : 'Free credit included. Pay as you go.'}
                </div>
                {plan.trial_days > 0 && (
                  <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: 'rgba(74, 222, 128, 0.12)', color: '#4ade80' }}>
                    {plan.trial_days}-day free trial
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-6 flex-1">
                {meta.features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    {f}
                  </div>
                ))}
              </div>

              <button
                onClick={() => selectPlan(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3 min-h-[44px] rounded-xl text-sm font-semibold transition-all ${meta.ctaStyle} disabled:opacity-50`}>
                {loading === plan.id ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : meta.cta}
              </button>
            </div>
            );
          })}
        </div>

        {/* Skip */}
        <div className="text-center mt-6">
          <button onClick={() => router.push('/dashboard')}
            className="text-xs md:text-sm min-h-[44px] px-4 hover:underline transition" style={{ color: '#c2c6d6' }}>
            Skip for now — you can always upgrade later
          </button>
        </div>
      </div>
    </div>
  );
}
