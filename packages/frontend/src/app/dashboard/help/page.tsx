'use client';
import { useState, useCallback } from 'react';
import { useT, useI18n } from '@/lib/i18n';
import { HELP_CATEGORIES } from './_lib/help-data';
import { HelpSidebar } from './_components/HelpSidebar';
import { HelpArticle } from './_components/HelpArticle';
import { SupportChat } from './_components/SupportChat';

const CAT_COLORS: Record<string, { accent: string; gradient: string }> = {
  'getting-started': { accent: '#6366f1', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.02) 100%)' },
  'billing':         { accent: '#10b981', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.02) 100%)' },
  'providers':       { accent: '#f59e0b', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.02) 100%)' },
  'agents':          { accent: '#8b5cf6', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.02) 100%)' },
  'calls':           { accent: '#3b82f6', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.02) 100%)' },
  'translator':      { accent: '#06b6d4', gradient: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(6,182,212,0.02) 100%)' },
  'missions':        { accent: '#ec4899', gradient: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(236,72,153,0.02) 100%)' },
  'integrations':    { accent: '#f97316', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.02) 100%)' },
  'settings':        { accent: '#64748b', gradient: 'linear-gradient(135deg, rgba(100,116,139,0.12) 0%, rgba(100,116,139,0.02) 100%)' },
};

