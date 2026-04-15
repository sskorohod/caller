'use client';

interface AdminErrorStateProps {
  error: string;
  onRetry?: () => void;
}

export default function AdminErrorState({ error, onRetry }: AdminErrorStateProps) {
  return (
    <div className="p-4 md:p-8" role="alert" aria-live="polite">
      <div
        className="rounded-xl p-6 text-center max-w-sm mx-auto"
        style={{
          background: 'var(--th-card)',
          border: '1px solid var(--th-error-border)',
        }}
      >
        <span
          className="material-symbols-outlined text-3xl mb-3 block"
          style={{ color: 'var(--th-error-text)' }}
        >
          error_outline
        </span>
        <p className="text-sm font-medium mb-1">Something went wrong</p>
        <p className="text-xs mb-4" style={{ color: 'var(--th-text-secondary)' }}>{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-primary px-4 py-2 text-xs font-medium"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
