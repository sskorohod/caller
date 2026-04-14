'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface AgentOption {
  id: string;
  name: string;
  display_name?: string;
  is_default?: boolean;
  is_active?: boolean;
}

/**
 * Shared hook for loading agent profiles.
 * Used across calls, dialer, missions, settings, etc.
 */
export function useAgents() {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ agents: AgentOption[] }>('/agents')
      .then(r => setAgents(r?.agents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { agents, loading };
}
