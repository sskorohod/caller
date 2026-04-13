'use client';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AnimatedSection from '@/app/_landing/AnimatedSection';
import { HelpArticle } from '@/app/dashboard/help/_components/HelpArticle';
import { DOC_SECTIONS, type DocSection, type DocArticle } from './_lib/docs-data';

/* ── Section accent colors ───────────────────────────────────────────── */
const SECTION_COLORS: Record<string, string> = {
  'getting-started': '#6366f1',
  'user-guide': '#8b5cf6',
  'api-reference': '#f59e0b',
  'architecture': '#06b6d4',
};

/* ── Styles ──────────────────────────────────────────────────────────── */
function DocsStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
      .font-headline { font-family: 'Manrope', sans-serif; }
      .glass-panel { background: rgba(26, 32, 44, 0.55); backdrop-filter: blur(24px); border: 0.5px solid rgba(140, 144, 159, 0.12); }
      .gradient-text { background: linear-gradient(135deg, #adc6ff 0%, #818cf8 50%, #d0bcff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200% 200%; animation: gradient-shift 6s ease infinite; }
      @keyframes gradient-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

      .docs-sidebar-item { transition: all 0.15s ease; cursor: pointer; }
      .docs-sidebar-item:hover { background: rgba(255,255,255,0.04); }
      .docs-sidebar-item.active { background: rgba(99,102,241,0.1); }

      .docs-section-header { transition: all 0.15s ease; cursor: pointer; }
      .docs-section-header:hover { background: rgba(255,255,255,0.03); }

      .shimmer-border { background: linear-gradient(90deg, transparent, rgba(173,198,255,0.15), transparent); background-size: 200% 100%; animation: shimmer 3s ease infinite; }
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

      .cta-glow { box-shadow: 0 4px 32px rgba(77,142,255,0.3); transition: all 0.3s ease; }
      .cta-glow:hover { box-shadow: 0 6px 40px rgba(77,142,255,0.45); transform: translateY(-2px); }

      :root {
        --th-text: #e8eaf2;
        --th-text-muted: #a0a8c0;
        --th-surface: #111827;
        --th-card-hover: #1a2035;
        --th-card-border-subtle: rgba(140,144,159,0.12);
      }
    `}</style>
  );
}

/* ── Inner component that uses useSearchParams ───────────────────────── */
function DocsPageInner() {
  const searchParams = useSearchParams();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['getting-started']));
  const [activeArticle, setActiveArticle] = useState<{ section: DocSection; article: DocArticle } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'sections' | 'articles' | 'content'>('sections');
  const [mobileSectionId, setMobileSectionId] = useState<string | null>(null);
  const [mobileHamburger, setMobileHamburger] = useState(false);

  /* ── Handle ?section= param ─────────────────────────────────────── */
  useEffect(() => {
    const sectionParam = searchParams.get('section');
    if (!sectionParam) return;

    const normalized = sectionParam.toLowerCase().replace(/\s+/g, '-');
    const sectionId = normalized === 'api' ? 'api-reference' : normalized;
    const section = DOC_SECTIONS.find(s => s.id === sectionId);
    if (!section) return;

    setExpandedSections(prev => new Set([...prev, sectionId]));
    const firstArticle = section.articles[0];
    if (firstArticle) {
      setActiveArticle({ section, article: firstArticle });
    }
  }, [searchParams]);

  /* ── Set default article on load ─────────────────────────────────── */
  useEffect(() => {
    if (!searchParams.get('section') && !activeArticle) {
      const first = DOC_SECTIONS[0];
      if (first?.articles[0]) {
        setActiveArticle({ section: first, article: first.articles[0] });
      }
    }
  }, []);

  /* ── Search filtering ─────────────────────────────────────────────── */
  const filteredSections = searchQuery
    ? DOC_SECTIONS.map(section => ({
        ...section,
        articles: section.articles.filter(a =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.content.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(s => s.articles.length > 0)
    : DOC_SECTIONS;

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const selectArticle = (section: DocSection, article: DocArticle) => {
    setActiveArticle({ section, article });
    setExpandedSections(prev => new Set([...prev, section.id]));
    setMobileView('content');
  };

  const accent = activeArticle ? SECTION_COLORS[activeArticle.section.id] ?? '#6366f1' : '#6366f1';

  /* ── Sidebar ──────────────────────────────────────────────────────── */
  const SidebarContent = () => (
    <nav>
      {/* Search (sidebar) */}
      <div className="mb-4 relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#606880' }}>search</span>
        <input
          type="text"
          placeholder="Search docs…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(140,144,159,0.12)',
            color: '#e8eaf2',
          }}
        />
      </div>

      {filteredSections.map(section => {
        const sectionColor = SECTION_COLORS[section.id] ?? '#6366f1';
        const isExpanded = expandedSections.has(section.id) || !!searchQuery;

        return (
          <div key={section.id} className="mb-1">
            {/* Section header */}
            <button
              className="docs-section-header w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left"
              onClick={() => toggleSection(section.id)}
              style={{ color: '#e8eaf2' }}
            >
              <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color: sectionColor, fontVariationSettings: "'FILL' 1" }}>
                {section.icon}
              </span>
              <span className="text-xs font-semibold font-headline flex-1">{section.title}</span>
              <span className="material-symbols-outlined text-sm" style={{ color: '#606880', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                expand_more
              </span>
            </button>

            {/* Articles */}
            {isExpanded && (
              <div className="ml-7 mt-0.5 space-y-0.5">
                {section.articles.map(article => {
                  const isActive = activeArticle?.article.id === article.id && activeArticle?.section.id === section.id;
                  return (
                    <button
                      key={article.id}
                      className={`docs-sidebar-item w-full text-left px-3 py-1.5 rounded-lg text-xs ${isActive ? 'active' : ''}`}
                      onClick={() => selectArticle(section, article)}
                      style={{ color: isActive ? sectionColor : '#a0a8c0' }}
                    >
                      {article.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#e8eaf2', fontFamily: 'Inter, sans-serif' }}>
      <DocsStyles />

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#fff', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="font-headline font-extrabold text-base">Caller</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/help" className="px-3 py-1.5 rounded-lg text-sm transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>
              Help Center
            </Link>
            <Link href="/docs" className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: '#818cf8', background: 'rgba(99,102,241,0.08)' }}>
              Documentation
            </Link>
            <Link href="/docs?section=api-reference" className="px-3 py-1.5 rounded-lg text-sm transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>
              API Reference
            </Link>
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-2">
            <Link
              href="/login?mode=register"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold cta-glow"
              style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}
            >
              Get Started
            </Link>
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: '#a0a8c0' }}
              onClick={() => setMobileHamburger(!mobileHamburger)}
            >
              <span className="material-symbols-outlined text-xl">{mobileHamburger ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileHamburger && (
          <div className="md:hidden px-4 pb-4 pt-2 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <Link href="/help" className="block px-3 py-2 rounded-lg text-sm" style={{ color: '#a0a8c0' }} onClick={() => setMobileHamburger(false)}>Help Center</Link>
            <Link href="/docs" className="block px-3 py-2 rounded-lg text-sm font-medium" style={{ color: '#818cf8' }} onClick={() => setMobileHamburger(false)}>Documentation</Link>
            <Link href="/docs?section=api-reference" className="block px-3 py-2 rounded-lg text-sm" style={{ color: '#a0a8c0' }} onClick={() => setMobileHamburger(false)}>API Reference</Link>
            <Link href="/login?mode=register" className="block mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-center" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }} onClick={() => setMobileHamburger(false)}>Get Started</Link>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="py-10 sm:py-14 px-4 sm:px-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto">
          <AnimatedSection>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
                  <span className="material-symbols-outlined text-sm">menu_book</span>
                  Platform Documentation
                </div>
                <h1 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tight mb-2">
                  <span className="gradient-text">Documentation</span>
                </h1>
                <p className="text-sm max-w-lg" style={{ color: '#a0a8c0' }}>
                  Everything you need to build with Caller — guides, API reference, and architecture deep dives.
                </p>
              </div>

              {/* Hero search (desktop) */}
              <div className="relative w-full sm:w-72 flex-shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#606880' }}>search</span>
                <input
                  type="text"
                  placeholder="Search documentation…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none text-sm"
                  style={{
                    background: 'rgba(26,32,44,0.8)',
                    border: '1px solid rgba(140,144,159,0.15)',
                    color: '#e8eaf2',
                  }}
                />
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── DESKTOP LAYOUT (md+) ─────────────────────────────────────── */}
        <div className="hidden md:grid md:grid-cols-12 gap-8">

          {/* Sidebar */}
          <aside className="col-span-3">
            <div className="sticky top-20">
              <SidebarContent />
            </div>
          </aside>

          {/* Content */}
          <main className="col-span-9">
            {activeArticle ? (
              <div>
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: '#606880' }}>
                  <span>{activeArticle.section.title}</span>
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                  <span style={{ color: '#a0a8c0' }}>{activeArticle.article.title}</span>
                </div>

                {/* Article */}
                <div className="glass-panel rounded-2xl p-6 sm:p-8" style={{ border: `1px solid ${accent}18` }}>
                  <HelpArticle content={activeArticle.article.content} accentColor={accent} />
                </div>

                {/* Article navigation */}
                <div className="mt-6 flex items-center justify-between gap-4">
                  {(() => {
                    const allArticles = DOC_SECTIONS.flatMap(s => s.articles.map(a => ({ section: s, article: a })));
                    const currentIdx = allArticles.findIndex(
                      a => a.article.id === activeArticle.article.id && a.section.id === activeArticle.section.id
                    );
                    const prev = currentIdx > 0 ? allArticles[currentIdx - 1] : null;
                    const next = currentIdx < allArticles.length - 1 ? allArticles[currentIdx + 1] : null;
                    return (
                      <>
                        {prev ? (
                          <button
                            onClick={() => selectArticle(prev.section, prev.article)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all hover:text-white"
                            style={{ color: '#a0a8c0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            <span className="material-symbols-outlined text-base">arrow_back</span>
                            <span>{prev.article.title}</span>
                          </button>
                        ) : <div />}
                        {next ? (
                          <button
                            onClick={() => selectArticle(next.section, next.article)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all hover:text-white ml-auto"
                            style={{ color: '#a0a8c0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            <span>{next.article.title}</span>
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                          </button>
                        ) : <div />}
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* Section overview cards when no article selected */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DOC_SECTIONS.map((section, i) => {
                  const color = SECTION_COLORS[section.id] ?? '#6366f1';
                  return (
                    <AnimatedSection key={section.id} delay={i * 80}>
                      <button
                        className="w-full text-left p-5 rounded-2xl transition-all hover:-translate-y-1"
                        style={{ background: 'rgba(26,32,44,0.6)', border: '1px solid rgba(140,144,159,0.08)' }}
                        onClick={() => {
                          setExpandedSections(prev => new Set([...prev, section.id]));
                          selectArticle(section, section.articles[0]);
                        }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                          <span className="material-symbols-outlined text-lg" style={{ color, fontVariationSettings: "'FILL' 1" }}>{section.icon}</span>
                        </div>
                        <div className="font-headline font-bold text-sm mb-1">{section.title}</div>
                        <div className="text-xs" style={{ color: '#a0a8c0' }}>{section.articles.length} articles</div>
                      </button>
                    </AnimatedSection>
                  );
                })}
              </div>
            )}
          </main>
        </div>

        {/* ── MOBILE LAYOUT ─────────────────────────────────────────────── */}
        <div className="md:hidden">
          {/* Sections grid */}
          {mobileView === 'sections' && (
            <div>
              {searchQuery ? (
                /* Search results */
                <div>
                  {filteredSections.map(section => (
                    <div key={section.id} className="mb-4">
                      <div className="text-xs font-semibold mb-2 px-1" style={{ color: SECTION_COLORS[section.id] ?? '#6366f1' }}>
                        {section.title}
                      </div>
                      {section.articles.map(article => (
                        <button
                          key={article.id}
                          className="w-full text-left px-3 py-2.5 rounded-xl mb-1 text-sm"
                          style={{ background: 'rgba(26,32,44,0.6)', border: '1px solid rgba(140,144,159,0.08)', color: '#e8eaf2' }}
                          onClick={() => selectArticle(section, article)}
                        >
                          {article.title}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                /* Section cards */
                <div className="grid grid-cols-2 gap-3">
                  {DOC_SECTIONS.map(section => {
                    const color = SECTION_COLORS[section.id] ?? '#6366f1';
                    return (
                      <button
                        key={section.id}
                        className="text-left p-4 rounded-2xl"
                        style={{ background: 'rgba(26,32,44,0.6)', border: '1px solid rgba(140,144,159,0.08)' }}
                        onClick={() => {
                          setMobileSectionId(section.id);
                          setMobileView('articles');
                        }}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                          <span className="material-symbols-outlined text-base" style={{ color, fontVariationSettings: "'FILL' 1" }}>{section.icon}</span>
                        </div>
                        <div className="font-headline font-bold text-xs mb-0.5">{section.title}</div>
                        <div className="text-[10px]" style={{ color: '#a0a8c0' }}>{section.articles.length} articles</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Article list */}
          {mobileView === 'articles' && mobileSectionId && (() => {
            const section = DOC_SECTIONS.find(s => s.id === mobileSectionId);
            if (!section) return null;
            const color = SECTION_COLORS[mobileSectionId] ?? '#6366f1';
            return (
              <div>
                <button
                  className="flex items-center gap-2 mb-4 text-sm"
                  style={{ color: '#a0a8c0' }}
                  onClick={() => setMobileView('sections')}
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  All sections
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-base" style={{ color, fontVariationSettings: "'FILL' 1" }}>{section.icon}</span>
                  <span className="font-headline font-bold text-base">{section.title}</span>
                </div>
                <div className="space-y-2">
                  {section.articles.map(article => (
                    <button
                      key={article.id}
                      className="w-full text-left px-4 py-3 rounded-xl flex items-center justify-between gap-3"
                      style={{ background: 'rgba(26,32,44,0.6)', border: '1px solid rgba(140,144,159,0.08)', color: '#e8eaf2' }}
                      onClick={() => selectArticle(section, article)}
                    >
                      <span className="text-sm">{article.title}</span>
                      <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color: '#606880' }}>chevron_right</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Article content */}
          {mobileView === 'content' && activeArticle && (
            <div>
              {/* Back button */}
              <button
                className="flex items-center gap-2 mb-4 text-sm"
                style={{ color: '#a0a8c0' }}
                onClick={() => {
                  setMobileSectionId(activeArticle.section.id);
                  setMobileView('articles');
                }}
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                {activeArticle.section.title}
              </button>

              {/* Article */}
              <div className="glass-panel rounded-2xl p-5" style={{ border: `1px solid ${accent}18` }}>
                <HelpArticle content={activeArticle.article.content} accentColor={accent} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t" style={{ background: '#080b14', borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between gap-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)' }}>
                  <span className="material-symbols-outlined text-base" style={{ color: '#fff', fontVariationSettings: "'FILL' 1" }}>call</span>
                </div>
                <span className="font-headline font-extrabold text-lg">Caller</span>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(194,198,214,0.4)' }}>
                AI phone agents and live translation for the globally connected business.
              </p>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
                <span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>All systems operational</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-12">
              {[
                { title: 'Product', links: [
                  { label: 'AI Agents', href: '/#products' },
                  { label: 'Live Translator', href: '/#products' },
                  { label: 'Pricing', href: '/pricing' },
                ] },
                { title: 'Resources', links: [
                  { label: 'Documentation', href: '/docs' },
                  { label: 'API Reference', href: '/docs?section=api-reference' },
                  { label: 'Help Center', href: '/help' },
                ] },
                { title: 'Legal', links: [
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                  { label: 'Acceptable Use', href: '/acceptable-use' },
                ] },
              ].map(col => (
                <div key={col.title}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'rgba(194,198,214,0.3)' }}>{col.title}</div>
                  <div className="space-y-2.5">
                    {col.links.map(link => (
                      <Link key={link.label} href={link.href} className="block text-xs transition-colors hover:text-white" style={{ color: 'rgba(194,198,214,0.5)' }}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-[11px]" style={{ color: 'rgba(194,198,214,0.25)' }}>
              &copy; {new Date().getFullYear()} Caller. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Exported client component wrapped in Suspense ───────────────────── */
export default function DocsPageClient() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-outlined text-4xl" style={{ color: '#606880' }}>hourglass_empty</span>
      </div>
    }>
      <DocsPageInner />
    </Suspense>
  );
}
