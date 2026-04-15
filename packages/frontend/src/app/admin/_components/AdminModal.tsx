'use client';
import { useEffect, useRef } from 'react';

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export default function AdminModal({ open, onClose, title, children, actions }: AdminModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center animate-fade-in"
      style={{ background: 'var(--th-overlay)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="rounded-t-2xl md:rounded-xl p-6 w-full md:w-[420px] max-h-[85vh] overflow-y-auto animate-slide-up md:animate-scale-in"
        style={{
          background: 'var(--th-modal)',
          border: '1px solid var(--th-border)',
          boxShadow: 'rgba(0,0,0,0.05) 0px 4px 24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-headline text-lg mb-4" style={{ lineHeight: 1.2 }}>{title}</h3>
        <div className="space-y-4">{children}</div>
        {actions && (
          <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: '1px solid var(--th-border)' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
