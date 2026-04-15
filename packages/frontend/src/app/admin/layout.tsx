'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { navSections, adminBottomTabs, adminMoreSections } from './_lib/nav-config';
import MobileSheet from '@/components/MobileSheet';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('caller_token');
    if (!token) { router.replace('/login?returnUrl=/admin'); return; }

    fetch((process.env.NEXT_PUBLIC_API_URL || '/api') + '/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.role === 'owner') {
          setReady(true);
        } else {
          setDenied(true);
        }
      })
      .catch(() => { router.replace('/login?returnUrl=/admin'); });
  }, [router]);

  useEffect(() => { setShowMore(false); }, [pathname]);

  // Propagate data-theme to admin wrapper
  const [theme, setTheme] = useState<string>('');
  useEffect(() => {
    const root = document.documentElement;
    setTheme(root.getAttribute('data-theme') || '');
    const observer = new MutationObserver(() => {
      setTheme(root.getAttribute('data-theme') || '');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (denied) {
    return (
      <div data-admin data-theme={theme || undefined} className="min-h-screen flex items-center justify-center" style={{ background: 'var(--th-page)', color: 'var(--th-text)' }}>
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--th-text-muted)' }}>lock</span>
          <h1 className="text-xl font-headline">Access Denied</h1>
          <p className="text-sm" style={{ color: 'var(--th-text-secondary)', lineHeight: 1.6 }}>Admin panel is restricted to the project owner.</p>
          <button onClick={() => router.push('/dashboard')} className="btn-secondary px-6 py-2 text-sm font-medium">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!ready) return null;

  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div
      data-admin
      data-theme={theme || undefined}
      className="min-h-screen flex"
      style={{
        background: 'var(--th-page)',
        color: 'var(--th-text)',
        fontFamily: "system-ui, -apple-system, 'Inter', 'Segoe UI', sans-serif",
        lineHeight: 1.6,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        [data-admin] .font-headline {
          font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500;
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>

      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0"
        style={{
          background: 'var(--th-sidebar)',
          borderRight: '1px solid var(--th-sidebar-border)',
        }}
      >
        <div className="h-14 flex items-center px-5" style={{ borderBottom: '1px solid var(--th-sidebar-border)' }}>
          <Link href="/admin" className="flex items-center gap-2.5">
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: 'var(--th-primary)', fontVariationSettings: "'FILL' 1" }}
            >
              shield_person
            </span>
            <span className="font-headline text-base" style={{ color: '#faf9f5' }}>Admin</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 scrollbar-none">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <div
                className="px-3 mb-1.5 text-[10px] font-medium uppercase tracking-widest"
                style={{ color: 'var(--th-sidebar-label)', letterSpacing: '0.5px' }}
              >
                {section.label}
              </div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all mb-0.5"
                  style={
                    isActive(item.href)
                      ? {
                          background: 'var(--th-primary-bg)',
                          color: 'var(--th-primary)',
                          boxShadow: `var(--th-primary-bg) 0px 0px 0px 0px, var(--th-primary) 0px 0px 0px 1px inset`,
                        }
                      : { color: 'var(--th-sidebar-text)' }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive(item.href))
                      e.currentTarget.style.background = 'var(--th-sidebar-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive(item.href))
                      e.currentTarget.style.background = '';
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--th-sidebar-border)' }}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: 'var(--th-sidebar-label)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--th-sidebar-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--th-sidebar-label)'; }}
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-h-screen overflow-x-hidden flex flex-col">
        {/* Mobile top bar */}
        <div
          className="md:hidden h-12 px-4 flex items-center justify-between shrink-0"
          style={{
            background: 'var(--th-topbar)',
            borderBottom: '1px solid var(--th-border)',
          }}
        >
          <Link href="/admin" className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-base"
              style={{ color: 'var(--th-primary)', fontVariationSettings: "'FILL' 1" }}
            >
              shield_person
            </span>
            <span className="font-headline text-sm">Admin</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs flex items-center gap-1 min-h-[44px]"
            style={{ color: 'var(--th-text-muted)' }}
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Dashboard
          </Link>
        </div>

        <main className="flex-1 safe-bottom md:pb-0" key={pathname}>
          <div className="max-w-6xl mx-auto px-4 md:px-6 animate-page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: 'var(--th-card)',
          borderTop: '1px solid var(--th-border)',
          paddingBottom: 'var(--th-safe-area-bottom)',
        }}
      >
        <div className="flex items-center justify-around h-14">
          {adminBottomTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 touch-target transition-colors"
              style={{ color: isActive(tab.href) ? 'var(--th-primary)' : 'var(--th-text-muted)' }}
            >
              <span className="material-symbols-outlined text-xl">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.key}</span>
            </Link>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex flex-col items-center justify-center gap-0.5 touch-target transition-colors"
            style={{ color: showMore ? 'var(--th-primary)' : 'var(--th-text-muted)' }}
            aria-label="More navigation options"
          >
            <span className="material-symbols-outlined text-xl">more_horiz</span>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {showMore && (
        <MobileSheet onClose={() => setShowMore(false)} title="More">
          <div className="flex flex-col gap-4">
            {adminMoreSections.map((section) => (
              <div key={section.label}>
                <div
                  className="text-[10px] uppercase tracking-widest font-medium mb-2 px-1"
                  style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}
                >
                  {section.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors card-press"
                      style={{
                        color: isActive(item.href) ? 'var(--th-primary)' : 'var(--th-text)',
                        background: isActive(item.href) ? 'var(--th-primary-bg)' : 'transparent',
                      }}
                    >
                      <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </MobileSheet>
      )}
    </div>
  );
}
