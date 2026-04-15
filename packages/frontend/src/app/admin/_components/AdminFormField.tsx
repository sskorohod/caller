'use client';

interface AdminFormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

export default function AdminFormField({ label, children, hint }: AdminFormFieldProps) {
  return (
    <div>
      <label
        className="block text-[10px] font-medium uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--th-text-muted)' }}>{hint}</p>
      )}
    </div>
  );
}

// Common input style for reuse
export const adminInputClass =
  'w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm input-base';

export const adminSelectClass =
  'w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded-xl text-sm input-base';
