'use client';
import { useIsMobile } from '@/lib/useBreakpoint';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  mobileRender: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyState?: React.ReactNode;
  headerClassName?: string;
}

export default function ResponsiveTable<T>({
  data,
  columns,
  mobileRender,
  keyExtractor,
  onRowClick,
  emptyState,
  headerClassName,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Mobile: card list
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2.5">
        {data.map((item, i) => (
          <div key={keyExtractor(item)}>
            {mobileRender(item, i)}
          </div>
        ))}
      </div>
    );
  }

  // Desktop: table
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--th-card-border-subtle)' }}>
      <table className="w-full">
        <thead>
          <tr style={{ background: 'var(--th-table-header)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left text-[10px] font-semibold uppercase tracking-wider px-4 py-3 ${col.className || ''}`}
                style={{ color: 'var(--th-text-muted)' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'cursor-pointer' : ''}
              style={{ borderTop: '1px solid var(--th-table-divider)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--th-table-row-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-sm ${col.className || ''}`}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
