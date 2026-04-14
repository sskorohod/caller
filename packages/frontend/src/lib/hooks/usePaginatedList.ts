'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface UsePaginatedListOptions<T> {
  endpoint: string;
  /** Key in the response JSON that contains the array (e.g. 'calls', 'agents') */
  dataKey: string;
  pageSize?: number;
  /** Query params appended to every request */
  params?: Record<string, string>;
}

interface UsePaginatedListResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

export function usePaginatedList<T>(opts: UsePaginatedListOptions<T>): UsePaginatedListResult<T> {
  const { endpoint, dataKey, pageSize = 50, params = {} } = opts;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const qp = new URLSearchParams({
        limit: String(pageSize),
        offset: String(append ? offset : 0),
        ...params,
      });
      const res = await api.get<Record<string, unknown>>(`${endpoint}?${qp}`);
      const items = (res[dataKey] as T[]) || [];
      const resTotal = (res.total as number) || items.length;

      if (append) {
        setData(prev => [...prev, ...items]);
      } else {
        setData(items);
      }
      setTotal(resTotal);
      setOffset((append ? offset : 0) + items.length);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [endpoint, dataKey, pageSize, offset, JSON.stringify(params)]);

  useEffect(() => {
    load(false);
  }, [endpoint, dataKey, pageSize, JSON.stringify(params)]);

  const loadMore = useCallback(async () => {
    if (loadingMore || data.length >= total) return;
    await load(true);
  }, [loadingMore, data.length, total, load]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await load(false);
  }, [load]);

  const hasMore = data.length < total;

  return { data, loading, loadingMore, error, total, hasMore, loadMore, refresh, setData };
}
