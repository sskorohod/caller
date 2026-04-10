'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { useIsMobile } from '@/lib/useBreakpoint';
import MobileSheet from '@/components/MobileSheet';
import { SECTIONS, TRANSLATOR_SECTIONS } from '../_lib/constants';
import type { SectionId } from '../_lib/types';

export function SettingsNav({
  activeSection,
  onSelect,
  plan,
}: {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
  plan: string;
}) {
  const t = useT();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const visible = SECTIONS.filter(s =>
    plan === 'translator' ? TRANSLATOR_SECTIONS.includes(s.id) : true
  );

  const activeLabel = visible.find(s => s.id === activeSection);
  const ActiveIcon = activeLabel?.icon;

  // Mobile: button that opens a bottom sheet
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] min-h-[44px]"
        >
          <div className="flex items-center gap-2.5">
            {ActiveIcon && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-r from-[var(--th-primary)] to-indigo-600">
                <ActiveIcon className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <span className="text-sm font-semibold text-[var(--th-text)]">{activeLabel ? t(activeLabel.labelKey) : ''}</span>
          </div>
          <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {sheetOpen && (
          <MobileSheet onClose={() => setSheetOpen(false)} title={t('settings.title')}>
            <div className="space-y-1">
              {visible.map(s => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { onSelect(s.id); setSheetOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm min-h-[44px] transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold'
                        : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-white/20' : 'bg-[var(--th-surface)]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{t(s.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </MobileSheet>
        )}
      </>
    );
  }

  // Desktop: sidebar nav
  return (
    <div className="md:w-56 shrink-0">
      <nav className="md:sticky md:top-0 flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 md:gap-0.5 pb-3 md:pb-0">
        {/* Title */}
        <div className="hidden md:flex items-center gap-2.5 px-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 flex items-center justify-center shadow-[0_2px_8px_var(--th-shadow-primary)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--th-text)]">{t('settings.title')}</p>
            <p className="text-[10px] text-[var(--th-text-muted)]">{t('settings.workspaceSettings')}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block h-px bg-[var(--th-card-border-subtle)] mx-3 mb-2" />

        {visible.map(s => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`relative flex items-center gap-2.5 md:gap-3 px-3 py-2.5 md:py-2.5 rounded-xl text-[13px] whitespace-nowrap transition-all duration-200 shrink-0 md:w-full md:text-left ${
                active
                  ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_12px_var(--th-shadow-primary)]'
                  : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] hover:text-[var(--th-text)]'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                active
                  ? 'bg-white/20'
                  : 'bg-[var(--th-surface)]'
              }`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span>{t(s.labelKey)}</span>
              {active && (
                <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white/60" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
