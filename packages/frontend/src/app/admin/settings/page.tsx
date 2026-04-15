'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import type { PlatformSettings } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFormField, { adminInputClass, adminSelectClass } from '../_components/AdminFormField';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

export default function SettingsPage() {
  // Controlled form state
  const [pricePerMin, setPricePerMin] = useState('0.15');
  const [greeting, setGreeting] = useState('');
  const [ttsProvider, setTtsProvider] = useState('elevenlabs');
  const [langMy, setLangMy] = useState('ru');
  const [langTarget, setLangTarget] = useState('en');
  const [bundles, setBundles] = useState<Array<{ name: string; minutes: number; price: number }>>([]);

  const [saving, setSaving] = useState<string | null>(null);

  const { loading, error, refetch } = useAdminQuery<PlatformSettings>(
    async () => {
      const r = await api.get<{ settings: PlatformSettings }>('/admin/settings');
      const s = r.settings;
      if (typeof s.pricing_per_minute === 'string') setPricePerMin(s.pricing_per_minute);
      if (typeof s.default_greeting === 'string') setGreeting(s.default_greeting);
      if (typeof s.default_tts_provider === 'string') setTtsProvider(s.default_tts_provider);
      if (s.default_languages) {
        if (s.default_languages.my) setLangMy(s.default_languages.my);
        if (s.default_languages.target) setLangTarget(s.default_languages.target);
      }
      if (Array.isArray(s.bundles)) setBundles(s.bundles);
      return s;
    },
    [],
  );

  const save = async (keys: Partial<PlatformSettings>, section: string) => {
    setSaving(section);
    try {
      await api.put('/admin/settings', keys);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(null);
  };

  if (loading) return <AdminLoadingState rows={4} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  return (
    <div className="px-3 py-4 md:p-6 space-y-4 md:space-y-6">
      <AdminPageHeader
        title="Settings"
        subtitle="Platform-wide pricing and default configuration"
        icon="settings"
      />

      {/* Pricing */}
      <div className="glass-panel rounded-2xl p-4 md:p-6">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--th-primary-light)' }}>Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <AdminFormField label="Price per minute ($)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={pricePerMin}
              onChange={e => setPricePerMin(e.target.value)}
              className={adminInputClass}
            />
          </AdminFormField>
        </div>

        {bundles.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold mb-2" style={{ color: 'var(--th-text-secondary)' }}>Bundles</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {bundles.map((b, i) => (
                <div key={i} className="p-3 rounded-xl text-center input-base">
                  <div className="font-bold text-sm">{b.name}</div>
                  <div className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>{b.minutes} min &bull; ${b.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => save({ pricing_per_minute: pricePerMin }, 'pricing')}
          disabled={saving === 'pricing'}
          className="btn-primary px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-bold"
        >
          {saving === 'pricing' ? 'Saving...' : 'Save Pricing'}
        </button>
      </div>

      {/* Defaults */}
      <div className="glass-panel rounded-2xl p-4 md:p-6">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--th-primary-light)' }}>Defaults</h3>
        <div className="space-y-4">
          <AdminFormField label="Default Greeting Text">
            <textarea
              rows={2}
              value={greeting}
              onChange={e => setGreeting(e.target.value)}
              className={adminInputClass}
            />
          </AdminFormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AdminFormField label="TTS Provider">
              <select
                value={ttsProvider}
                onChange={e => setTtsProvider(e.target.value)}
                className={adminSelectClass}
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
                <option value="xai">xAI</option>
              </select>
            </AdminFormField>

            <AdminFormField label="My Language">
              <input
                value={langMy}
                onChange={e => setLangMy(e.target.value)}
                className={adminInputClass}
              />
            </AdminFormField>

            <AdminFormField label="Target Language">
              <input
                value={langTarget}
                onChange={e => setLangTarget(e.target.value)}
                className={adminInputClass}
              />
            </AdminFormField>
          </div>
        </div>

        <button
          onClick={() => save({
            default_greeting: greeting,
            default_tts_provider: ttsProvider,
            default_languages: { my: langMy, target: langTarget },
          }, 'defaults')}
          disabled={saving === 'defaults'}
          className="btn-primary px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-bold mt-4"
        >
          {saving === 'defaults' ? 'Saving...' : 'Save Defaults'}
        </button>
      </div>
    </div>
  );
}
