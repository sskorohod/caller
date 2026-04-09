'use client';

function Bone({ className }: { className: string }) {
  return <div className={`bg-[var(--th-skeleton)] rounded-xl ${className}`} />;
}

export function BillingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Hero card */}
      <Bone className="h-[140px] !rounded-2xl" />
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Bone key={i} className="h-[88px] !rounded-2xl" />)}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Bone className="lg:col-span-7 h-[220px] !rounded-2xl" />
        <Bone className="lg:col-span-5 h-[220px] !rounded-2xl" />
      </div>
      {/* Deposit */}
      <Bone className="h-[160px] !rounded-2xl" />
      {/* Plan comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Bone key={i} className="h-[320px] !rounded-2xl" />)}
      </div>
      {/* Transactions */}
      <Bone className="h-[280px] !rounded-2xl" />
    </div>
  );
}
