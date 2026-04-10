'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useT, useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { SocketProvider, useSocket } from '@/lib/socket';
import IncomingCallCard from '@/components/IncomingCallCard';
import BottomTabBar from '@/components/BottomTabBar';
import { navItems, getBottomTabs, getMoreItems } from './_lib/nav-config';

function ConnectionIndicator() {
  const { connected } = useSocket();
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      connected
        ? 'bg-[var(--th-success-bg)] text-[var(--th-success-text)]'
        : 'bg-[var(--th-error-bg)] text-[var(--th-error-text)]'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        connected ? 'bg-[var(--th-success-icon)] animate-pulse' : 'bg-[var(--th-error-icon)]'
      }`} />
      {connected ? 'Live' : 'Offline'}
    </span>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading, user, workspace, logout, setWorkspace } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const { lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) router.replace('/login');
  }, [token, isLoading, router]);

  // Fetch current workspace plan + role (may be stale in localStorage)
  useEffect(() => {
    if (!token || !workspace) return;
    Promise.all([
      api.get<{ role?: string }>('/auth/me').catch(() => ({})),
      api.get<{ plan?: string }>('/billing/balance').catch(() => ({})),
    ]).then(([me, billing]) => {
      const newRole = (me as any).role || workspace.role;
      const newPlan = (billing as any).plan || workspace.plan;
      if (newRole !== workspace.role || newPlan !== workspace.plan) {
        setWorkspace({ ...workspace, role: newRole, plan: newPlan });
      }
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--th-page)]">
        <div className="w-8 h-8 border-2 border-[var(--th-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'U';
  const plan = workspace?.plan || 'translator';

  const sidebarContent = (
    <>
      {/* Logo + Live indicator */}
      <div className="px-5 h-16 flex items-center gap-3 border-b border-[var(--th-sidebar-border)]">
        <div className="w-8 h-8 bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.4)]">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        </div>
        <div>
          <div className="text-white font-bold text-sm leading-tight">Caller</div>
          <div className="text-[var(--th-sidebar-label)] text-[10px] truncate max-w-[140px]">{workspace?.name ?? 'Workspace'}</div>
        </div>
        <div className="ml-auto">
          <ConnectionIndicator />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {(() => {
          const isTranslatorOnly = plan === 'translator';

          const translatorOps = ['/dashboard/calls', '/dashboard/dialer', '/dashboard/translator'];
          const fullOps = [...translatorOps, '/dashboard/missions'];

          return [
            { label: t('nav.sectionOverview') || 'Overview', items: navItems.filter(i => i.href === '/dashboard') },
            { label: t('nav.sectionOperations') || 'Operations', items: navItems.filter(i => (isTranslatorOnly ? translatorOps : fullOps).includes(i.href)) },
            ...(!isTranslatorOnly ? [
              { label: t('nav.sectionAi') || 'AI Config', items: navItems.filter(i => ['/dashboard/agents', '/dashboard/knowledge', '/dashboard/prompts', '/dashboard/skills'].includes(i.href)) },
              { label: t('nav.sectionIntegrations') || 'Integrations', items: navItems.filter(i => ['/dashboard/connectors'].includes(i.href)) },
            ] : []),
            { label: t('nav.sectionSystem') || 'System', items: navItems.filter(i => {
              const systemItems = isTranslatorOnly
                ? ['/dashboard/billing', '/dashboard/settings']
                : ['/dashboard/audit', '/dashboard/billing', '/dashboard/settings'];
              return systemItems.includes(i.href);
            }) },
          ];
        })().filter(section => section.items.length > 0).map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            <div className="px-3 mb-2 text-[10px] font-semibold text-[var(--th-sidebar-label)] uppercase tracking-widest">{section.label}</div>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                        : 'text-[var(--th-sidebar-text)] hover:bg-[var(--th-sidebar-hover)] hover:text-white'
                    }`}
                  >
                    {item.icon}
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Theme + Language Switcher */}
      <div className="px-3 py-2 border-t border-[var(--th-sidebar-border)]">
        <div className="flex items-center gap-1 px-3">
          <span className="text-[10px] text-[var(--th-sidebar-label)] font-medium mr-auto">{t('settings.language')}</span>
          <button
            onClick={() => setLang('en')}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              lang === 'en'
                ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-[0_1px_4px_rgba(99,102,241,0.3)]'
                : 'text-[var(--th-sidebar-label)] hover:text-[var(--th-sidebar-text)]'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('ru')}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              lang === 'ru'
                ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white shadow-[0_1px_4px_rgba(99,102,241,0.3)]'
                : 'text-[var(--th-sidebar-label)] hover:text-[var(--th-sidebar-text)]'
            }`}
          >
            RU
          </button>
          <span className="mx-1 w-px h-3 bg-[var(--th-sidebar-border)]" />
          <button
            onClick={toggle}
            className="p-1 rounded text-[var(--th-sidebar-label)] hover:text-[var(--th-sidebar-text)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Upgrade CTA — translator plan only */}
      {workspace?.plan === 'translator' && (
        <div className="px-3 py-2">
          <Link href="/dashboard/billing"
            className="block p-3 rounded-xl overflow-hidden relative group transition-all hover:shadow-[0_4px_20px_rgba(99,102,241,0.25)]"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }}>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                <span className="text-xs font-bold text-indigo-300">Upgrade to Agents</span>
              </div>
              <p className="text-[10px] text-[var(--th-sidebar-label)] leading-relaxed">
                AI phone agents, call recording, knowledge base & more
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* User */}
      <div className="px-3 py-4 border-t border-[var(--th-sidebar-border)]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg group hover:bg-[var(--th-sidebar-hover)] cursor-pointer transition-colors" onClick={logout}>
          <div className="w-8 h-8 bg-[var(--th-primary)]/20 rounded-full flex items-center justify-center shrink-0">
            <span className="text-[var(--th-primary-light)] text-xs font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{user?.email}</div>
            <div className="text-[10px] text-[var(--th-sidebar-label)]">{t('login.signOut')}</div>
          </div>
          <svg className="w-3.5 h-3.5 text-[var(--th-sidebar-label)] group-hover:text-[var(--th-sidebar-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
        </div>
      </div>
    </>
  );

  return (
    <SocketProvider>
    <div className="flex h-screen overflow-hidden bg-[var(--th-page)]">
      <IncomingCallCard />

      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-[240px] bg-[var(--th-sidebar)] flex-col border-r border-[var(--th-sidebar-border)] shrink-0">
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar — slim: workspace name + connection status */}
        <div className="md:hidden h-12 px-4 flex items-center justify-between border-b border-[var(--th-card-border-subtle)] bg-[var(--th-topbar)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-[var(--th-primary)] to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--th-text)' }}>
              {workspace?.name ?? 'Caller'}
            </span>
          </div>
          <ConnectionIndicator />
        </div>

        {/* Page content — with safe bottom padding on mobile for tab bar */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-5 safe-bottom md:pb-5" key={pathname}>
          <div className="animate-page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <BottomTabBar
        tabs={getBottomTabs(plan)}
        moreItems={getMoreItems(plan)}
      />
    </div>
    </SocketProvider>
  );
}
