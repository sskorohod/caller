'use client';
import { useState } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtDate, fmtMinutes } from '../_lib/format';
import type { PromoCode } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminTable from '../_components/AdminTable';
import AdminBadge from '../_components/AdminBadge';
import AdminModal from '../_components/AdminModal';
import AdminFormField from '../_components/AdminFormField';
import { adminInputClass } from '../_components/AdminFormField';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

export default function PromoPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', minutes: 5, max_uses: 100, expires_at: '' });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<PromoCode | null>(null);

  const { data, loading, error, refetch } = useAdminQuery<{ promo_codes: PromoCode[] }>(
    () => api.get('/admin/promo'),
    [],
  );

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/admin/promo', {
        ...form,
        code: form.code.toUpperCase(),
        expires_at: form.expires_at || undefined,
      });
      setShowForm(false);
      setForm({ code: '', minutes: 5, max_uses: 100, expires_at: '' });
      refetch();
    } catch (err) {
      alert((err as Error).message);
    }
    setSaving(false);
  };

  const handleToggle = async (code: PromoCode) => {
    if (code.active) {
      setConfirmDeactivate(code);
      return;
    }
    await doToggle(code);
  };

  const doToggle = async (code: PromoCode) => {
    setToggling(code.id);
    try {
      await api.put(`/admin/promo/${code.id}`, { active: !code.active });
      refetch();
    } catch (err) {
      alert((err as Error).message);
    }
    setToggling(null);
    setConfirmDeactivate(null);
  };

  if (loading) return <AdminLoadingState rows={4} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const codes = data?.promo_codes ?? [];

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row: PromoCode) => (
        <span className="font-mono font-semibold text-sm">{row.code}</span>
      ),
    },
    {
      key: 'minutes',
      label: 'Minutes',
      render: (row: PromoCode) => (
        <span className="text-sm">{fmtMinutes(row.minutes)}</span>
      ),
    },
    {
      key: 'uses',
      label: 'Uses',
      render: (row: PromoCode) => (
        <span className="text-sm">{row.used_count} / {row.max_uses}</span>
      ),
    },
    {
      key: 'expires_at',
      label: 'Expires',
      render: (row: PromoCode) => (
        <span className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          {row.expires_at ? fmtDate(row.expires_at) : 'Never'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: PromoCode) => (
        <AdminBadge variant={row.active ? 'success' : 'neutral'}>
          {row.active ? 'Active' : 'Inactive'}
        </AdminBadge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: PromoCode) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle(row); }}
          disabled={toggling === row.id}
          className="text-xs font-medium transition disabled:opacity-50"
          style={{ color: 'var(--th-primary-text)' }}
        >
          {toggling === row.id ? '...' : row.active ? 'Deactivate' : 'Activate'}
        </button>
      ),
    },
  ];

  const mobileRender = (row: PromoCode) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-semibold text-sm">{row.code}</span>
        <AdminBadge variant={row.active ? 'success' : 'neutral'}>
          {row.active ? 'Active' : 'Inactive'}
        </AdminBadge>
      </div>
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--th-text-secondary)' }}>
        <span>{fmtMinutes(row.minutes)}</span>
        <span>{row.used_count} / {row.max_uses} uses</span>
        <span>{row.expires_at ? fmtDate(row.expires_at) : 'No expiry'}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); handleToggle(row); }}
        disabled={toggling === row.id}
        className="text-xs min-h-[44px] w-full rounded-lg transition disabled:opacity-50"
        style={{ color: 'var(--th-primary-text)', background: 'var(--th-primary-bg)' }}
      >
        {toggling === row.id ? '...' : row.active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <AdminPageHeader
        title="Promo Codes"
        subtitle="Manage promotional codes"
        icon="confirmation_number"
        action={
          <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm font-medium">
            + Create
          </button>
        }
      />

      <AdminTable<PromoCode & Record<string, unknown>>
        columns={columns as { key: string; label: string; render: (row: PromoCode & Record<string, unknown>) => React.ReactNode; className?: string; hideOnMobile?: boolean }[]}
        data={codes as (PromoCode & Record<string, unknown>)[]}
        keyField="id"
        pageSize={10}
        emptyIcon="confirmation_number"
        emptyText="No promo codes yet"
        mobileRender={mobileRender as (row: PromoCode & Record<string, unknown>) => React.ReactNode}
      />

      {/* Create Modal */}
      <AdminModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create Promo Code"
        actions={
          <>
            <button
              onClick={() => setShowForm(false)}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.code}
              className="btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <AdminFormField label="Code">
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="WELCOME5"
            className={`${adminInputClass} font-mono`}
          />
        </AdminFormField>
        <div className="grid grid-cols-2 gap-3">
          <AdminFormField label="Free Minutes">
            <input
              type="number"
              value={form.minutes}
              onChange={(e) => setForm((f) => ({ ...f, minutes: Number(e.target.value) }))}
              className={adminInputClass}
            />
          </AdminFormField>
          <AdminFormField label="Max Uses">
            <input
              type="number"
              value={form.max_uses}
              onChange={(e) => setForm((f) => ({ ...f, max_uses: Number(e.target.value) }))}
              className={adminInputClass}
            />
          </AdminFormField>
        </div>
        <AdminFormField label="Expires (optional)">
          <input
            type="date"
            value={form.expires_at}
            onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            className={adminInputClass}
          />
        </AdminFormField>
      </AdminModal>

      {/* Deactivation Confirmation Modal */}
      <AdminModal
        open={confirmDeactivate !== null}
        onClose={() => setConfirmDeactivate(null)}
        title="Deactivate Promo Code"
        actions={
          <>
            <button
              onClick={() => setConfirmDeactivate(null)}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmDeactivate && doToggle(confirmDeactivate)}
              disabled={toggling !== null}
              className="px-4 py-2 text-sm font-medium rounded-xl transition disabled:opacity-50"
              style={{ background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }}
            >
              {toggling ? 'Deactivating...' : 'Deactivate'}
            </button>
          </>
        }
      >
        <p className="text-sm" style={{ color: 'var(--th-text-secondary)' }}>
          Are you sure you want to deactivate promo code{' '}
          <strong className="font-mono" style={{ color: 'var(--th-text)' }}>
            {confirmDeactivate?.code}
          </strong>
          ? Users will no longer be able to redeem it.
        </p>
      </AdminModal>
    </div>
  );
}
