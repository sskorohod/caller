'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n';

const TOTAL_STEPS = 5;

const AI_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-api03-...' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'xai', label: 'xAI (Grok)', placeholder: 'xai-...' },
] as const;

const VOICE_PROVIDERS = [
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'openai', label: 'OpenAI TTS' },
];

const VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'nova', label: 'Nova' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'fable', label: 'Fable' },
];

const LLM_MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'grok-3-mini', label: 'Grok 3 Mini' },
];

function ProgressBar({ step }: { step: number }) {
  const t = useT();
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--th-primary-text)]">
          {t('onboarding.step', { current: String(step), total: String(TOTAL_STEPS) })}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--th-border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--th-primary)] rounded-full transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-border)] p-8 shadow-[0_1px_3px_var(--th-shadow)]">
      {children}
    </div>
  );
}

function NavButtons({
  step,
  onBack,
  onNext,
  onSkip,
  nextLabel,
  loading,
  canSkip = false,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  loading?: boolean;
  canSkip?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between mt-6">
      <div>
        {step > 1 && (
          <button
            onClick={onBack}
            className="px-4 py-2.5 text-sm text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] rounded-lg transition-colors"
          >
            {t('common.back')}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {canSkip && onSkip && (
          <button
            onClick={onSkip}
            className="px-4 py-2.5 text-sm text-[var(--th-text-muted)] hover:text-[var(--th-text-secondary)] transition-colors"
          >
            {t('onboarding.skip')}
          </button>
        )}
        <button
          onClick={onNext}
          disabled={loading}
          className="px-5 py-2.5 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60 active:scale-[.98]"
        >
          {loading ? t('onboarding.saving') : nextLabel ?? t('onboarding.next')}
        </button>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)]
                   placeholder:text-[var(--th-text-muted)] bg-[var(--th-input)]
                   focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]
                   transition-colors"
      />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { workspace, setWorkspace } = useAuth();
  const t = useT();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Workspace name
  const [wsName, setWsName] = useState(workspace?.name ?? '');

  // Step 2: Twilio
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');

  // Step 3: AI Provider
  const [selectedProvider, setSelectedProvider] = useState<string>('anthropic');
  const [providerApiKey, setProviderApiKey] = useState('');

  // Step 4: Agent
  const [agentName, setAgentName] = useState('');
  const [voiceProvider, setVoiceProvider] = useState('elevenlabs');
  const [voice, setVoice] = useState('nova');
  const [llmModel, setLlmModel] = useState('claude-sonnet-4-20250514');

  function back() {
    if (step > 1) setStep(step - 1);
    setError('');
  }

  async function handleStep1() {
    if (!wsName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch<{ id: string; name: string }>('/workspaces/current', { name: wsName.trim() });
      setWorkspace({ id: updated.id, name: updated.name });
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2() {
    if (!accountSid.trim() || !authToken.trim()) {
      setError('Enter both Account SID and Auth Token');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.put<{ is_verified: boolean; verify_error?: string | null }>(
        '/auth/providers/twilio',
        { credentials: { account_sid: accountSid.trim(), auth_token: authToken.trim() } },
      );
      if (res.verify_error) {
        setError(res.verify_error);
      } else {
        setStep(3);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStep3() {
    if (!providerApiKey.trim()) {
      setError('Enter an API key');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/auth/providers/${selectedProvider}`, {
        credentials: { api_key: providerApiKey.trim() },
      });
      setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStep4() {
    if (!agentName.trim()) {
      setError('Enter an agent name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/agents', {
        name: agentName.trim(),
        voice_provider: voiceProvider,
        voice,
        llm_model: llmModel,
      });
      setStep(5);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--th-page)] to-[var(--th-primary-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[var(--th-primary)] rounded-xl flex items-center justify-center shadow-lg shadow-[var(--th-shadow-primary)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-[var(--th-text)] tracking-tight">Caller</span>
        </div>

        <ProgressBar step={step} />

        {/* Step 1: Welcome */}
        {step === 1 && (
          <StepCard>
            <h2 className="text-lg font-bold text-[var(--th-text)] mb-1">{t('onboarding.welcomeTitle')}</h2>
            <p className="text-sm text-[var(--th-text-muted)] mb-6">{t('onboarding.welcomeDesc')}</p>
            <InputField
              label={t('onboarding.workspaceName')}
              value={wsName}
              onChange={setWsName}
              placeholder="Acme Corp"
            />
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
            <NavButtons step={1} onBack={back} onNext={handleStep1} loading={saving} />
          </StepCard>
        )}

        {/* Step 2: Twilio */}
        {step === 2 && (
          <StepCard>
            <h2 className="text-lg font-bold text-[var(--th-text)] mb-1">{t('onboarding.connectTelephony')}</h2>
            <p className="text-sm text-[var(--th-text-muted)] mb-6">{t('onboarding.connectTelephonyDesc')}</p>
            <div className="space-y-4">
              <InputField
                label={t('onboarding.accountSid')}
                value={accountSid}
                onChange={setAccountSid}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <InputField
                label={t('onboarding.authToken')}
                value={authToken}
                onChange={setAuthToken}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                type="password"
              />
            </div>
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
            <NavButtons
              step={2}
              onBack={back}
              onNext={handleStep2}
              onSkip={() => { setError(''); setStep(3); }}
              canSkip
              loading={saving}
            />
          </StepCard>
        )}

        {/* Step 3: AI Provider */}
        {step === 3 && (
          <StepCard>
            <h2 className="text-lg font-bold text-[var(--th-text)] mb-1">{t('onboarding.addAiProvider')}</h2>
            <p className="text-sm text-[var(--th-text-muted)] mb-6">{t('onboarding.addAiProviderDesc')}</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                  {t('onboarding.selectProvider')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {AI_PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProvider(p.id); setProviderApiKey(''); }}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        selectedProvider === p.id
                          ? 'border-[var(--th-primary)] bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]'
                          : 'border-[var(--th-border)] text-[var(--th-text-secondary)] hover:border-[var(--th-primary)]'
                      }`}
                    >
                      {p.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <InputField
                label={t('onboarding.apiKey')}
                value={providerApiKey}
                onChange={setProviderApiKey}
                placeholder={AI_PROVIDERS.find(p => p.id === selectedProvider)?.placeholder}
                type="password"
              />
            </div>
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
            <NavButtons
              step={3}
              onBack={back}
              onNext={handleStep3}
              onSkip={() => { setError(''); setStep(4); }}
              canSkip
              loading={saving}
            />
          </StepCard>
        )}

        {/* Step 4: Create Agent */}
        {step === 4 && (
          <StepCard>
            <h2 className="text-lg font-bold text-[var(--th-text)] mb-1">{t('onboarding.createFirstAgent')}</h2>
            <p className="text-sm text-[var(--th-text-muted)] mb-6">{t('onboarding.createFirstAgentDesc')}</p>
            <div className="space-y-4">
              <InputField
                label={t('onboarding.agentName')}
                value={agentName}
                onChange={setAgentName}
                placeholder="My First Agent"
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                    {t('onboarding.voiceProvider')}
                  </label>
                  <select
                    value={voiceProvider}
                    onChange={e => setVoiceProvider(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                  >
                    {VOICE_PROVIDERS.map(v => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                    {t('onboarding.voice')}
                  </label>
                  <select
                    value={voice}
                    onChange={e => setVoice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                  >
                    {VOICES.map(v => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--th-text-secondary)] uppercase tracking-wide">
                  {t('onboarding.llmModel')}
                </label>
                <select
                  value={llmModel}
                  onChange={e => setLlmModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--th-border)] text-sm text-[var(--th-text)] bg-[var(--th-input)] focus:outline-none focus:ring-2 focus:ring-[var(--th-primary)]/20 focus:border-[var(--th-primary)]"
                >
                  {LLM_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
            <NavButtons
              step={4}
              onBack={back}
              onNext={handleStep4}
              onSkip={() => { setError(''); setStep(5); }}
              canSkip
              loading={saving}
            />
          </StepCard>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <StepCard>
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-[var(--th-success-bg)] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-[var(--th-success-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--th-text)] mb-2">{t('onboarding.doneTitle')}</h2>
              <p className="text-sm text-[var(--th-text-muted)] mb-8">{t('onboarding.doneDesc')}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-white font-semibold rounded-xl text-sm transition-all active:scale-[.98] shadow-lg shadow-[var(--th-shadow-primary)]"
              >
                {t('onboarding.goToDashboard')}
              </button>
            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}
