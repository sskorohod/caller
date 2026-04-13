'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/i18n';
import MobileSheet from './MobileSheet';

export interface TabItem {
  key: string;
  href: string;
  icon: React.ReactNode;
  accent?: boolean;
}

export interface MoreItem {
  section: string;
  items: { key: string; href: string; icon: React.ReactNode }[];
}

interface BottomTabBarProps {
  tabs: TabItem[];
  moreItems?: MoreItem[];
  userEmail?: string;
  onLogout?: () => void;
}

export default function BottomTabBar({ tabs, moreItems = [], userEmail, onLogout }: BottomTabBarProps) {
  const pathname = usePathname();
  const t = useT();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/admin') return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: 'var(--th-card)',
          borderTop: '1px solid var(--th-border)',
          paddingBottom: 'var(--th-safe-area-bottom)',
        }}
      >
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const active = tab.key === '__more__' ? showMore : isActive(tab.href);
            if (tab.key === '__more__') {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className="flex flex-col items-center justify-center gap-0.5 touch-target transition-colors"
                  style={{ color: showMore ? 'var(--th-primary)' : 'var(--th-text-muted)' }}
                >
                  <span className="w-6 h-6 flex items-center justify-center">{tab.icon}</span>
                  <span className="text-[10px] font-medium">{t('nav.more') || 'More'}</span>
                </button>
              );
            }

            return (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setShowMore(false)}
                className={`flex flex-col items-center justify-center gap-0.5 touch-target transition-colors ${
                  tab.accent ? 'relative -mt-4' : ''
                }`}
                style={{ color: active ? 'var(--th-primary)' : 'var(--th-text-muted)' }}
              >
                {tab.accent ? (
                  <span
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, var(--th-primary), var(--th-primary-hover))',
                      color: '#fff',
                    }}
                  >
                    {tab.icon}
                  </span>
                ) : (
                  <span className="w-6 h-6 flex items-center justify-center">{tab.icon}</span>
                )}
                <span className={`text-[10px] font-medium ${tab.accent ? 'mt-0.5' : ''}`}>
                  {t(tab.key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {showMore && moreItems.length > 0 && (
        <MobileSheet onClose={() => setShowMore(false)} title={t('nav.more') || 'More'}>
          <div className="flex flex-col gap-4">
            {moreItems.map((section) => (
              <div key={section.section}>
                <div
                  className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1"
                  style={{ color: 'var(--th-text-muted)' }}
                >
                  {t(section.section)}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors card-press"
                      style={{
                        color: isActive(item.href) ? 'var(--th-primary)' : 'var(--th-text)',
                        background: isActive(item.href) ? 'var(--th-primary-bg)' : 'transparent',
                      }}
                    >
                      <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                      <span className="text-sm font-medium">{t(item.key)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* Logout */}
            {onLogout && (
              <div className="pt-2 border-t border-[var(--th-border)]">
                {userEmail && (
                  <div className="px-3 pb-2">
                    <span className="text-[11px] text-[var(--th-text-muted)] truncate">{userEmail}</span>
                  </div>
                )}
                <button
                  onClick={() => { setShowMore(false); onLogout(); }}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors card-press w-full text-left"
                  style={{ color: 'var(--th-error-text)' }}
                >
                  <span className="w-5 h-5 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium">{t('login.signOut')}</span>
                </button>
              </div>
            )}
          </div>
        </MobileSheet>
      )}
    </>
  );
}
