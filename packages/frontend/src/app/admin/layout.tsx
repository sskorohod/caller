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

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--th-page)', color: 'var(--th-text)' }}>
        <div className="text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-sm" style={{ color: 'var(--th-text-secondary)' }}>Admin panel is restricted to the project owner.</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!ready) return null;

  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--th-page)', color: 'var(--th-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .glass-panel { background: var(--th-card); backdrop-filter: blur(20px); border: 0.5px solid var(--th-border); }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>

      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 shrink-0 border-r flex-col h-screen sticky top-0" style={{ background: 'var(--th-sidebar)', borderColor: 'var(--th-sidebar-border)' }}>
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: 'var(--th-sidebar-border)' }}>
          <Link href="/admin" className="flex items-center gap-2 font-headline font-bold text-lg tracking-tight">
            <span className="material-symbols-outlined" style={{ color: 'var(--th-primary)', fontVariationSettings: "'FILL' 1" }}>translate</span>
            <span>Admin</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--th-sidebar-label)' }}>{section.label}</div>
              {section.items.map((item) => (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${isActive(item.href) ? '' : 'hover:bg-[var(--th-sidebar-hover)]'}`}
                  style={isActive(item.href) ? { background: 'var(--th-primary-bg)', color: 'var(--th-primary)' } : { color: 'var(--th-sidebar-text)' }}>
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--th-sidebar-border)' }}>
          <Link href="/dashboard" className="flex items-center gap-2 text-xs opacity-50 hover:opacity-100 transition">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-h-screen overflow-x-hidden flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden h-12 px-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--th-border)' }}>
          <Link href="/admin" className="flex items-center gap-2 font-bold text-sm">
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--th-primary)' }}>translate</span>
            Admin
          </Link>
          <Link href="/dashboard" className="text-xs opacity-60 hover:opacity-100 transition flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Dashboard
          </Link>
        </div>

        <main className="flex-1 safe-bottom md:pb-0" key={pathname}>
          <div className="max-w-7xl mx-auto px-4 md:px-0 animate-page-enter">
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
        <div className="flex items-center justify-around h-16">
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
                <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1" style={{ color: 'var(--th-text-muted)' }}>
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
