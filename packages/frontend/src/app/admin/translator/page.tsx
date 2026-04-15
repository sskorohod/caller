'use client';
import { useState, useCallback } from 'react';
import { useAdminQuery, api } from '../_lib/admin-api';
import { fmtMinutes, fmtDateTime, fmtRelativeTime } from '../_lib/format';
import type { TranslatorSubscriber, TranslatorTransaction } from '../_lib/types';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminTable from '../_components/AdminTable';
import AdminBadge from '../_components/AdminBadge';
import AdminModal from '../_components/AdminModal';
import AdminFormField from '../_components/AdminFormField';
import { adminInputClass, adminSelectClass } from '../_components/AdminFormField';
import AdminSplitView from '../_components/AdminSplitView';
import AdminLoadingState from '../_components/AdminLoadingState';
import AdminErrorState from '../_components/AdminErrorState';

import {
  LANGUAGES,
  TTS_VOICES as VOICES,
  TRANSLATION_MODES as MODES,
  WHO_HEARS_OPTIONS as WHO_HEARS,
} from '@/lib/constants';

const TONES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'business', label: 'Business' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
];

export default function AdminTranslator() {
  const [selected, setSelected] = useState<TranslatorSubscriber | null>(null);
  const [transactions, setTransactions] = useState<TranslatorTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Balance modal
  const [balanceModal, setBalanceModal] = useState(false);
  const [balAmount, setBalAmount] = useState('');
  const [balType, setBalType] = useState<'topup' | 'gift' | 'refund'>('topup');
  const [balComment, setBalComment] = useState('');
  const [balSaving, setBalSaving] = useState(false);

  // Edit form
  const [form, setForm] = useState<Partial<TranslatorSubscriber>>({});

  const { data, loading, error, refetch } = useAdminQuery<{ subscribers: TranslatorSubscriber[] }>(
    () => api.get('/translator/subscribers'),
    [],
  );

  const subscribers = data?.subscribers ?? [];

  const selectSubscriber = useCallback(async (sub: TranslatorSubscriber) => {
    setSelected(sub);
    setEditMode(false);
    setCreating(false);
    setForm({});
    setTxLoading(true);
    try {
      const result = await api.get<{ transactions: TranslatorTransaction[] }>(
        `/translator/subscribers/${sub.id}/transactions`,
      );
      setTransactions(result.transactions);
    } catch {
      setTransactions([]);
    }
    setTxLoading(false);
  }, []);

  const startEdit = () => {
    if (!selected) return;
    setForm({ ...selected });
    setEditMode(true);
    setCreating(false);
  };

  const startCreate = () => {
    setSelected(null);
    setForm({
      my_language: 'ru',
      target_language: 'en',
      mode: 'voice',
      who_hears: 'subscriber',
      tts_voice_id: 'eve',
      tone: 'neutral',
      enabled: true,
    });
    setCreating(true);
    setEditMode(false);
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      if (creating) {
        const created = await api.post<TranslatorSubscriber>('/translator/subscribers', form);
        setCreating(false);
        refetch();
        selectSubscriber(created);
      } else if (editMode && selected) {
        const updated = await api.put<TranslatorSubscriber>(
          `/translator/subscribers/${selected.id}`,
          form,
        );
        setSelected(updated);
        setEditMode(false);
        refetch();
      }
    } catch (err) {
      alert((err as Error).message);
    }
    setSaving(false);
  };

  const deleteSubscriber = async () => {
    if (!selected || !confirm('Delete this subscriber?')) return;
    try {
      await api.delete(`/translator/subscribers/${selected.id}`);
      setSelected(null);
      refetch();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const adjustBalance = async () => {
    if (!selected || !balAmount) return;
    setBalSaving(true);
    try {
      await api.post(`/translator/subscribers/${selected.id}/balance`, {
        minutes: parseFloat(balAmount),
        type: balType,
        comment: balComment || undefined,
      });
      setBalanceModal(false);
      setBalAmount('');
      setBalComment('');
      setBalType('topup');
      refetch();
      // Reload selected subscriber and transactions
      const [subData, txData] = await Promise.all([
        api.get<{ subscribers: TranslatorSubscriber[] }>('/translator/subscribers'),
        api.get<{ transactions: TranslatorTransaction[] }>(
          `/translator/subscribers/${selected.id}/transactions`,
        ),
      ]);
      const updatedSub = subData.subscribers.find((s) => s.id === selected.id);
      if (updatedSub) setSelected(updatedSub);
      setTransactions(txData.transactions);
    } catch (err) {
      alert((err as Error).message);
    }
    setBalSaving(false);
  };

  const toggleEnabled = async (sub: TranslatorSubscriber) => {
    try {
      await api.put(`/translator/subscribers/${sub.id}`, { enabled: !sub.enabled });
      refetch();
      if (selected?.id === sub.id) {
        setSelected({ ...sub, enabled: !sub.enabled });
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) return <AdminLoadingState rows={6} />;
  if (error) return <AdminErrorState error={error} onRetry={refetch} />;

  const filtered = subscribers.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.phone_number.includes(search),
  );

  const balance = selected ? (typeof selected.balance_minutes === 'string' ? parseFloat(selected.balance_minutes as unknown as string) : selected.balance_minutes) : 0;

  // --- Subscriber list columns for AdminTable ---
  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: TranslatorSubscriber) => (
        <span className="font-medium text-sm">{row.name}</span>
      ),
    },
    {
      key: 'phone_number',
      label: 'Phone',
      render: (row: TranslatorSubscriber) => (
        <span className="font-mono text-xs">{row.phone_number}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'languages',
      label: 'Languages',
      render: (row: TranslatorSubscriber) => (
        <AdminBadge variant="primary">
          {row.my_language} &rarr; {row.target_language}
        </AdminBadge>
      ),
      hideOnMobile: true,
    },
    {
      key: 'mode',
      label: 'Mode',
      render: (row: TranslatorSubscriber) => (
        <span className="text-xs capitalize">{row.mode}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'balance_minutes',
      label: 'Balance',
      render: (row: TranslatorSubscriber) => {
        const bal = typeof row.balance_minutes === 'string' ? parseFloat(row.balance_minutes as unknown as string) : row.balance_minutes;
        return (
          <span
            className="font-mono text-xs"
            style={{ color: bal < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}
          >
            {bal.toFixed(1)} min
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: TranslatorSubscriber) => {
        if (row.blocked) return <AdminBadge variant="error">Blocked</AdminBadge>;
        if (row.enabled) return <AdminBadge variant="success">Active</AdminBadge>;
        return <AdminBadge variant="warning">Disabled</AdminBadge>;
      },
    },
  ];

  const mobileRender = (row: TranslatorSubscriber) => {
    const bal = typeof row.balance_minutes === 'string' ? parseFloat(row.balance_minutes as unknown as string) : row.balance_minutes;
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-medium text-sm truncate mr-2">{row.name}</span>
          {row.blocked ? (
            <AdminBadge variant="error">Blocked</AdminBadge>
          ) : row.enabled ? (
            <AdminBadge variant="success">Active</AdminBadge>
          ) : (
            <AdminBadge variant="warning">Disabled</AdminBadge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--th-text-secondary)' }}>
          <span className="font-mono">{row.phone_number}</span>
          <AdminBadge variant="primary">
            {row.my_language} &rarr; {row.target_language}
          </AdminBadge>
          <span
            className="ml-auto font-mono"
            style={{ color: bal < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}
          >
            {bal.toFixed(1)} min
          </span>
        </div>
      </div>
    );
  };

  // --- Edit / Create form ---
  const formPanel = (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      <h3 className="font-headline text-lg">{creating ? 'New Subscriber' : 'Edit Subscriber'}</h3>

      <div className="space-y-3">
        <AdminFormField label="Name">
          <input
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={adminInputClass}
          />
        </AdminFormField>
        <AdminFormField label="Phone Number">
          <input
            value={form.phone_number || ''}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            className={adminInputClass}
            placeholder="+14155551234"
          />
        </AdminFormField>
        <AdminFormField label="Email">
          <input
            value={form.email || ''}
            onChange={(e) => setForm({ ...form, email: e.target.value || undefined })}
            className={adminInputClass}
            placeholder="optional"
          />
        </AdminFormField>
        <div className="grid grid-cols-2 gap-2">
          <AdminFormField label="My Language">
            <select
              value={form.my_language || 'ru'}
              onChange={(e) => setForm({ ...form, my_language: e.target.value })}
              className={adminSelectClass}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </AdminFormField>
          <AdminFormField label="Target Language">
            <select
              value={form.target_language || 'en'}
              onChange={(e) => setForm({ ...form, target_language: e.target.value })}
              className={adminSelectClass}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </AdminFormField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AdminFormField label="Mode">
            <select
              value={form.mode || 'voice'}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className={adminSelectClass}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </AdminFormField>
          <AdminFormField label="Who Hears">
            <select
              value={form.who_hears || 'subscriber'}
              onChange={(e) => setForm({ ...form, who_hears: e.target.value })}
              className={adminSelectClass}
            >
              {WHO_HEARS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </AdminFormField>
        </div>
        <AdminFormField label="Tone">
          <select
            value={form.tone || 'neutral'}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
            className={adminSelectClass}
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </AdminFormField>
        <AdminFormField label="Greeting Text">
          <textarea
            value={form.greeting_text || ''}
            onChange={(e) => setForm({ ...form, greeting_text: e.target.value })}
            className={`${adminInputClass} min-h-[60px] resize-y`}
            rows={2}
          />
        </AdminFormField>
        <AdminFormField label="Voice">
          <select
            value={form.tts_voice_id || 'eve'}
            onChange={(e) => setForm({ ...form, tts_voice_id: e.target.value })}
            className={adminSelectClass}
          >
            <optgroup label="Female">
              {VOICES.filter((v) => v.gender === 'Female').map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </optgroup>
            <optgroup label="Male">
              {VOICES.filter((v) => v.gender === 'Male').map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </optgroup>
          </select>
        </AdminFormField>
        <AdminFormField label="Telegram Chat ID">
          <input
            value={form.telegram_chat_id || ''}
            onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value || undefined })}
            className={adminInputClass}
            placeholder="optional"
          />
        </AdminFormField>
        {creating && (
          <AdminFormField label="Initial Balance (minutes)">
            <input
              type="number"
              step="0.1"
              value={form.balance_minutes ?? ''}
              onChange={(e) =>
                setForm({ ...form, balance_minutes: parseFloat(e.target.value) || 0 })
              }
              className={adminInputClass}
              placeholder="0"
            />
          </AdminFormField>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setEditMode(false);
            setCreating(false);
          }}
          className="btn-ghost px-4 py-2 min-h-[44px] md:min-h-0 text-sm flex-1"
        >
          Cancel
        </button>
        <button
          onClick={saveForm}
          disabled={saving}
          className="btn-primary px-4 py-2 min-h-[44px] md:min-h-0 text-sm font-medium flex-1 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );

  // --- Detail panel ---
  const detailPanel = selected ? (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-headline text-lg">{selected.name}</h3>
          <p className="text-xs mt-1 font-mono" style={{ color: 'var(--th-text-secondary)' }}>
            {selected.phone_number}
          </p>
          {selected.email && (
            <p className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
              {selected.email}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={startEdit}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            Edit
          </button>
          <button
            onClick={deleteSubscriber}
            className="px-3 py-1.5 rounded-xl text-xs transition"
            style={{ color: 'var(--th-error-text)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--th-error-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '';
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Balance card */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'var(--th-surface)',
          border: '1px solid var(--th-border)',
        }}
      >
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-1"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Balance
        </div>
        <div
          className="text-3xl font-headline"
          style={{ color: balance < 5 ? 'var(--th-warning-text)' : 'var(--th-success-text)' }}
        >
          {balance.toFixed(1)}{' '}
          <span className="text-sm font-normal" style={{ color: 'var(--th-text-muted)' }}>
            min
          </span>
        </div>
        <button
          onClick={() => setBalanceModal(true)}
          className="btn-primary mt-3 px-4 py-1.5 text-xs font-medium"
        >
          Adjust Balance
        </button>
      </div>

      {/* Settings Summary */}
      <div className="space-y-2 text-xs">
        {[
          { label: 'Languages', value: `${selected.my_language} \u2192 ${selected.target_language}` },
          { label: 'Mode', value: selected.mode },
          { label: 'Who Hears', value: selected.who_hears },
          { label: 'Tone', value: selected.tone || 'neutral' },
          { label: 'Voice', value: selected.tts_voice_id || 'eve' },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between">
            <span style={{ color: 'var(--th-text-secondary)' }}>{label}</span>
            <span className="capitalize">{value}</span>
          </div>
        ))}
        {selected.telegram_chat_id && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--th-text-secondary)' }}>Telegram</span>
            <span className="font-mono">{selected.telegram_chat_id}</span>
          </div>
        )}
      </div>

      {/* Greeting */}
      <div>
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-1"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Greeting
        </div>
        <p className="text-xs italic" style={{ color: 'var(--th-text-secondary)' }}>
          &ldquo;{selected.greeting_text}&rdquo;
        </p>
      </div>

      {/* Enable / Disable toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => toggleEnabled(selected)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium transition flex-1"
          style={
            selected.enabled
              ? { background: 'var(--th-warning-bg)', color: 'var(--th-warning-text)', border: '1px solid var(--th-warning-bg)' }
              : { background: 'var(--th-success-bg)', color: 'var(--th-success-text)', border: '1px solid var(--th-success-bg)' }
          }
        >
          {selected.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {/* Transaction History */}
      <div>
        <div
          className="text-[10px] uppercase tracking-wider font-medium mb-2"
          style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
        >
          Balance History
        </div>
        {txLoading ? (
          <div className="text-xs animate-pulse" style={{ color: 'var(--th-text-muted)' }}>
            Loading transactions...
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex justify-between items-center text-xs py-1"
                style={{ borderBottom: '1px solid var(--th-border)' }}
              >
                <div>
                  <span className="font-medium capitalize">{t.type}</span>
                  {t.comment && (
                    <span className="ml-2" style={{ color: 'var(--th-text-secondary)' }}>
                      {t.comment}
                    </span>
                  )}
                </div>
                <span
                  className="font-mono"
                  style={{
                    color: t.minutes >= 0 ? 'var(--th-success-text)' : 'var(--th-error-text)',
                  }}
                >
                  {t.minutes >= 0 ? '+' : ''}
                  {t.minutes.toFixed(1)} min
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--th-text-muted)' }}>
                No transactions yet
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  // --- Empty state for detail panel ---
  const emptyDetail = (
    <div
      className="rounded-xl p-5 text-center py-12"
      style={{
        background: 'var(--th-card)',
        border: '1px solid var(--th-card-border-subtle)',
        boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
        color: 'var(--th-text-muted)',
      }}
    >
      <span className="material-symbols-outlined text-3xl mb-2 block">translate</span>
      Select a subscriber
    </div>
  );

  // --- List content ---
  const listContent = (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or phone..."
        className={`${adminInputClass} md:max-w-md`}
      />

      <AdminTable<TranslatorSubscriber & Record<string, unknown>>
        columns={columns as { key: string; label: string; render: (row: TranslatorSubscriber & Record<string, unknown>) => React.ReactNode; className?: string; hideOnMobile?: boolean }[]}
        data={filtered as (TranslatorSubscriber & Record<string, unknown>)[]}
        keyField="id"
        pageSize={10}
        onRowClick={(row) => selectSubscriber(row as unknown as TranslatorSubscriber)}
        activeRowKey={selected?.id}
        emptyIcon="translate"
        emptyText="No subscribers found"
        mobileRender={mobileRender as (row: TranslatorSubscriber & Record<string, unknown>) => React.ReactNode}
      />
    </div>
  );

  // --- Detail or form ---
  const rightPanel = editMode || creating
    ? formPanel
    : selected
      ? detailPanel
      : emptyDetail;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <AdminPageHeader
        title="Translator Subscribers"
        subtitle="Manage translator service subscribers"
        icon="translate"
        action={
          <button onClick={startCreate} className="btn-primary px-4 py-2 text-sm font-medium">
            + Add
          </button>
        }
      />

      <AdminSplitView
        list={listContent}
        detail={rightPanel}
        hasSelection={selected !== null || creating}
        onBack={() => {
          setSelected(null);
          setCreating(false);
          setEditMode(false);
        }}
        listSpan={7}
        detailSpan={5}
      />

      {/* Balance Adjustment Modal */}
      <AdminModal
        open={balanceModal && selected !== null}
        onClose={() => setBalanceModal(false)}
        title="Adjust Balance"
        actions={
          <>
            <button
              onClick={() => setBalanceModal(false)}
              className="btn-ghost px-4 py-2 min-h-[44px] md:min-h-0 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={adjustBalance}
              disabled={balSaving || !balAmount}
              className="btn-primary px-4 py-2 min-h-[44px] md:min-h-0 text-sm font-medium disabled:opacity-50"
            >
              {balSaving ? 'Applying...' : 'Apply'}
            </button>
          </>
        }
      >
        {selected && (
          <p className="text-xs" style={{ color: 'var(--th-text-secondary)' }}>
            {selected.name} &mdash; Current: {balance.toFixed(1)} min
          </p>
        )}
        <AdminFormField label="Type">
          <select
            value={balType}
            onChange={(e) => setBalType(e.target.value as 'topup' | 'gift' | 'refund')}
            className={adminSelectClass}
          >
            <option value="topup">Top Up</option>
            <option value="gift">Gift</option>
            <option value="refund">Refund</option>
          </select>
        </AdminFormField>
        <AdminFormField label="Minutes">
          <input
            type="number"
            step="0.1"
            value={balAmount}
            onChange={(e) => setBalAmount(e.target.value)}
            className={adminInputClass}
            placeholder="10.0"
          />
        </AdminFormField>
        <AdminFormField label="Comment">
          <input
            value={balComment}
            onChange={(e) => setBalComment(e.target.value)}
            className={adminInputClass}
            placeholder="Optional"
          />
        </AdminFormField>
      </AdminModal>
    </div>
  );
}
