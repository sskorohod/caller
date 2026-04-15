'use client';

interface AdminLoadingStateProps {
  rows?: number;
}

export default function AdminLoadingState({ rows = 3 }: AdminLoadingStateProps) {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse" role="status" aria-label="Loading">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--th-skeleton)' }} />
        <div>
          <div className="h-5 w-40 rounded-lg mb-1" style={{ background: 'var(--th-skeleton)' }} />
          <div className="h-3 w-24 rounded-lg" style={{ background: 'var(--th-skeleton)' }} />
        </div>
      </div>

      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4 h-20"
            style={{ background: 'var(--th-skeleton)', border: '1px solid var(--th-card-border-subtle)' }}
          />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--th-skeleton)', border: '1px solid var(--th-card-border-subtle)' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <div className="h-3 flex-1 rounded" style={{ background: 'var(--th-card-border-subtle)' }} />
            <div className="h-3 w-16 rounded" style={{ background: 'var(--th-card-border-subtle)' }} />
            <div className="h-3 w-20 rounded" style={{ background: 'var(--th-card-border-subtle)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
