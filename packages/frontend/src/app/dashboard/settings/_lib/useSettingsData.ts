'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Workspace, Provider, ProviderConfig } from './types';

export function useSettingsData() {
  const { setWorkspace, workspace: authWorkspace } = useAuth();
  const plan = authWorkspace?.plan || 'translator';

  const [workspace, setWorkspaceLocal] = useState<Workspace | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Workspace>('/workspaces/current').catch(() => null),
      api.get<Provider[]>('/auth/providers').catch(() => []),
      api.get<{ provider_config: ProviderConfig }>('/billing/balance').then(r => r.provider_config).catch(() => ({})),
    ]).then(([ws, prov, pc]) => {
      if (ws) setWorkspaceLocal(ws);
      setProviders(Array.isArray(prov) ? prov : []);
      setProviderConfig(pc ?? {});
    }).finally(() => setLoading(false));
  }, []);

  const reloadProviders = useCallback(() => {
    api.get<Provider[]>('/auth/providers').then(p => setProviders(Array.isArray(p) ? p : [])).catch(() => {});
  }, []);

  function handleWorkspaceUpdate(updated: Workspace) {
    setWorkspaceLocal(updated);
    setWorkspace({ id: updated.id, name: updated.name });
  }

  async function updateProviderConfig(provider: string, mode: 'platform' | 'own') {
    const updated = { ...providerConfig, [provider]: mode };
    setProviderConfig(updated);
    try {
      await api.patch('/billing/provider-config', { [provider]: mode });
    } catch {
      setProviderConfig(providerConfig);
    }
  }

  return {
    workspace,
    providers,
    providerConfig,
    loading,
    plan,
    reloadProviders,
    handleWorkspaceUpdate,
    updateProviderConfig,
  };
}
