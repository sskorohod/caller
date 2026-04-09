'use client';

function Bone({ className }: { className?: string }) {
  return <div className={`bg-[var(--th-skeleton)] rounded-lg animate-pulse ${className ?? ''}`} />;
}

export function SettingsSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-5 md:gap-7 min-h-full">
      {/* Nav skeleton */}
      <div className="md:w-52 shrink-0 space-y-1">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Bone key={i} className="h-10 w-full" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="flex-1 space-y-4">
        <Bone className="h-6 w-48" />
        <Bone className="h-4 w-72" />
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 space-y-4">
          <Bone className="h-10 w-full" />
          <Bone className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
          </div>
          <Bone className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
