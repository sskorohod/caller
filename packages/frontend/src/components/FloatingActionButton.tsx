'use client';

interface FABProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
}

export default function FloatingActionButton({ icon, label, onClick }: FABProps) {
  return (
    <button
      onClick={onClick}
      className="fixed z-30 md:hidden animate-scale-in shadow-lg active:scale-95 transition-transform"
      style={{
        bottom: 'calc(var(--th-bottom-nav-height) + var(--th-safe-area-bottom) + 16px)',
        right: '16px',
        background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))',
        color: '#fff',
        borderRadius: label ? '24px' : '50%',
        padding: label ? '12px 20px' : '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span className="w-6 h-6 flex items-center justify-center">{icon}</span>
      {label && <span className="text-sm font-semibold whitespace-nowrap">{label}</span>}
    </button>
  );
}
