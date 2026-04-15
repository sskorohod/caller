'use client';

interface AdminSplitViewProps {
  list: React.ReactNode;
  detail: React.ReactNode;
  hasSelection: boolean;
  onBack?: () => void;
  listSpan?: number;
  detailSpan?: number;
}

export default function AdminSplitView({
  list,
  detail,
  hasSelection,
  onBack,
  listSpan = 5,
  detailSpan = 7,
}: AdminSplitViewProps) {
  return (
    <>
      {/* Mobile: show list or detail */}
      <div className="md:hidden">
        {!hasSelection ? (
          list
        ) : (
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-xs font-medium mb-3 px-1 min-h-[44px]"
                style={{ color: 'var(--th-primary-text)' }}
                aria-label="Back to list"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back
              </button>
            )}
            {detail}
          </div>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden md:grid gap-6" style={{ gridTemplateColumns: `${listSpan}fr ${detailSpan}fr` }}>
        <div>{list}</div>
        <div>{detail}</div>
      </div>
    </>
  );
}
