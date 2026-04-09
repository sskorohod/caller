'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import type { Provider, TwilioPhone, TelephonyConnection, SimpleAgent, ProviderConfig } from '../_lib/types';
import { IconCheck } from '../_lib/icons';
import { Field } from './shared/Field';

export function TwilioCard({
  existingProvider,
  providerConfig,
  onSaved,
  onConfigChange,
}: {
  existingProvider: Provider | undefined;
  providerConfig: ProviderConfig;
  onSaved: () => void;
  onConfigChange: (provider: string, mode: 'platform' | 'own') => void;
}) {
  const t = useT();
  const toast = useToast();
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [phones, setPhones] = useState<TwilioPhone[]>([]);
  const [connections, setConnections] = useState<TelephonyConnection[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<TelephonyConnection | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [phoneAgents, setPhoneAgents] = useState<SimpleAgent[]>([]);

  const mode = providerConfig['twilio'] || 'platform';
  const isConnected = existingProvider?.is_verified === true;

  const loadPhones = useCallback(() => {
    setLoadingPhones(true);
    Promise.all([
      api.get<TwilioPhone[]>('/telephony/numbers').catch(() => []),
      api.get<TelephonyConnection[]>('/telephony/connections').catch(() => []),
    ]).then(([nums, conns]) => {
      setPhones(Array.isArray(nums) ? nums : []);
      setConnections(Array.isArray(conns) ? conns : []);
    }).finally(() => setLoadingPhones(false));
  }, []);

  useEffect(() => {
    if (isConnected) loadPhones();
  }, [isConnected, loadPhones]);

  useEffect(() => {
    api.get<{ agents: SimpleAgent[] }>('/agents').then(r => setPhoneAgents(r?.agents ?? [])).catch(() => {});
  }, []);

  async function handleSave() {
    if (!accountSid.trim() || !authToken.trim()) {
      setError('Enter Account SID and Auth Token');
      return;
    }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await api.put<{
        is_verified: boolean;
        phone_numbers?: TwilioPhone[];
        verify_error?: string | null;
      }>('/auth/providers/twilio', {
        credentials: { account_sid: accountSid.trim(), auth_token: authToken.trim() },
      });

      if (res.verify_error) {
        setError(res.verify_error);
      } else {
        setSaved(true);
        toast.success(t('toast.providerSaved'));
        setAccountSid('');
        setAuthToken('');
        setPhones(res.phone_numbers ?? []);
        onSaved();
        api.get<TelephonyConnection[]>('/telephony/connections').then(c => setConnections(Array.isArray(c) ? c : []));
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(phone: TwilioPhone) {
    setActivating(phone.phone_number);
    try {
      await api.post('/telephony/connections', {
        phone_number: phone.phone_number,
        friendly_name: phone.friendly_name,
        twilio_sid: phone.sid,
        inbound_enabled: true,
        outbound_enabled: true,
      });
      loadPhones();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActivating(null);
    }
  }

  async function handleDeactivateConfirm() {
    if (!confirmDeactivate) return;
    try {
      await api.delete(`/telephony/connections/${confirmDeactivate.id}`);
      setConfirmDeactivate(null);
      loadPhones();
    } catch (e: any) {
      setError(e.message);
      setConfirmDeactivate(null);
    }
  }

  async function handleDisconnectConfirm() {
    try {
      await api.delete('/auth/providers/twilio');
      setPhones([]);
      setConnections([]);
      setConfirmDisconnect(false);
      onSaved();
    } catch (e: any) {
      setError(e.message);
      setConfirmDisconnect(false);
    }
  }

  async function updateConnection(connId: string, updates: Record<string, unknown>) {
    try {
      await api.patch(`/telephony/connections/${connId}`, updates);
      api.get<TelephonyConnection[]>('/telephony/connections').then(c => setConnections(Array.isArray(c) ? c : []));
    } catch (e: any) { setError(e.message); }
  }

  const activeNumbers = new Set(connections.map(c => c.phone_number));

  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-5 col-span-2 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold bg-[#f22f46]/10 text-[#f22f46]">
            TW
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--th-text)]">Twilio</div>
            {isConnected ? (
              <div className="flex items-center gap-1.5 text-xs text-[var(--th-success-text)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--th-success-icon)]" />
                {t('settings.connected')} · {phones.length} number{phones.length !== 1 ? 's' : ''} in account
              </div>
            ) : (
              <div className="text-xs text-[var(--th-text-muted)]">{t('settings.notConfigured')}</div>
            )}
          </div>
        </div>
        {isConnected && (
          confirmDisconnect ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--th-text-muted)]">All connections will stop.</span>
              <button onClick={handleDisconnectConfirm} className="text-xs text-[var(--th-error-text)] font-medium transition-colors">{t('settings.confirm')}</button>
              <button onClick={() => setConfirmDisconnect(false)} className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] font-medium transition-colors">{t('common.cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDisconnect(true)} className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors font-medium">
              Disconnect
            </button>
          )
        )}
      </div>

      {/* Platform / Own toggle */}
      <div className="flex items-center gap-1 mb-4 p-0.5 bg-[var(--th-surface)] rounded-lg border border-[var(--th-card-border-subtle)]">
        {(['platform', 'own'] as const).map(m => (
          <button
            key={m}
            onClick={() => onConfigChange('twilio', m)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
              mode === m
                ? 'bg-[var(--th-card)] text-[var(--th-text)] shadow-sm'
                : 'text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)]'
            }`}
          >
            {m === 'platform' ? t('settings.usePlatform') || 'Platform' : t('settings.useOwnKey') || 'Own Key'}
          </button>
        ))}
      </div>

      {mode === 'own' ? (
        <>
          {/* Credentials form */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Account SID"
              value={accountSid}
              onChange={setAccountSid}
              placeholder={isConnected ? '••••••••••••••••••••' : 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
            />
            <Field
              label="Auth Token"
              value={authToken}
              onChange={setAuthToken}
              placeholder={isConnected ? '••••••••••••••••' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
              type="password"
            />
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs">
              {error && <span className="text-[var(--th-error-text)]">{error}</span>}
              {saved && <span className="text-[var(--th-success-text)] flex items-center gap-1"><IconCheck className="w-3 h-3" />{t('settings.saved')}</span>}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-2 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 active:scale-[.98]"
            >
              {saving ? t('settings.saving') : isConnected ? t('settings.update') : 'Connect Twilio'}
            </button>
          </div>

          {/* Phone numbers list */}
          {isConnected && (
            <div className="mt-5 pt-5 border-t border-[var(--th-card-border-subtle)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                  {t('settings.twilioPhones') || 'Phone Numbers'}
                </p>
                <button onClick={loadPhones} className="text-xs text-[var(--th-primary-text)] hover:text-[var(--th-primary-hover)]">
                  Refresh
                </button>
              </div>

              {loadingPhones ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-12 bg-[var(--th-skeleton)] rounded-lg animate-pulse" />)}
                </div>
              ) : phones.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-[var(--th-surface)] rounded-xl border border-dashed border-[var(--th-card-border-subtle)]">
                  <svg className="w-5 h-5 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[var(--th-text-secondary)]">{t('settings.noPhones')}</p>
                    <p className="text-xs text-[var(--th-text-muted)]">Buy a number in the Twilio Console first</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {phones.map(phone => {
                    const isActive = activeNumbers.has(phone.phone_number);
                    const conn = connections.find(c => c.phone_number === phone.phone_number);
                    return (
                      <div key={phone.sid} className="space-y-0">
                        <div
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                            isActive
                              ? 'bg-[var(--th-success-bg)] border-[var(--th-success-border)]'
                              : 'bg-[var(--th-surface)] border-[var(--th-card-border-subtle)] hover:border-[var(--th-primary-muted)]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isActive ? (
                              <div className="w-7 h-7 bg-[var(--th-success-bg-strong)] rounded-full flex items-center justify-center shrink-0">
                                <IconCheck className="w-3.5 h-3.5 text-[var(--th-success-dark)]" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 bg-[var(--th-surface)] rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-3.5 h-3.5 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372..." />
                                </svg>
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-semibold text-[var(--th-text)]">{phone.phone_number}</div>
                              <div className="text-xs text-[var(--th-text-muted)]">{phone.friendly_name !== phone.phone_number ? phone.friendly_name : 'Voice enabled'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isActive ? (
                              confirmDeactivate?.id === conn?.id ? (
                                <div className="flex items-center gap-2">
                                  <button onClick={handleDeactivateConfirm} className="text-xs text-[var(--th-error-text)] font-medium transition-colors">{t('settings.confirm')}</button>
                                  <button onClick={() => setConfirmDeactivate(null)} className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] font-medium transition-colors">{t('common.cancel')}</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => conn && setConfirmDeactivate(conn)}
                                  className="text-xs text-[var(--th-text-muted)] hover:text-[var(--th-error-text)] transition-colors"
                                >
                                  Remove
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => handleActivate(phone)}
                                disabled={activating === phone.phone_number}
                                className="px-3 py-1.5 bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                              >
                                {activating === phone.phone_number ? '...' : 'Use this number'}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Agent assignment + AI toggle */}
                        {isActive && conn && (
                          <div className="flex items-center gap-3 mt-2 ml-10 pl-4 border-l-2 border-[var(--th-card-border-subtle)]">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[var(--th-text-muted)] uppercase font-semibold">AI</span>
                              <button
                                onClick={() => updateConnection(conn.id, { ai_answering_enabled: !conn.ai_answering_enabled })}
                                className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${conn.ai_answering_enabled ? 'bg-[var(--th-primary)]' : 'bg-[var(--th-border)]'}`}
                                aria-label="Toggle AI answering"
                              >
                                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${conn.ai_answering_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>
                            <select
                              value={conn.default_agent_profile_id ?? ''}
                              onChange={e => updateConnection(conn.id, { default_agent_profile_id: e.target.value || null })}
                              className="text-xs px-2 py-1 rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] text-[var(--th-text)] focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)] transition-all"
                            >
                              <option value="">No agent</option>
                              {phoneAgents.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-[var(--th-text-muted)] italic">
          {t('settings.platformModeHint') || 'Using platform-managed credentials. Usage is billed to your account.'}
        </p>
      )}
    </div>
  );
}
