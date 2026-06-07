'use client';
import { useSettingsData } from './_lib/useSettingsData';
import { SettingsSkeleton } from './_components/SettingsSkeleton';
import { GeneralSection } from './_components/GeneralSection';
import { AppearanceSection } from './_components/AppearanceSection';

export default function SettingsPage() {
  const { workspace, loading, handleWorkspaceUpdate } = useSettingsData();

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-8 max-w-3xl">
      <GeneralSection workspace={workspace} onUpdated={handleWorkspaceUpdate} />
      <AppearanceSection />
    </div>
  );
}
