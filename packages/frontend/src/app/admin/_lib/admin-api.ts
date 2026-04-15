'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetcher(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const cleanup = execute();
    return cleanup;
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

// Re-export api for convenience
export { api };
