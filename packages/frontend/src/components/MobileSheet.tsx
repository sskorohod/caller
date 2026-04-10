'use client';
import { useEffect, useRef, useCallback, useState } from 'react';

interface MobileSheetProps {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[];
}

const DISMISS_THRESHOLD = 120;

export default function MobileSheet({ onClose, title, children, snapPoints }: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleDragStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragOffset(dy);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragging.current = false;
    if (dragOffset > DISMISS_THRESHOLD) {
      onClose();
    }
    setDragOffset(0);
  }, [dragOffset, onClose]);

  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose} aria-label="Close sheet">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'var(--th-overlay)', backdropFilter: 'blur(4px)' }}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Sheet'}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl animate-sheet-up"
        style={{
          background: 'var(--th-card)',
          maxHeight: '85vh',
          transform: `translateY(${dragOffset}px)`,
          transition: dragOffset === 0 ? 'transform 0.25s cubic-bezier(0.2,0,0,1)' : 'none',
          paddingBottom: 'var(--th-safe-area-bottom)',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--th-border)' }} />
        </div>
        {title && (
          <div className="px-5 pb-3 pt-1">
            <h3 className="text-base font-semibold" style={{ color: 'var(--th-text)' }}>{title}</h3>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
