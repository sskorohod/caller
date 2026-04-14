'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLang, LangSwitcher } from '@/app/_landing/useLang';

export default function BlogNavbar({ activeBlog = false }: { activeBlog?: boolean }) {
  const { t } = useLang();
  const [mobileNav, setMobileNav] = useState(false);

  const links = [
    { label: t('Products', 'Продукты'), href: '/#products' },
    { label: t('Translator', 'Переводчик'), href: '/translator' },
    { label: t('Pricing', 'Цены'), href: '/pricing' },
    { label: t('Blog', 'Блог'), href: '/blog', active: activeBlog },
  ];

  return (
    <header className="fixed top-0 w-full z-50" style={{ background: 'rgba(14, 19, 31, 0.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(221,226,243,0.06)' }}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)' }}>
            <span className="material-symbols-outlined text-base" style={{ color: '#fff', fontVariationSettings: "'FILL' 1" }}>call</span>
          </div>
          <span className="text-lg font-headline font-extrabold tracking-tight">Caller</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          {links.map(l => (
            <Link key={l.label} href={l.href} className="transition-colors hover:text-white" style={{ color: l.active ? '#fff' : '#a0a8c0' }}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitcher />
          <Link href="/login" className="text-sm font-medium transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>{t('Log in', 'Войти')}</Link>
          <Link href="/login?mode=register" className="px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 hidden sm:inline-flex"
            style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
            {t('Get Started', 'Начать')}
          </Link>
          {/* Mobile hamburger */}
          <button className="md:hidden w-10 h-10 flex items-center justify-center" onClick={() => setMobileNav(!mobileNav)}>
            <span className="material-symbols-outlined">{mobileNav ? 'close' : 'menu'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileNav && (
        <div className="md:hidden px-4 pb-4 space-y-1" style={{ background: 'rgba(14, 19, 31, 0.95)', backdropFilter: 'blur(24px)' }}>
          {links.map(item => (
            <Link key={item.label} href={item.href}
              onClick={() => setMobileNav(false)}
              className="block py-3 text-sm font-medium" style={{ color: item.active ? '#fff' : '#a0a8c0' }}>
              {item.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <LangSwitcher className="w-full justify-center" />
            <Link href="/login?mode=register" onClick={() => setMobileNav(false)}
              className="w-full py-3 rounded-xl text-sm font-bold text-center"
              style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
              {t('Get Started Free', 'Начать бесплатно')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
