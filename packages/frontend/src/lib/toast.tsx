'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  removing: boolean;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;
const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4000;
const ANIMATION_MS = 300;

// ─── Colors ─────────────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-[var(--th-success-bg)]',
    border: 'border-[var(--th-success-bg)]',
    text: 'text-[var(--th-success-text)]',
    icon: 'M4.5 12.75l6 6 9-13.5',
  },
  error: {
    bg: 'bg-[var(--th-error-bg)]',
    border: 'border-[var(--th-error-bg)]',
    text: 'text-[var(--th-error-text)]',
    icon: 'M6 18L18 6M6 6l12 12',
  },
  info: {
    bg: 'bg-[var(--th-primary-bg)]',
    border: 'border-[var(--th-primary-bg)]',
    text: 'text-[var(--th-primary-text)]',
    icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  },
};

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    // Start removal animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    // Actually remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, ANIMATION_MS);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts(prev => {
      const next = [...prev, { id, type, message, removing: false }];
      // Keep only MAX_VISIBLE
      if (next.length > MAX_VISIBLE) {
        const toRemove = next[0];
        // Schedule immediate removal of oldest
        setTimeout(() => removeToast(toRemove.id), 0);
      }
      return next;
    });

    // Auto-dismiss
    const timer = setTimeout(() => {
      removeToast(id);
      timersRef.current.delete(id);
    }, AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const success = useCallback((msg: string) => addToast('success', msg), [addToast]);
  const error = useCallback((msg: string) => addToast('error', msg), [addToast]);
  const info = useCallback((msg: string) => addToast('info', msg), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}

      {/* Toast container — fixed top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
        {toasts.map(toast => {
          const style = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all ${style.bg} ${style.border} ${
                toast.removing
                  ? 'opacity-0 translate-x-4'
                  : 'opacity-100 translate-x-0 animate-[slideIn_0.3s_ease-out]'
              }`}
              style={{ transitionDuration: `${ANIMATION_MS}ms` }}
            >
              <svg className={`w-5 h-5 shrink-0 mt-0.5 ${style.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
              </svg>
              <p className={`text-sm font-medium leading-relaxed ${style.text}`}>{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className={`ml-auto shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors ${style.text} opacity-60 hover:opacity-100`}
                aria-label="Close"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(1rem); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
