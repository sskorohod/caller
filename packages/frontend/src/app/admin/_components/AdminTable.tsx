'use client';
import { useState } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  activeRowKey?: string;
  emptyIcon?: string;
  emptyText?: string;
  mobileRender?: (row: T) => React.ReactNode;
}

export default function AdminTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  pageSize = 5,
  onRowClick,
  activeRowKey,
  emptyIcon = 'inbox',
  emptyText = 'No data',
  mobileRender,
}: AdminTableProps<T>) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--th-text-muted)' }}>
        <span className="material-symbols-outlined text-3xl mb-2 block">{emptyIcon}</span>
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile card view */}
      {mobileRender && (
        <div className="md:hidden space-y-2">
          {pageData.map((row) => (
            <div
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={`rounded-xl p-3.5 transition ${onRowClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
              style={{
                background: activeRowKey === String(row[keyField]) ? 'var(--th-primary-bg)' : 'var(--th-card)',
                border: '1px solid var(--th-card-border-subtle)',
              }}
            >
              {mobileRender(row)}
            </div>
          ))}
        </div>
      )}

      {/* Desktop table */}
      <div className={mobileRender ? 'hidden md:block' : ''}>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--th-card)',
            border: '1px solid var(--th-card-border-subtle)',
            boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--th-border)' }}>
                {columns.filter(c => !c.hideOnMobile || !mobileRender).map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider ${col.className || ''}`}
                    style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px', background: 'var(--th-table-header)' }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  className={`transition ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{
                    borderBottom: '1px solid var(--th-table-divider)',
                    background: activeRowKey === String(row[keyField]) ? 'var(--th-primary-bg)' : undefined,
                  }}
                  onMouseEnter={(e) => { if (!activeRowKey || activeRowKey !== String(row[keyField])) e.currentTarget.style.background = 'var(--th-table-row-hover)'; }}
                  onMouseLeave={(e) => { if (!activeRowKey || activeRowKey !== String(row[keyField])) e.currentTarget.style.background = ''; }}
                >
                  {columns.filter(c => !c.hideOnMobile || !mobileRender).map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs" style={{ color: 'var(--th-text-muted)' }}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded-lg text-xs transition disabled:opacity-30"
              style={{ background: 'var(--th-surface)', color: 'var(--th-text-secondary)' }}
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded-lg text-xs transition disabled:opacity-30"
              style={{ background: 'var(--th-surface)', color: 'var(--th-text-secondary)' }}
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
