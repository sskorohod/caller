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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--th-text)]">{t('settings.providerCredentials')}</h3>
        <p className="text-xs text-[var(--th-text-muted)] mt-1">
          {t('settings.providersHint') || 'Configure API credentials and choose between platform-managed or your own keys.'}
        </p>
      </div>

      {/* Twilio — full width */}
      <TwilioCard
        existingProvider={providerMap['twilio']}
        providerConfig={providerConfig}
        onSaved={onReload}
        onConfigChange={onConfigChange}
      />

      {/* Other AI providers — 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
