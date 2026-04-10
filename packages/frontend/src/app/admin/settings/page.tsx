'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ settings: Record<string, any> }>('/admin/settings')
      .then(r => setSettings(r.settings)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async (keys: Record<string, any>, section: string) => {
    setSaving(section);
    try {
      await api.put('/admin/settings', keys);
      setSettings(prev => ({ ...prev, ...keys }));
    } catch (err) { alert((err as Error).message); }
    setSaving(null);
  };

  if (loading) return <div className="p-8 text-center opacity-50">Loading...</div>;

  const pricePerMin = typeof settings.pricing_per_minute === 'string' ? settings.pricing_per_minute : '0.15';
  const bundles = Array.isArray(settings.bundles) ? settings.bundles : [];
  const greeting = typeof settings.default_greeting === 'string' ? settings.default_greeting : '';
  const ttsProvider = typeof settings.default_tts_provider === 'string' ? settings.default_tts_provider : 'elevenlabs';
  const langs = settings.default_languages ?? { my: 'ru', target: 'en' };

  return (
    <div className="px-3 py-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-headline font-bold">Settings</h1>

      {/* Pricing */}
      <div className="glass-panel rounded-2xl p-4 md:p-6">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--th-primary-light)' }}>Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--th-text-secondary)' }}>Price per minute ($)</label>
            <input defaultValue={pricePerMin} id="price-input" type="number" step="0.01"
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm input-base" />
          </div>
        </div>
        {bundles.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold mb-2" style={{ color: 'var(--th-text-secondary)' }}>Bundles</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {bundles.map((b: any, i: number) => (
                <div key={i} className="p-3 rounded-xl text-center input-base">
                  <div className="font-bold text-sm">{b.name}</div>
                  <div className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>{b.minutes} min &bull; ${b.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => save({ pricing_per_minute: (document.getElementById('price-input') as HTMLInputElement)?.value ?? pricePerMin }, 'pricing')}
          disabled={saving === 'pricing'} className="btn-primary px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-bold">
          {saving === 'pricing' ? 'Saving...' : 'Save Pricing'}
        </button>
      </div>

      {/* Defaults */}
      <div className="glass-panel rounded-2xl p-4 md:p-6">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--th-primary-light)' }}>Defaults</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--th-text-secondary)' }}>Default Greeting Text</label>
            <textarea defaultValue={greeting} id="greeting-input" rows={2}
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm input-base" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--th-text-secondary)' }}>TTS Provider</label>
              <select defaultValue={ttsProvider} id="tts-input"
                className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm input-base">
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
                <option value="xai">xAI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--th-text-secondary)' }}>My Language</label>
              <input defaultValue={langs.my} id="lang-my-input"
                className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm input-base" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--th-text-secondary)' }}>Target Language</label>
              <input defaultValue={langs.target} id="lang-target-input"
                className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm input-base" />
            </div>
          </div>
        </div>
        <button onClick={() => save({
          default_greeting: (document.getElementById('greeting-input') as HTMLTextAreaElement)?.value,
          default_tts_provider: (document.getElementById('tts-input') as HTMLSelectElement)?.value,
          default_languages: { my: (document.getElementById('lang-my-input') as HTMLInputElement)?.value, target: (document.getElementById('lang-target-input') as HTMLInputElement)?.value },
        }, 'defaults')} disabled={saving === 'defaults'} className="btn-primary px-4 py-2.5 min-h-[44px] md:min-h-0 rounded-xl text-sm font-bold mt-4">
          {saving === 'defaults' ? 'Saving...' : 'Save Defaults'}
        </button>
      </div>
    </div>
  );
}
