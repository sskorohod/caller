'use client';
import { useEffect, useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import type { BillingSettings, PlatformSettings, PricingConfig, PricingTables } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFormField, { adminInputClass } from '../_components/AdminFormField';
import AdminErrorState from '../_components/AdminErrorState';

const cardStyle = {
  background: 'var(--th-card)',
  border: '1px solid var(--th-card-border-subtle)',
  boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
} as const;

// Settings values may be raw numbers or legacy JSON-encoded strings ('"3.0"')
function decodeNumeric(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    try { return String(JSON.parse(v)); } catch { return v; }
  }
  return '';
}

function SaveButton({ busy, saved, onClick, label = 'Save' }: { busy: boolean; saved: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onClick} disabled={busy} className="btn-primary px-5 py-2 text-sm font-medium disabled:opacity-50">
        {busy ? 'Saving…' : label}
      </button>
      {saved && (
        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--th-success-text)' }}>
          <span className="material-symbols-outlined text-[15px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Saved
        </span>
      )}
    </div>
  );
}

// ─── Billing card ──────────────────────────────────────────────────────────

const BILLING_FIELDS = [
  { key: 'billing_markup', label: 'Markup (×)', hint: 'Client price = provider cost × markup. Applies immediately.', step: '0.1', min: 1 },
  { key: 'billing_signup_bonus_usd', label: 'Signup bonus ($)', hint: 'Welcome gift for new subscribers with a clean phone number.', step: '0.5', min: 0 },
  { key: 'billing_personal_number_monthly_usd', label: 'Personal number ($/mo)', hint: 'Monthly rental price for a personal Twilio number.', step: '0.5', min: 0 },
  { key: 'billing_low_balance_threshold', label: 'Low-balance threshold ($)', hint: 'Dashboard alert + Subscribers filter flag balances at or below this. Must be above 0.', step: '0.5', min: 0.5 },
] as const;

function BillingCard() {
  const { data, loading, error, refetch } = useAdminQuery<BillingSettings>(
    () => api.get<BillingSettings>('/admin/billing-settings'),
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const f of BILLING_FIELDS) next[f.key] = decodeNumeric(data[f.key]);
    setValues(next);
  }, [data]);

  async function save() {
    setBusy(true); setErr(''); setSaved(false);
    try {
      const body: Record<string, number> = {};
      for (const f of BILLING_FIELDS) {
        const v = parseFloat(values[f.key]);
        if (Number.isFinite(v)) body[f.key] = v;
      }
      await api.put('/admin/billing-settings', body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      refetch();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    setBusy(false);
  }

  return (
    <div className="rounded-xl p-4 md:p-5 space-y-4" style={cardStyle}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--th-text)' }}>Billing</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted)' }}>
          Live platform billing parameters. Changes apply immediately.
        </p>
      </div>
      {loading ? (
        <div className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--th-surface)' }} />
      ) : error ? (
        <AdminErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BILLING_FIELDS.map(f => (
              <AdminFormField key={f.key} label={f.label}>
                <input
                  type="number" step={f.step} min={f.min}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  className={adminInputClass}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--th-text-muted)' }}>{f.hint}</p>
              </AdminFormField>
            ))}
          </div>
          {err && <p className="text-xs" style={{ color: 'var(--th-error-text)' }}>{err}</p>}
          <SaveButton busy={busy} saved={saved} onClick={save} />
        </>
      )}
    </div>
  );
}

// ─── Greeting card ─────────────────────────────────────────────────────────

