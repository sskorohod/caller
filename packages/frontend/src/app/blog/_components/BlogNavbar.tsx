'use client';
import Link from 'next/link';
import { useLang, LangSwitcher } from '@/app/_landing/useLang';

export default function BlogNavbar({ activeBlog = false }: { activeBlog?: boolean }) {
  const { t } = useLang();

  return (
    <nav className="sticky top-0 z-50" style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(140,144,159,0.08)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)' }}>
              <span className="material-symbols-outlined text-white text-base" style={{ fontSize: '18px' }}>phone_in_talk</span>
            </div>
            <span className="font-headline font-bold text-white text-lg">Caller</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/translator" className="nav-link">{t('Live Translator', 'Живой переводчик')}</Link>
            <Link href="/pricing" className="nav-link">{t('Pricing', 'Тарифы')}</Link>
            <Link href="/blog" className="nav-link" style={activeBlog ? { color: '#22d3ee' } : undefined}>{t('Blog', 'Блог')}</Link>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)', boxShadow: '0 2px 16px rgba(34,211,238,0.2)' }}
            >
              {t('Get Started', 'Начать')}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
