'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SectionId } from './_lib/types';
import { useSettingsData } from './_lib/useSettingsData';

import { SettingsSkeleton } from './_components/SettingsSkeleton';
import { SettingsNav } from './_components/SettingsNav';
import { GeneralSection } from './_components/GeneralSection';
import { AppearanceSection } from './_components/AppearanceSection';
import { ProvidersSection } from './_components/ProvidersSection';
import { ApiKeysSection } from './_components/ApiKeysSection';
import { OAuthSection } from './_components/OAuthSection';
import { ComplianceSection } from './_components/ComplianceSection';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialSection = (searchParams.get('section') as SectionId) || 'general';
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);

  const {
    workspace,
    providers,
    providerConfig,
    loading,
    plan,
    reloadProviders,
    handleWorkspaceUpdate,
    updateProviderConfig,
  } = useSettingsData();

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="flex flex-col md:flex-row gap-5 md:gap-7 min-h-full">
      <SettingsNav activeSection={activeSection} onSelect={setActiveSection} plan={plan} />

      <div className="flex-1 min-w-0 pb-8">
        {activeSection === 'general' && (
          <GeneralSection workspace={workspace} onUpdated={handleWorkspaceUpdate} />
        )}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'providers' && (
          <ProvidersSection
            providers={providers}
            providerConfig={providerConfig}
            onReload={reloadProviders}
            onConfigChange={updateProviderConfig}
          />
        )}
        {activeSection === 'api-keys' && <ApiKeysSection />}
        {activeSection === 'oauth' && <OAuthSection />}
        {activeSection === 'compliance' && (
          <ComplianceSection workspace={workspace} onUpdated={handleWorkspaceUpdate} />
        )}
      </div>
    </div>
  );
}
