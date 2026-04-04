'use client';

function Bone({ className }: { className: string }) {
  return <div className={`bg-[var(--th-skeleton)] rounded-xl ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div>
          <Bone className="h-6 w-56" />
          <Bone className="h-3.5 w-40 mt-2" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => <Bone key={i} className="h-7 w-20 !rounded-lg" />)}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Bone key={i} className="h-[88px] !rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Bone className="lg:col-span-7 h-[220px] !rounded-2xl" />
        <Bone className="lg:col-span-5 h-[220px] !rounded-2xl" />
      </div>
      <Bone className="h-11 !rounded-2xl" />
      <Bone className="h-[200px] !rounded-2xl" />
    </div>
  );
}
