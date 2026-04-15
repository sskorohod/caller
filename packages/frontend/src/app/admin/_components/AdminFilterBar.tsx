'use client';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface AdminFilterBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function AdminFilterBar({ options, value, onChange }: AdminFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              active
                ? {
                    background: 'var(--th-primary)',
                    color: '#faf9f5',
                    boxShadow: 'var(--th-primary) 0px 0px 0px 0px, var(--th-primary) 0px 0px 0px 1px',
                  }
                : {
                    background: 'var(--th-surface)',
                    color: 'var(--th-text-secondary)',
                    boxShadow: 'var(--th-surface) 0px 0px 0px 0px, var(--th-ring) 0px 0px 0px 1px',
                  }
            }
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className="ml-1 opacity-70">{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
