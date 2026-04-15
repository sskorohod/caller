'use client';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtDateTime } from '../_lib/format';
import type { AuditEntry } from '../_lib/types';
import { ACTION_COLORS } from '../_lib/constants';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminTable from '../_components/AdminTable';
import AdminBadge from '../_components/AdminBadge';
import AdminFilterBar from '../_components/AdminFilterBar';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';
import { useState } from 'react';

const FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'balance_added', label: 'Balance Added' },
  { value: 'subscriber_blocked', label: 'Blocked' },
  { value: 'subscriber_unblocked', label: 'Unblocked' },
  { value: 'settings_changed', label: 'Settings Changed' },
  { value: 'provider_updated', label: 'Provider Updated' },
  { value: 'promo_created', label: 'Promo Created' },
];

function actionVariant(action: string): 'success' | 'error' | 'primary' | 'warning' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'error' | 'primary' | 'warning' | 'info' | 'neutral'> = {
    balance_added: 'success',
    subscriber_blocked: 'error',
    subscriber_unblocked: 'success',
    settings_changed: 'primary',
    provider_updated: 'info',
    promo_created: 'warning',
  };
  return map[action] ?? 'neutral';
}

export default function AuditPage() {
  const [filter, setFilter] = useState('');

  const params = new URLSearchParams();
  if (filter) params.set('action', filter);
  params.set('limit', '100');
  const queryString = `?${params.toString()}`;

  const { data, loading, error, refetch } = useAdminQuery<{ logs: AuditEntry[] }>(
    () => api.get(`/admin/audit${queryString}`),
    [queryString],
  );

  if (loading) return <AdminLoadingState rows={6} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const logs = data?.logs ?? [];

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (row: AuditEntry) => (
        <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          {fmtDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row: AuditEntry) => (
        <AdminBadge variant={actionVariant(row.action)}>
          {row.action}
        </AdminBadge>
      ),
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (row: AuditEntry) => (
        <span className="font-mono text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          {row.resource_type ? `${row.resource_type}/${row.resource_id?.slice(0, 8)}` : '-'}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Details',
      render: (row: AuditEntry) => (
        <span className="text-xs max-w-xs truncate block" style={{ color: 'var(--th-text-secondary)' }}>
          {row.details ? JSON.stringify(row.details).slice(0, 80) : '-'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'ip_address',
      label: 'IP',
      render: (row: AuditEntry) => (
        <span className="font-mono text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          {row.ip_address ?? '-'}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  const mobileRender = (row: AuditEntry) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <AdminBadge variant={actionVariant(row.action)}>
          {row.action}
        </AdminBadge>
        <span className="text-xs shrink-0" style={{ color: 'var(--th-text-secondary)' }}>
          {fmtDateTime(row.created_at)}
        </span>
      </div>
      {row.resource_type && (
        <div className="font-mono text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          {row.resource_type}/{row.resource_id?.slice(0, 8)}
        </div>
      )}
      {row.details && (
        <div className="text-xs break-all" style={{ color: 'var(--th-text-secondary)' }}>
          {JSON.stringify(row.details).slice(0, 120)}
        </div>
      )}
      {row.ip_address && (
        <div className="font-mono text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          IP: {row.ip_address}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <AdminPageHeader
        title="Audit Log"
        subtitle="Track all admin actions"
        icon="policy"
      />

      <AdminFilterBar
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
      />

      <AdminTable<AuditEntry & Record<string, unknown>>
        columns={columns as { key: string; label: string; render: (row: AuditEntry & Record<string, unknown>) => React.ReactNode; className?: string; hideOnMobile?: boolean }[]}
        data={logs as (AuditEntry & Record<string, unknown>)[]}
        keyField="id"
        pageSize={10}
        emptyIcon="policy"
        emptyText="No audit entries yet"
        mobileRender={mobileRender as (row: AuditEntry & Record<string, unknown>) => React.ReactNode}
      />
    </div>
  );
}
