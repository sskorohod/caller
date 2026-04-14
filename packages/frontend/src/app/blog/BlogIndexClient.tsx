'use client';
import Link from 'next/link';
import { useLang } from '@/app/_landing/useLang';
import { articles } from './_lib/articles';
import BlogNavbar from './_components/BlogNavbar';

export default function BlogIndexClient() {
  const { lang, t } = useLang();

  return (
    <div className="min-h-screen" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .blog-card { background: rgba(26,32,44,0.55); backdrop-filter: blur(24px); border: 0.5px solid rgba(140,144,159,0.12); transition: all 0.3s ease; }
        .blog-card:hover { transform: translateY(-3px); box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 0 32px rgba(129,140,248,0.08); border-color: rgba(129,140,248,0.2); }
        .gradient-text { background: linear-gradient(135deg, #818cf8, #4d8eff, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      <BlogNavbar activeBlog />

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        <h1 className="font-headline text-4xl sm:text-5xl font-bold text-white mb-4">
          <span className="gradient-text">{t('Blog', 'Блог')}</span>
        </h1>
        <p className="text-lg" style={{ color: '#a0a8c0' }}>
          {t(
            'Guides on phone translation, interpreter services, and breaking language barriers.',
            'Гайды по телефонному переводу, услугам переводчика и преодолению языковых барьеров.'
          )}
        </p>
      </div>

      {/* Articles grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid gap-6">
          {articles.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`}>
              <article className="blog-card rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8' }}>
                    {article.locale === 'ru' ? 'RU' : 'EN'}
                  </span>
                  <span className="text-xs" style={{ color: '#a0a8c0' }}>
                    {new Date(article.publishedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(160,168,192,0.6)' }}>
                    · {lang === 'ru' ? article.readTimeRu : article.readTime} {t('read', 'чтения')}
                  </span>
                </div>
                <h2 className="font-headline text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">
                  {lang === 'ru' ? article.titleRu : article.title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: '#a0a8c0' }}>
                  {lang === 'ru' ? article.descriptionRu : article.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {article.keywords.slice(0, 3).map((kw) => (
                    <span key={kw} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(129,140,248,0.08)', color: 'rgba(129,140,248,0.6)' }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA banner */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.06), rgba(77,142,255,0.06))', border: '1px solid rgba(129,140,248,0.12)' }}>
          <h3 className="font-headline text-xl font-bold text-white mb-2">
            {t('Ready to try Live Translator?', 'Готовы попробовать Live Translator?')}
          </h3>
          <p className="text-sm mb-5" style={{ color: '#a0a8c0' }}>
            {t(
              'Merge our AI translator into any phone call. $0.15/min. No app needed.',
              'Добавьте AI-переводчика в любой звонок. $0.15/мин. Без приложений.'
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/translator"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', boxShadow: '0 4px 24px rgba(129,140,248,0.2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>translate</span>
              {t('Learn More', 'Подробнее')}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: '#a0a8c0', border: '1px solid rgba(140,144,159,0.15)' }}
            >
              {t('See Pricing', 'Тарифы')}
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(221,226,243,0.06)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-xs" style={{ color: 'rgba(160,168,192,0.4)' }}>
            &copy; {new Date().getFullYear()} Caller. {t('All rights reserved.', 'Все права защищены.')}
          </p>
        </div>
      </footer>
    </div>
  );
}
