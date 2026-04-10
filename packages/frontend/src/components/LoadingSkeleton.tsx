'use client';

function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: 'var(--th-skeleton)' }}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
    >
      <Bone className="h-3 w-20 mb-3" />
      <Bone className="h-7 w-28 mb-2" />
      <Bone className="h-3 w-16" />
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4"
          style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <Bone className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1">
              <Bone className="h-3.5 w-32 mb-2" />
              <Bone className="h-2.5 w-20" />
            </div>
            <Bone className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="snap-carousel gap-3 pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="min-w-[160px] flex-1" />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--th-card)', border: '1px solid var(--th-card-border-subtle)' }}
    >
      <Bone className="h-3 w-24 mb-4" />
      <Bone className="h-48 w-full rounded-xl" />
    </div>
  );
}
