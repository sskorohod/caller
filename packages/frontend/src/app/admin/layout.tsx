'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const navSections = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', icon: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/subscribers', icon: 'group', label: 'Subscribers' },
      { href: '/admin/sessions', icon: 'history', label: 'Sessions' },
      { href: '/admin/promo', icon: 'confirmation_number', label: 'Promo Codes' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { href: '/admin/workspaces', icon: 'apartment', label: 'Workspaces' },
      { href: '/admin/finance', icon: 'monitoring', label: 'Finance' },
      { href: '/admin/billing', icon: 'tune', label: 'Billing Config' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { href: '/admin/providers', icon: 'hub', label: 'Providers' },
      { href: '/admin/settings', icon: 'settings', label: 'Settings' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/audit', icon: 'shield', label: 'Audit Log' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('caller_token');
    if (!token) { router.replace('/login?returnUrl=/admin'); return; }

    // Verify user is owner (admin access is restricted to project owner only)
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

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-sm" style={{ color: '#c2c6d6' }}>Admin panel is restricted to the project owner.</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .glass-panel { background: rgba(26, 32, 44, 0.6); backdrop-filter: blur(20px); border: 0.5px solid rgba(140, 144, 159, 0.15); }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>

      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r flex flex-col h-screen sticky top-0" style={{ background: '#0a0f1a', borderColor: 'rgba(221, 226, 243, 0.05)' }}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: 'rgba(221, 226, 243, 0.05)' }}>
          <Link href="/admin" className="flex items-center gap-2 font-headline font-bold text-lg tracking-tight">
            <span className="material-symbols-outlined" style={{ color: '#adc6ff', fontVariationSettings: "'FILL' 1" }}>translate</span>
            <span>Admin</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(194, 198, 214, 0.4)' }}>{section.label}</div>
              {section.items.map((item) => {
                const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${isActive ? '' : 'hover:bg-white/5'}`}
                    style={isActive ? { background: 'rgba(173, 198, 255, 0.1)', color: '#adc6ff' } : { color: 'rgba(194, 198, 214, 0.7)' }}>
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(221, 226, 243, 0.05)' }}>
          <Link href="/dashboard" className="flex items-center gap-2 text-xs opacity-50 hover:opacity-100 transition">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
