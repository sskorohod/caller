'use client';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';
import { useSettingsData } from './_lib/useSettingsData';
import { SettingsSkeleton } from './_components/SettingsSkeleton';
import { SettingsNav } from './_components/SettingsNav';
import { GeneralSection } from './_components/GeneralSection';
import { TelegramSection } from './_components/TelegramSection';
import { AppearanceSection } from './_components/AppearanceSection';
import { DangerZone } from './_components/DangerZone';

export default function SettingsPage() {
  const t = useT();
  const { user } = useAuth();
  const { workspace, loading, handleWorkspaceUpdate } = useSettingsData();

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="max-w-5xl pb-10">
      {/* Page header */}
      <header className="mb-5 md:mb-7">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--th-text)]">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--th-text-muted)]">
          {t('settings.subtitle')}
          {user?.email && (
            <>
              {' · '}
              <span className="font-medium text-[var(--th-text-secondary)]">{user.email}</span>
            </>
          )}
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        <SettingsNav />
        <div className="space-y-4 md:space-y-5 min-w-0">
          <GeneralSection workspace={workspace} onUpdated={handleWorkspaceUpdate} />
          <TelegramSection />
          <AppearanceSection />
          <DangerZone />
        </div>
      </div>
    </div>
  );
}
