'use client';

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--th-text)]">{title}</h3>
      {description && <p className="text-xs text-[var(--th-text-muted)] mt-1">{description}</p>}
    </div>
  );
}
