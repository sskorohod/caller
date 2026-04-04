export const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]',
  failed: 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]',
  in_progress: 'bg-[var(--th-info-bg)] text-[var(--th-info-text)]',
  initiated: 'bg-[var(--th-primary-bg)] text-[var(--th-primary-text)]',
  ringing: 'bg-[var(--th-warning-bg)] text-[var(--th-warning-text)]',
  cancelled: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
  canceled: 'bg-[var(--th-surface)] text-[var(--th-text-muted)]',
};

export const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  failed: 'Failed',
  in_progress: 'In Progress',
  initiated: 'Initiated',
  ringing: 'Ringing',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
};

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-[var(--th-success-icon)]',
  negative: 'bg-[var(--th-error-icon)]',
  neutral: 'bg-[var(--th-text-muted)]',
  mixed: 'bg-[var(--th-warning-icon)]',
};

export const DONUT_COLORS: Record<string, string> = {
  completed: 'var(--th-success-icon)',
  failed: 'var(--th-error-icon)',
  in_progress: 'var(--th-info-text)',
  initiated: 'var(--th-primary)',
  ringing: 'var(--th-warning-icon)',
  cancelled: 'var(--th-text-muted)',
  canceled: 'var(--th-text-muted)',
};

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
