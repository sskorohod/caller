'use client';
import { useT } from '@/lib/i18n';
import type { Provider, ProviderConfig } from '../_lib/types';
import { PROVIDER_META } from '../_lib/constants';
import { TwilioCard } from './TwilioCard';
import { ProviderCard } from './ProviderCard';

export function ProvidersSection({
  providers,
  providerConfig,
  onReload,
  onConfigChange,
}: {
  providers: Provider[];
  providerConfig: ProviderConfig;
  onReload: () => void;
  onConfigChange: (provider: string, mode: 'platform' | 'own') => void;
}) {
  const t = useT();
  const providerMap = Object.fromEntries(providers.map(p => [p.provider, p]));
  const otherProviders = Object.keys(PROVIDER_META).filter(k => k !== 'twilio');
  const connectedCount = providers.filter(p => p.is_verified).length;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-[0_2px_8px_rgba(249,115,22,0.3)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--th-text)]">{t('settings.providerCredentials')}</h2>
            <p className="text-xs text-[var(--th-text-muted)]">{t('settings.providersHint')}</p>
          </div>
        </div>

        {/* Connected badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--th-success-bg)] border border-[var(--th-success-border)]">
          <span className="w-2 h-2 rounded-full bg-[var(--th-success-icon)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--th-success-text)]">
            {connectedCount} / {Object.keys(PROVIDER_META).length} {t('settings.connected').toLowerCase()}
          </span>
        </div>
      </div>

      {/* Twilio — full width */}
      <TwilioCard
        existingProvider={providerMap['twilio']}
        providerConfig={providerConfig}
        onSaved={onReload}
        onConfigChange={onConfigChange}
      />

      {/* Other AI providers — full-width on mobile, 2-column on desktop */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {otherProviders.map(key => (
          <ProviderCard
            key={key}
            providerKey={key}
            existingProvider={providerMap[key]}
            providerConfig={providerConfig}
            onSaved={onReload}
            onConfigChange={onConfigChange}
          />
        ))}
      </div>
    </div>
  );
}
