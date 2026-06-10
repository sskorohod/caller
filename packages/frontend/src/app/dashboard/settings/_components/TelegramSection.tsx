'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface TgStatus { connected: boolean; paired: boolean; masked_token: string | null }

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

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-[var(--th-card-border-subtle)] text-sm text-[var(--th-text)] bg-[var(--th-card)] placeholder:text-[var(--th-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all";
  const btnCls = "px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50";

  return (
    <div className="space-y-3 md:space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--th-text)]">{t('settings.telegram.title')}</h2>
        <p className="text-sm text-[var(--th-text-muted)] mt-1">{t('settings.telegram.desc')}</p>
      </div>

      <div className="relative overflow-hidden bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
        <div className="p-4 md:p-6 space-y-4">
          {!status ? (
            <div className="h-10 rounded-xl bg-[var(--th-surface)] animate-pulse" />
          ) : !status.connected ? (
            <>
              <ol className="space-y-1.5">
                {[t('settings.telegram.how1'), t('settings.telegram.how2'), t('settings.telegram.how3')].map((step, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-snug text-[var(--th-text-secondary)]">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-[var(--th-primary-bg)] text-[var(--th-primary)] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <input type="password" value={token} onChange={e => setToken(e.target.value)}
                  placeholder={t('settings.telegram.tokenPlaceholder')} className={inputCls} />
                <button onClick={connect} disabled={busy || !token.trim()}
                  className={btnCls + ' shrink-0 bg-[var(--th-primary)] text-white hover:opacity-90'}>
                  {t('settings.telegram.connect')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                {status.paired ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--th-success-text)]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {t('settings.telegram.paired')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#fbbf24' }}>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    {t('settings.telegram.awaiting')}
                  </span>
                )}
                <span className="text-xs text-[var(--th-text-muted)] ml-auto font-mono">{status.masked_token}</span>
              </div>
              <p className="text-[12px] leading-snug text-[var(--th-text-muted)]">{t('settings.telegram.whatYouGet')}</p>
              <div className="flex gap-2">
                {status.paired && (
                  <button onClick={sendTest} disabled={busy}
                    className={btnCls + ' border border-[var(--th-card-border-subtle)] text-[var(--th-text)] hover:bg-[var(--th-surface)]'}>
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
      </div>
    </div>
  );
}
