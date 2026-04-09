'use client';

function Bone({ className }: { className?: string }) {
  return <div className={`bg-[var(--th-skeleton)] rounded-lg animate-pulse ${className ?? ''}`} />;
}

export function SettingsSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-5 md:gap-7 min-h-full">
      {/* Nav skeleton */}
      <div className="md:w-56 shrink-0">
        <div className="flex items-center gap-2.5 px-3 mb-4">
          <Bone className="w-8 h-8 !rounded-xl" />
          <div className="space-y-1.5">
            <Bone className="h-4 w-20" />
            <Bone className="h-2.5 w-28" />
          </div>
        </div>
        <Bone className="h-px w-full mx-3 mb-2" />
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
              <Bone className="w-7 h-7 !rounded-lg" />
              <Bone className={`h-4 ${i === 1 ? 'w-20' : i === 2 ? 'w-24' : 'w-16'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 space-y-5">
        {/* Section header */}
        <div className="flex items-center gap-3">
          <Bone className="w-10 h-10 !rounded-xl" />
          <div className="space-y-1.5">
            <Bone className="h-5 w-48" />
            <Bone className="h-3 w-64" />
          </div>
        </div>

        {/* Card with accent bar */}
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] overflow-hidden">
          <Bone className="h-1 w-full !rounded-none" />
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-12 w-full !rounded-xl" />
            </div>
            <div className="space-y-2">
              <Bone className="h-3 w-28" />
              <div className="grid grid-cols-3 gap-2">
                <Bone className="h-10 w-full !rounded-xl" />
                <Bone className="h-10 w-full !rounded-xl" />
                <Bone className="h-10 w-full !rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Preferences card */}
        <div className="bg-[var(--th-card)] rounded-2xl border border-[var(--th-card-border-subtle)] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bone className="w-4 h-4" />
            <Bone className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Bone className="h-3 w-16" />
              <Bone className="h-10 w-full !rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Bone className="h-3 w-28" />
              <Bone className="h-10 w-full !rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