function GreetingCard() {
  const { data, loading, error, refetch } = useAdminQuery<{ settings: PlatformSettings }>(
    () => api.get<{ settings: PlatformSettings }>('/admin/settings'),
  );
  const [greeting, setGreeting] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const g = data?.settings?.default_greeting;
    if (typeof g === 'string') setGreeting(g);
  }, [data]);

  async function save() {
    setBusy(true); setErr(''); setSaved(false);
    try {
      await api.put('/admin/settings', { default_greeting: greeting.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { setErr(e.message || 'Failed'); }
    setBusy(false);
  }

  return (
    <div className="rounded-xl p-4 md:p-5 space-y-4" style={cardStyle}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--th-text)' }}>Default greeting</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted)' }}>
          Spoken at the start of a call when a subscriber hasn&apos;t set their own greeting. Leave empty to use the built-in default.
        </p>
      </div>
      {loading ? (
        <div className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--th-surface)' }} />
      ) : error ? (
        <AdminErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <textarea
            value={greeting}
            onChange={e => setGreeting(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Hi, I'm your AI interpreter. Please go ahead."
            className={adminInputClass}
          />
          <div className="flex items-center justify-between">
            {err ? <p className="text-xs" style={{ color: 'var(--th-error-text)' }}>{err}</p> : <span />}
            <span className="text-[11px]" style={{ color: 'var(--th-text-muted)' }}>{greeting.length}/500</span>
          </div>
          <SaveButton busy={busy} saved={saved} onClick={save} />
        </>
      )}
    </div>
  );
}

// ─── Provider pricing card ─────────────────────────────────────────────────

type FlatOverrides = Record<string, string>; // "tts.xai" → "0.02"; "llm.gpt-4o.inputPer1M" → "2.5"

function flattenOverrides(o: Partial<PricingTables>): FlatOverrides {
  const flat: FlatOverrides = {};
  for (const [provider, v] of Object.entries(o.tts ?? {})) flat[`tts.${provider}`] = String(v);
  for (const [provider, v] of Object.entries(o.stt ?? {})) flat[`stt.${provider}`] = String(v);
  for (const [provider, v] of Object.entries(o.telephony ?? {})) flat[`telephony.${provider}`] = String(v);
  for (const [model, p] of Object.entries(o.llm ?? {})) {
    flat[`llm.${model}.inputPer1M`] = String(p.inputPer1M);
    flat[`llm.${model}.outputPer1M`] = String(p.outputPer1M);
  }
  return flat;
}

function buildOverrides(flat: FlatOverrides, defaults: PricingTables): Partial<PricingTables> {
  const out: Partial<PricingTables> = {};
  const num = (raw: string | undefined): number | null => {
    if (raw == null) return null;
    const v = parseFloat(raw);
    return Number.isFinite(v) && v >= 0 ? v : null;
  };

  // Scalar sections
  for (const [key, raw] of Object.entries(flat)) {
    const v = num(raw);
    if (v == null) continue;
    const parts = key.split('.');
    if (parts[0] === 'llm') continue; // handled below
    const section = parts[0] as 'tts' | 'stt' | 'telephony';
    const provider = parts.slice(1).join('.');
    (out[section] = out[section] ?? {})[provider] = v;
  }

  // LLM: the schema requires BOTH fields — fill the untouched twin from default
  const llmModels = new Set(
    Object.keys(flat)
      .filter(k => k.startsWith('llm.'))
      .map(k => k.replace(/^llm\./, '').replace(/\.(inputPer1M|outputPer1M)$/, '')),
  );
  for (const model of llmModels) {
    const input = num(flat[`llm.${model}.inputPer1M`]);
    const output = num(flat[`llm.${model}.outputPer1M`]);
    if (input == null && output == null) continue;
    out.llm = out.llm ?? {};
    out.llm[model] = {
      inputPer1M: input ?? defaults.llm[model]?.inputPer1M ?? 0,
      outputPer1M: output ?? defaults.llm[model]?.outputPer1M ?? 0,
    };
  }
  return out;
}

