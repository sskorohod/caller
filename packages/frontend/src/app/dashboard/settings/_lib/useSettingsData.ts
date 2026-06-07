'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Workspace } from './types';

export function useSettingsData() {
  const { setWorkspace } = useAuth();
  const [workspace, setWorkspaceLocal] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Workspace>('/workspaces/current')
      .then(ws => { if (ws) setWorkspaceLocal(ws); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleWorkspaceUpdate(updated: Workspace) {
    setWorkspaceLocal(updated);
    setWorkspace({ id: updated.id, name: updated.name });
  }

  return { workspace, loading, handleWorkspaceUpdate };
}
