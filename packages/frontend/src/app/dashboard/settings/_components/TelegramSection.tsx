'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { SectionCard } from './SectionCard';

interface TgStatus { connected: boolean; paired: boolean; masked_token: string | null }

function StatusPill({ status, t }: { status: TgStatus | null; t: (k: string) => string }) {
  if (!status) return null;
  if (!status.connected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ background: 'var(--th-surface)', color: 'var(--th-text-muted)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--th-text-muted)]" />
        {t('settings.notConfigured')}
      </span>
    );
  }
  if (status.paired) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ background: 'var(--th-success-bg)', color: 'var(--th-success-text)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {t('settings.telegram.paired')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {t('settings.telegram.awaitingShort')}
    </span>
  );
}

export function TelegramSection() {
  const t = useT();
  const [status, setStatus] = useState<TgStatus | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const load = () => api.get<TgStatus>('/workspaces/telegram').then(setStatus).catch(() => setStatus({ connected: false, paired: false, masked_token: null }));
  useEffect(() => { load(); }, []);

  // While awaiting pairing, poll so the status flips to "paired" right after
  // the user presses Start in Telegram.
  useEffect(() => {
    if (!status?.connected || status.paired) return;
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [status?.connected, status?.paired]);

  async function connect() {
    if (!token.trim()) return;
    setBusy(true); setError('');
    try {
      await api.put('/workspaces/telegram', { bot_token: token.trim() });
      setToken('');
      await load();
    } catch (e: any) { setError(e.message || 'Failed'); }
    setBusy(false);
  }

  async function disconnect() {
    setBusy(true); setError('');
    try { await api.delete('/workspaces/telegram'); await load(); }
    catch (e: any) { setError(e.message || 'Failed'); }
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true); setTestResult(null);
    try { await api.post('/workspaces/test-telegram', {}); setTestResult('ok'); }
    catch { setTestResult('fail'); }
    setBusy(false);
    setTimeout(() => setTestResult(null), 4000);
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-input-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all";
  const btnCls = "px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50";

  return (
    <SectionCard
      id="notifications"
      icon="notifications"
      tint="sky"
      title={t('settings.telegram.title')}
      description={t('settings.telegram.desc')}
      badge={<StatusPill status={status} t={t} />}
    >
      <div className="space-y-4">
        {!status ? (
          <div className="h-10 rounded-xl bg-[var(--th-surface)] animate-pulse" />
        ) : !status.connected ? (
          <>
            <ol className="rounded-xl p-3.5 space-y-2" style={{ background: 'var(--th-surface)' }}>
              {[t('settings.telegram.how1'), t('settings.telegram.how2'), t('settings.telegram.how3')].map((step, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-[var(--th-text-secondary)]">
                  <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-[var(--th-primary-bg)] text-[var(--th-primary)] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="password" value={token} onChange={e => setToken(e.target.value)}
                placeholder={t('settings.telegram.tokenPlaceholder')} className={inputCls} />
              <button onClick={connect} disabled={busy || !token.trim()}
                className="btn-primary shrink-0 px-5 py-2 min-h-[38px] text-sm">
                {t('settings.telegram.connect')}
              </button>
            </div>
          </>
        ) : (
          <>
            {!status.paired && (
              <div className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12px] leading-snug"
                style={{ background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-border)' }}>
                <span className="material-symbols-outlined text-[16px] leading-none mt-0.5">hourglass_top</span>
                <span>{t('settings.telegram.awaiting')}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-[var(--th-text-muted)]">
              <span className="material-symbols-outlined text-[16px] leading-none">smart_toy</span>
              <span className="font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--th-code-bg)', color: 'var(--th-code-text)' }}>
                {status.masked_token}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--th-text-muted)]">{t('settings.telegram.whatYouGet')}</p>
            <div className="flex flex-wrap gap-2">
              {status.paired && (
                <button onClick={sendTest} disabled={busy}
                  className={btnCls + (testResult === 'ok'
                    ? ' border border-[var(--th-success-border)] text-[var(--th-success-text)] bg-[var(--th-success-bg)]'
                    : ' border border-[var(--th-card-border-subtle)] text-[var(--th-text)] hover:bg-[var(--th-surface)]')}>
                  {testResult === 'ok' ? '✓ ' + t('settings.telegram.testOk') : testResult === 'fail' ? t('settings.telegram.testFail') : t('settings.telegram.test')}
                </button>
              )}
              <button onClick={disconnect} disabled={busy}
                className={btnCls + ' border border-red-500/30 text-red-400 hover:bg-red-500/10'}>
                {t('settings.telegram.disconnect')}
              </button>
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </SectionCard>
  );
}
