'use client';

function Bone({ className }: { className?: string }) {
  return <div className={`bg-[var(--th-skeleton)] rounded-lg animate-pulse ${className ?? ''}`} />;
}

function CardBone({ rows }: { rows: number }) {
  return (
    <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3.5 px-4 md:px-6 pt-4 md:pt-5 pb-4 border-b border-[var(--th-card-border-subtle)]">
        <Bone className="w-9 h-9 !rounded-xl shrink-0" />
        <div className="space-y-2 flex-1">
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-64 max-w-full" />
        </div>
      </div>
      {/* Body */}
      <div className="p-4 md:p-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-10 w-full !rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-5xl pb-10">
      {/* Page header */}
      <div className="mb-5 md:mb-7 space-y-2">
        <Bone className="h-7 w-36" />
        <Bone className="h-4 w-72 max-w-full" />
      </div>

      <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* Nav skeleton */}
        <div className="hidden lg:block space-y-1.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2">
              <Bone className="w-[18px] h-[18px] !rounded-md" />
              <Bone className={`h-3.5 ${i === 1 ? 'w-20' : i === 2 ? 'w-24' : 'w-16'}`} />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="space-y-4 md:space-y-5 min-w-0">
          <CardBone rows={2} />
          <CardBone rows={1} />
          <CardBone rows={1} />
        </div>
      </div>
    </div>
  );
}
