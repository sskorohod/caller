'use client';

interface ErrorStateProps {
  code?: number | string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({ code, message, onRetry, retryLabel = 'Retry' }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 md:py-16 px-4 md:px-6 text-center">
      {/* Cloud-off icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--th-surface)', color: 'var(--th-text-muted)' }}
      >
        <svg
          className="w-8 h-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 2l20 20" />
          <path d="M9.34 9.34a3.5 3.5 0 0 0 4.95 4.95" />
          <path d="M17.73 17.73A7 7 0 0 1 5 12.1a7 7 0 0 1 3.27-5.83" />
          <path d="M20.42 14.42A7 7 0 0 0 12.1 5a6.98 6.98 0 0 0-1.44.15" />
        </svg>
      </div>

      {/* Error code */}
      {code && (
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--th-text-muted)' }}
        >
          Error {code}
        </p>
      )}

      {/* Message */}
      <h3
        className="text-base font-semibold mb-1"
        style={{ color: 'var(--th-text)' }}
      >
        {message || 'Something went wrong'}
      </h3>
      <p
        className="text-sm max-w-xs mb-6"
        style={{ color: 'var(--th-text-secondary)' }}
      >
        Unable to reach the server. Check your connection and try again.
      </p>

      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-[44px] px-6 py-2.5 text-sm font-semibold rounded-xl transition-[background,transform] active:scale-[.97]"
          style={{
            background: 'var(--th-surface)',
            color: 'var(--th-primary)',
            border: '1px solid var(--th-card-border-subtle)',
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
