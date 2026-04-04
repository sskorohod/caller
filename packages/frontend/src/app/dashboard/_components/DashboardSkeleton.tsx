'use client';

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div>
          <div className="h-6 bg-[var(--th-skeleton)] rounded w-56" />
          <div className="h-3.5 bg-[var(--th-skeleton)] rounded w-40 mt-2" />
        </div>
        <div className="h-4 bg-[var(--th-skeleton)] rounded w-48" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-[76px] bg-[var(--th-skeleton)] rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 h-[200px] bg-[var(--th-skeleton)] rounded-xl" />
        <div className="lg:col-span-5 h-[200px] bg-[var(--th-skeleton)] rounded-xl" />
      </div>
      <div className="h-10 bg-[var(--th-skeleton)] rounded-xl" />
      <div className="h-[220px] bg-[var(--th-skeleton)] rounded-xl" />
    </div>
  );
}