export default function HelpPage() {
  const t = useT();
  const { lang } = useI18n();
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<null | 'sidebar' | 'article' | 'support'>(null);
  const [showSupport, setShowSupport] = useState(false);

  const handleSelect = useCallback((catId: string, artId: string) => {
    setActiveCatId(catId);
    setActiveArticleId(artId);
    setMobileView('article');
  }, []);

  const handleCatSelect = useCallback((catId: string) => {
    setActiveCatId(catId);
    setMobileView('sidebar');
  }, []);

  const handleMobileBack = useCallback(() => {
    if (mobileView === 'article') {
      setMobileView('sidebar');
    } else if (mobileView === 'support') {
      setMobileView(null);
    } else {
      setMobileView(null);
      setActiveCatId(null);
    }
  }, [mobileView]);

  const activeArticle = activeArticleId
    ? HELP_CATEGORIES.flatMap(c => c.articles).find(a => a.id === activeArticleId)
    : null;
  const activeContent = activeArticle?.content[lang as 'ru' | 'en'] || activeArticle?.content.en || '';
  const activeCat = activeCatId ? HELP_CATEGORIES.find(c => c.id === activeCatId) : null;

  // Find category color for active article
  const activeCatColor = activeCatId ? CAT_COLORS[activeCatId] : null;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {mobileView && (
          <button
            onClick={handleMobileBack}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--th-card)] border border-[var(--th-card-border-subtle)] hover:bg-[var(--th-card-hover)] transition-colors"
          >
            <svg className="w-4 h-4 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }}>
          <span className="material-symbols-outlined text-lg" style={{ color: '#818cf8', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>help</span>
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[var(--th-text)]">{t('help.title')}</h1>
          <p className="text-[11px] md:text-xs text-[var(--th-text-muted)] mt-0.5">{t('help.subtitle')}</p>
        </div>
      </div>

      {/* ── Desktop layout ─────────────────��───────────────────── */}
      <div className="hidden md:grid md:grid-cols-12 gap-3 md:gap-4">
        {/* Sidebar */}
        <div className="col-span-4 lg:col-span-3">
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-3 sticky top-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            <HelpSidebar
              categories={HELP_CATEGORIES}
              catColors={CAT_COLORS}
              activeArticleId={activeArticleId}
              activeCatId={activeCatId}
              onSelect={(catId, artId) => { setShowSupport(false); handleSelect(catId, artId); }}
              lang={lang}
              t={t}
            />
            {/* Support button */}
            <div className="mt-3 pt-3 border-t border-[var(--th-card-border-subtle)]">
              <button
                onClick={() => { setShowSupport(!showSupport); setActiveArticleId(null); setActiveCatId(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  showSupport
                    ? 'bg-[var(--th-primary)]/10 text-[var(--th-primary)]'
                    : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-card-hover)]'
                }`}
              >
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: showSupport ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 400" }}>
                  support_agent
                </span>
                {t('help.support')}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="col-span-8 lg:col-span-9">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-5 md:p-6 lg:p-8 min-h-[60vh] shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            {showSupport ? (
              <>
                <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: '#6366f1' }} />
                <div className="relative">
                  <SupportChat />
                </div>
              </>
            ) : (
              <>
                {/* Glow accent from active category */}
                {activeCatColor && (
                  <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-15 blur-3xl pointer-events-none transition-all duration-500" style={{ background: activeCatColor.accent }} />
                )}
                <div className="relative">
                  {activeArticle ? (
                    <>
                      {/* Breadcrumb */}
                      {activeCat && (
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--th-card-border-subtle)]">
                          <span className="material-symbols-outlined text-sm" style={{ color: activeCatColor?.accent || '#6366f1', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                            {activeCat.icon}
                          </span>
                          <span className="text-[11px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t(activeCat.titleKey)}</span>
                          <svg className="w-3 h-3 text-[var(--th-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                          <span className="text-[11px] font-semibold text-[var(--th-text)] tracking-wider">{t(activeArticle.titleKey)}</span>
                        </div>
                      )}
                      <HelpArticle content={activeContent} accentColor={activeCatColor?.accent} />
                    </>
                  ) : (
                    <WelcomeScreen categories={HELP_CATEGORIES} catColors={CAT_COLORS} onSelect={handleSelect} lang={lang} t={t} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────────────── */}
      <div className="md:hidden">
        {!mobileView && (
          <div className="space-y-3">
            {/* Quick-start hero */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--th-card-border-subtle)] p-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.04) 100%)' }}>
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl" style={{ background: '#6366f1' }} />
              <div className="relative">
                <span className="material-symbols-outlined text-2xl mb-2 block" style={{ color: '#818cf8', fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_stories</span>
                <h2 className="text-sm font-bold text-[var(--th-text)] mb-1">{t('help.welcomeTitle')}</h2>
                <p className="text-[11px] text-[var(--th-text-muted)]">{t('help.welcomeSubtitle')}</p>
              </div>
            </div>

            {/* Category cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {HELP_CATEGORIES.map(cat => {
                const colors = CAT_COLORS[cat.id] || CAT_COLORS['getting-started'];
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCatSelect(cat.id)}
                    className="relative overflow-hidden rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-3.5 text-left hover:shadow-[0_2px_8px_var(--th-shadow),0_12px_32px_var(--th-card-glow)] transition-all duration-300 group"
                  >
                    <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20" style={{ background: colors.accent }} />
                    <div className="relative">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ background: `${colors.accent}18` }}>
                        <span className="material-symbols-outlined text-base" style={{ color: colors.accent, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                          {cat.icon}
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold text-[var(--th-text)] leading-tight">{t(cat.titleKey)}</div>
                      <div className="text-[10px] text-[var(--th-text-muted)] mt-1">
                        {cat.articles.length} {lang === 'ru' ? 'статей' : 'articles'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Support card */}
            <button
              onClick={() => setMobileView('support')}
              className="w-full relative overflow-hidden rounded-xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-3.5 text-left hover:shadow-[0_2px_8px_var(--th-shadow)] transition-all group"
            >
              <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" style={{ background: '#6366f1' }} />
              <div className="relative flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                  <span className="material-symbols-outlined text-base" style={{ color: '#818cf8', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>support_agent</span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[var(--th-text)]">{t('help.support')}</div>
                  <div className="text-[10px] text-[var(--th-text-muted)]">{t('help.support.subtitle')}</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {mobileView === 'support' && (
          <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            <SupportChat />
          </div>
        )}

        {mobileView === 'sidebar' && activeCat && (() => {
          const colors = CAT_COLORS[activeCat.id] || CAT_COLORS['getting-started'];
          return (
            <div className="rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] overflow-hidden shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
              {/* Category header */}
              <div className="relative overflow-hidden p-4 border-b border-[var(--th-card-border-subtle)]" style={{ background: colors.gradient }}>
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-15 blur-2xl" style={{ background: colors.accent }} />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${colors.accent}20` }}>
                    <span className="material-symbols-outlined text-xl" style={{ color: colors.accent, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                      {activeCat.icon}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--th-text)]">{t(activeCat.titleKey)}</div>
                    <div className="text-[10px] text-[var(--th-text-muted)]">{activeCat.articles.length} {lang === 'ru' ? 'статей' : 'articles'}</div>
                  </div>
                </div>
              </div>
              {/* Articles list */}
              <div className="p-2 space-y-0.5">
                {activeCat.articles.map((art, i) => (
                  <button
                    key={art.id}
                    onClick={() => handleSelect(activeCat.id, art.id)}
                    className="w-full text-left px-3 py-3 rounded-xl text-sm text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:bg-[var(--th-card-hover)] transition-colors flex items-center gap-3 group"
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: `${colors.accent}12`, color: colors.accent }}>
                      {i + 1}
                    </span>
                    <span className="flex-1">{t(art.titleKey)}</span>
                    <svg className="w-3.5 h-3.5 shrink-0 text-[var(--th-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {mobileView === 'article' && activeArticle && (
          <div className="relative overflow-hidden rounded-2xl border border-[var(--th-card-border-subtle)] bg-[var(--th-card)] p-4 shadow-[0_1px_3px_var(--th-shadow),0_8px_24px_var(--th-card-glow)]">
            {activeCatColor && (
              <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: activeCatColor.accent }} />
            )}
            {/* Mobile breadcrumb */}
            {activeCat && (
              <div className="relative flex items-center gap-2 mb-3 pb-2.5 border-b border-[var(--th-card-border-subtle)]">
                <span className="material-symbols-outlined text-sm" style={{ color: activeCatColor?.accent, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                  {activeCat.icon}
                </span>
                <span className="text-[10px] font-semibold text-[var(--th-text-muted)] uppercase tracking-wider">{t(activeCat.titleKey)}</span>
              </div>
            )}
            <div className="relative">
              <HelpArticle content={activeContent} accentColor={activeCatColor?.accent} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Welcome / landing screen ───────────────��──────────────────────── */
function WelcomeScreen({
  categories,
  catColors,
  onSelect,
  lang,
  t,
}: {
  categories: typeof HELP_CATEGORIES;
  catColors: typeof CAT_COLORS;
  onSelect: (catId: string, artId: string) => void;
  lang: string;
  t: (key: string) => string;
}) {
  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 shadow-[0_4px_16px_rgba(99,102,241,0.15)]"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }}>
          <span className="material-symbols-outlined text-3xl" style={{ color: '#818cf8', fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
            auto_stories
          </span>
        </div>
        <h2 className="text-lg font-bold text-[var(--th-text)] mb-1.5">{t('help.welcomeTitle')}</h2>
        <p className="text-sm text-[var(--th-text-muted)] max-w-md mx-auto">{t('help.welcomeSubtitle')}</p>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(cat => {
          const colors = catColors[cat.id] || catColors['getting-started'];
          return (
            <button
              key={cat.id}
              onClick={() => { if (cat.articles[0]) onSelect(cat.id, cat.articles[0].id); }}
              className="relative overflow-hidden rounded-xl border border-[var(--th-card-border-subtle)] p-4 text-left hover:border-[color:var(--th-border)] hover:shadow-[0_4px_16px_var(--th-card-glow)] transition-all duration-300 group"
              style={{ background: colors.gradient }}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-20" style={{ background: colors.accent }} />
              <div className="relative">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${colors.accent}18` }}>
                  <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform" style={{ color: colors.accent, fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                    {cat.icon}
                  </span>
                </div>
                <div className="text-sm font-semibold text-[var(--th-text)] mb-0.5">{t(cat.titleKey)}</div>
                <div className="text-[11px] text-[var(--th-text-muted)]">
                  {cat.articles.length} {lang === 'ru' ? 'статей' : 'articles'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
