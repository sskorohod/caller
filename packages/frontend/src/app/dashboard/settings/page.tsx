'use client';
import { useSettingsData } from './_lib/useSettingsData';
import { SettingsSkeleton } from './_components/SettingsSkeleton';
import { GeneralSection } from './_components/GeneralSection';
import { TelegramSection } from './_components/TelegramSection';
import { AppearanceSection } from './_components/AppearanceSection';
import { DangerZone } from './_components/DangerZone';

export default function SettingsPage() {
  const { workspace, loading, handleWorkspaceUpdate } = useSettingsData();

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-8 max-w-3xl">
      <GeneralSection workspace={workspace} onUpdated={handleWorkspaceUpdate} />
      <TelegramSection />
      <AppearanceSection />
      <DangerZone />
    </div>
  );
}
