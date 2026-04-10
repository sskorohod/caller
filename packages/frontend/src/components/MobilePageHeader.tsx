'use client';
import { useRouter } from 'next/navigation';

interface MobilePageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export default function MobilePageHeader({ title, subtitle, backHref, actions }: MobilePageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 mb-4 md:hidden">
      {backHref && (
        <button
          onClick={() => router.push(backHref)}
          className="touch-target flex items-center justify-center -ml-2"
          style={{ color: 'var(--th-text)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold truncate" style={{ color: 'var(--th-text)' }}>{title}</h1>
        {subtitle && (
          <p className="text-xs truncate" style={{ color: 'var(--th-text-secondary)' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