function PricingCard() {
  const { data, loading, error, refetch } = useAdminQuery<PricingConfig>(
    () => api.get<PricingConfig>('/admin/pricing'),
  );
  const [flat, setFlat] = useState<FlatOverrides>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (data) setFlat(flattenOverrides(data.overrides ?? {}));
  }, [data]);

  async function save(overrides: Partial<PricingTables>) {
    setBusy(true); setErr(''); setSaved(false);
    try {
      await api.put('/admin/settings', { pricing: overrides });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      refetch();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    setBusy(false);
  }

  if (loading) {
    return <div className="rounded-xl p-4 md:p-5" style={cardStyle}><div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--th-surface)' }} /></div>;
  }
  if (error || !data) {
    return <div className="rounded-xl p-4 md:p-5" style={cardStyle}><AdminErrorState error={error || 'Failed'} onRetry={refetch} /></div>;
  }

  const { defaults } = data;
  const overrideCount = Object.keys(flat).filter(k => flat[k] !== '').length;

  const numberCell = (key: string, defaultValue: number) => (
    <input
      type="number" step="0.0001" min="0"
      value={flat[key] ?? ''}
      placeholder={String(defaultValue)}
      onChange={e => setFlat(f => {
        const next = { ...f };
        if (e.target.value === '') delete next[key];
        else next[key] = e.target.value;
        return next;
      })}
      className={`${adminInputClass} !py-1.5 text-xs font-mono`}
    />
  );

  const sectionHeader = (title: string, unit: string) => (
    <div className="flex items-baseline justify-between mt-1">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>{title}</h4>
      <span className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>{unit}</span>
    </div>
  );

  return (
    <div className="rounded-xl p-4 md:p-5 space-y-4" style={cardStyle}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--th-text)' }}>Provider pricing overrides</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted)' }}>
          Provider unit costs used for billing. Empty field = built-in default (shown as placeholder). Applies without a restart.
        </p>
      </div>

      {sectionHeader('Speech-to-text', '$ / minute')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(defaults.stt).map(([provider, def]) => (
          <AdminFormField key={provider} label={provider}>{numberCell(`stt.${provider}`, def)}</AdminFormField>
        ))}
      </div>

      {sectionHeader('Text-to-speech', '$ / 1K characters')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(defaults.tts).map(([provider, def]) => (
          <AdminFormField key={provider} label={provider}>{numberCell(`tts.${provider}`, def)}</AdminFormField>
        ))}
      </div>

      {sectionHeader('Telephony', '$ / minute')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(defaults.telephony).map(([provider, def]) => (
          <AdminFormField key={provider} label={provider}>{numberCell(`telephony.${provider}`, def)}</AdminFormField>
        ))}
      </div>

      {sectionHeader('LLM', '$ / 1M tokens (input / output)')}
      <div className="space-y-1.5">
        {Object.entries(defaults.llm).map(([model, def]) => (
          <div key={model} className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-2 items-center">
            <span className="text-xs font-mono truncate" style={{ color: 'var(--th-text-secondary)' }}>{model}</span>
            {numberCell(`llm.${model}.inputPer1M`, def.inputPer1M)}
            {numberCell(`llm.${model}.outputPer1M`, def.outputPer1M)}
          </div>
        ))}
      </div>

      {err && <p className="text-xs" style={{ color: 'var(--th-error-text)' }}>{err}</p>}
      <div className="flex items-center justify-between">
        <SaveButton busy={busy} saved={saved} onClick={() => save(buildOverrides(flat, defaults))} label={`Save overrides${overrideCount ? ` (${overrideCount})` : ''}`} />
        <button
          onClick={() => { setFlat({}); save({}); }}
          disabled={busy}
          className="px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-50"
          style={{ background: 'var(--th-card)', color: 'var(--th-text-secondary)', border: '1px solid var(--th-border)' }}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  return (
    <div className="py-4 md:py-6 space-y-5 md:space-y-6 max-w-3xl">
      <AdminPageHeader
        title="Settings"
        subtitle="Platform billing, defaults, and provider pricing"
        icon="settings"
      />
      <BillingCard />
      <GreetingCard />
      <PricingCard />
    </div>
  );
}
