'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

const ITEMS = [
  { id: 'general', icon: 'person', key: 'settings.general', danger: false },
  { id: 'notifications', icon: 'notifications', key: 'settings.notifications', danger: false },
  { id: 'appearance', icon: 'palette', key: 'settings.appearance', danger: false },
  { id: 'danger', icon: 'warning', key: 'settings.dangerZone', danger: true },
] as const;

export function SettingsNav() {
  const t = useT();
  const [active, setActive] = useState<string>('general');

  useEffect(() => {
    const compute = () => {
      const container = document.getElementById(ITEMS[0].id)?.closest('main');
      // At the bottom of the scroll container the last section can never reach
      // the activation line — treat scrolled-to-bottom as "last section active".
      if (container && container.scrollTop + container.clientHeight >= container.scrollHeight - 8) {
        setActive(ITEMS[ITEMS.length - 1].id);
        return;
      }
      // Otherwise: the last section whose top is above the activation line.
      const line = window.innerHeight * 0.25;
      let current: string = ITEMS[0].id;
      for (const { id } of ITEMS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    compute();
    document.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      document.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, []);

  return (
    <nav className="hidden lg:block sticky top-1 space-y-0.5" aria-label="Settings sections">
      {ITEMS.map(item => {
        const on = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-left transition-all"
            style={
              on
                ? item.danger
                  ? { background: 'var(--th-error-bg)', color: 'var(--th-error-text)' }
                  : { background: 'var(--th-primary-bg)', color: 'var(--th-primary-text)' }
                : { color: 'var(--th-text-muted)' }
            }
            onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--th-surface)'; }}
            onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="material-symbols-outlined text-[18px] leading-none">{item.icon}</span>
            <span className="truncate">{t(item.key)}</span>
          </button>
        );
      })}
    </nav>
  );
}
