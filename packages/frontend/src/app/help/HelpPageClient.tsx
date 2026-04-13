'use client';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { HELP_CATEGORIES } from '@/app/dashboard/help/_lib/help-data';
import { HelpArticle } from '@/app/dashboard/help/_components/HelpArticle';
import AnimatedSection from '@/app/_landing/AnimatedSection';
import ContactPopup from '@/app/_landing/ContactPopup';
import { useLang, LangSwitcher, LangProvider } from '@/app/_landing/useLang';

/* ── Styles ─────────────────────────────────────────────────────────── */
function HelpStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
      .font-headline { font-family: 'Manrope', sans-serif; }
      .glass-panel { background: rgba(26, 32, 44, 0.55); backdrop-filter: blur(24px); border: 0.5px solid rgba(140, 144, 159, 0.12); }
      .gradient-text { background: linear-gradient(135deg, #adc6ff 0%, #818cf8 50%, #d0bcff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200% 200%; animation: gradient-shift 6s ease infinite; }
      @keyframes gradient-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      .cta-glow { box-shadow: 0 4px 32px rgba(77,142,255,0.3), 0 0 80px rgba(77,142,255,0.1); transition: all 0.3s ease; }
      .cta-glow:hover { box-shadow: 0 6px 40px rgba(77,142,255,0.45), 0 0 100px rgba(77,142,255,0.15); transform: translateY(-2px); }
      .help-article h1, .help-article h2, .help-article h3 { color: #dde2f3; }
      --th-text: #dde2f3;
      --th-text-muted: #a0a8c0;
      --th-surface: rgba(255,255,255,0.03);
      --th-card-hover: rgba(255,255,255,0.06);
      --th-card-border-subtle: rgba(255,255,255,0.06);
      .help-article-wrapper { --th-text: #dde2f3; --th-text-muted: #a0a8c0; --th-surface: rgba(255,255,255,0.03); --th-card-hover: rgba(255,255,255,0.06); --th-card-border-subtle: rgba(255,255,255,0.06); }
      .sidebar-item { transition: all 0.2s ease; cursor: pointer; }
      .sidebar-item:hover { background: rgba(255,255,255,0.04); }
      .search-input:focus { outline: none; border-color: rgba(129,140,248,0.4); }
      .cat-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; }
      .cat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
      .article-row { transition: all 0.2s ease; cursor: pointer; }
      .article-row:hover { background: rgba(255,255,255,0.04); }
      @media (prefers-reduced-motion: reduce) { .gradient-text { animation: none; } }
    `}</style>
  );
}

/* ── Constants ──────────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, { accent: string; gradient: string }> = {
  'getting-started': { accent: '#6366f1', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.02))' },
  'billing':         { accent: '#10b981', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.02))' },
  'providers':       { accent: '#f59e0b', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.02))' },
  'agents':          { accent: '#8b5cf6', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.02))' },
  'calls':           { accent: '#3b82f6', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.02))' },
  'translator':      { accent: '#06b6d4', gradient: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.02))' },
  'missions':        { accent: '#ec4899', gradient: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(236,72,153,0.02))' },
  'integrations':    { accent: '#f97316', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.02))' },
  'settings':        { accent: '#64748b', gradient: 'linear-gradient(135deg, rgba(100,116,139,0.12), rgba(100,116,139,0.02))' },
};

const CAT_TITLES: Record<string, { en: string; ru: string }> = {
  'getting-started': { en: 'Getting Started', ru: 'Начало работы' },
  'billing':         { en: 'Billing & Plans', ru: 'Биллинг и тарифы' },
  'providers':       { en: 'Provider Setup', ru: 'Настройка провайдеров' },
  'agents':          { en: 'AI Agents', ru: 'AI Агенты' },
  'calls':           { en: 'Calls', ru: 'Звонки' },
  'translator':      { en: 'Live Translator', ru: 'Живой переводчик' },
  'missions':        { en: 'Missions', ru: 'Миссии' },
  'integrations':    { en: 'Integrations & API', ru: 'Интеграции и API' },
  'settings':        { en: 'Settings', ru: 'Настройки' },
};

const ART_TITLES: Record<string, { en: string; ru: string }> = {
  'help.art.whatIsCaller':           { en: 'What is Caller', ru: 'Что такое Caller' },
  'help.art.registration':           { en: 'Registration & First Steps', ru: 'Регистрация и первые шаги' },
  'help.art.choosingPlan':           { en: 'Choosing a Plan', ru: 'Выбор тарифа' },
  'help.art.trialPeriod':            { en: 'Trial Period', ru: 'Пробный период' },
  'help.art.howDepositWorks':        { en: 'How the Deposit Works', ru: 'Как работает депозит' },
  'help.art.ownKeysVsPlatform':      { en: 'Own Keys vs Platform Providers', ru: 'Свои ключи или провайдеры платформы' },
  'help.art.managingSubscription':   { en: 'Managing Your Subscription', ru: 'Управление подпиской' },
  'help.art.setupTwilio':            { en: 'Setting Up Twilio', ru: 'Настройка Twilio' },
  'help.art.setupAnthropic':         { en: 'Setting Up Anthropic (Claude)', ru: 'Настройка Anthropic (Claude)' },
  'help.art.setupOpenai':            { en: 'Setting Up OpenAI', ru: 'Настройка OpenAI' },
  'help.art.setupDeepgram':          { en: 'Setting Up Deepgram', ru: 'Настройка Deepgram' },
  'help.art.setupElevenlabs':        { en: 'Setting Up ElevenLabs', ru: 'Настройка ElevenLabs' },
  'help.art.setupXai':               { en: 'Setting Up xAI (Grok)', ru: 'Настройка xAI (Grok)' },
  'help.art.setupTelegram':          { en: 'Setting Up Telegram Notifications', ru: 'Настройка уведомлений Telegram' },
  'help.art.creatingAgent':          { en: 'Creating an AI Agent', ru: 'Создание AI-агента' },
  'help.art.agentVoice':             { en: 'Agent Voice Settings', ru: 'Настройки голоса агента' },
  'help.art.agentLlm':               { en: 'Agent LLM Settings', ru: 'Настройки LLM агента' },
  'help.art.promptPacks':            { en: 'Prompt Packs', ru: 'Наборы промптов' },
  'help.art.skillPacks':             { en: 'Skill Packs', ru: 'Наборы навыков' },
  'help.art.knowledgeBase':          { en: 'Knowledge Base', ru: 'База знаний' },
  'help.art.assignPhoneNumber':      { en: 'Assigning a Phone Number', ru: 'Назначение номера телефона' },
  'help.art.outboundCalls':          { en: 'Making Outbound Calls', ru: 'Исходящие звонки' },
  'help.art.inboundCalls':           { en: 'Handling Inbound Calls', ru: 'Обработка входящих звонков' },
  'help.art.dialer':                 { en: 'Using the Dialer', ru: 'Использование номеронабирателя' },
  'help.art.recordingTranscription': { en: 'Recording & Transcription', ru: 'Запись и транскрипция' },
  'help.art.howTranslatorWorks':     { en: 'How the Live Translator Works', ru: 'Как работает живой переводчик' },
  'help.art.translatorSettings':     { en: 'Translator Settings', ru: 'Настройки переводчика' },
  'help.art.whatIsMission':          { en: 'What is a Mission', ru: 'Что такое миссия' },
  'help.art.creatingMission':        { en: 'Creating a Mission', ru: 'Создание миссии' },
  'help.art.apiKeys':                { en: 'API Keys & Authentication', ru: 'API-ключи и аутентификация' },
  'help.art.webhooks':               { en: 'Webhooks', ru: 'Вебхуки' },
  'help.art.mcpServer':              { en: 'MCP Server Integration', ru: 'Интеграция MCP Server' },
  'help.art.oauth':                  { en: 'OAuth 2.0', ru: 'OAuth 2.0' },
  'help.art.connectors':             { en: 'Connectors', ru: 'Коннекторы' },
  'help.art.generalSettings':        { en: 'General Settings', ru: 'Основные настройки' },
  'help.art.appearanceSettings':     { en: 'Appearance Settings', ru: 'Настройки внешнего вида' },
  'help.art.complianceSettings':     { en: 'Compliance Settings', ru: 'Настройки соответствия' },
  'help.art.teamSettings':           { en: 'Team Settings', ru: 'Настройки команды' },
};

/* ── Main Component ─────────────────────────────────────────────────── */
export default function HelpPageClient() {
  return <LangProvider><HelpPageInner /></LangProvider>;
}

function HelpPageInner() {
  const { lang, t } = useLang();
  const catTitle = (id: string) => { const c = CAT_TITLES[id]; return c ? t(c.en, c.ru) : id; };
  const artTitle = (key: string) => { const a = ART_TITLES[key]; return a ? t(a.en, a.ru) : key; };
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedArticleKey, setSelectedArticleKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile navigation state: 'categories' | 'articles' | 'article'
  type MobileView = 'categories' | 'articles' | 'article';
  const [mobileView, setMobileView] = useState<MobileView>('categories');

  const selectedCat = HELP_CATEGORIES.find(c => c.id === selectedCatId) ?? null;
  const selectedArticle = selectedCat?.articles.find(a => a.titleKey === selectedArticleKey) ?? null;

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: Array<{ catId: string; catTitleStr: string; titleKey: string; title: string }> = [];
    for (const cat of HELP_CATEGORIES) {
      for (const art of cat.articles) {
        const a = ART_TITLES[art.titleKey];
        const title = a ? (lang === 'ru' ? a.ru : a.en) : art.titleKey;
        if (title.toLowerCase().includes(q)) {
          const c = CAT_TITLES[cat.id];
          results.push({ catId: cat.id, catTitleStr: c ? (lang === 'ru' ? c.ru : c.en) : cat.id, titleKey: art.titleKey, title });
        }
      }
    }
    return results;
  }, [searchQuery, lang]);

  function selectArticle(catId: string, titleKey: string) {
    setSelectedCatId(catId);
    setSelectedArticleKey(titleKey);
    setSearchQuery('');
  }

  const accentColor = selectedCatId ? (CAT_COLORS[selectedCatId]?.accent ?? '#6366f1') : '#6366f1';

  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <HelpStyles />

      {/* ═══ Navbar ═══════════════════════════════════════════════════ */}
      <header className="fixed top-0 w-full z-50" style={{ background: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(221,226,243,0.06)' }}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)' }}>
              <span className="material-symbols-outlined text-base" style={{ color: '#fff', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="text-lg font-headline font-extrabold tracking-tight">Caller</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <span className="font-semibold" style={{ color: '#818cf8' }}>{t('Help Center', 'Центр помощи')}</span>
            <Link href="/docs" className="transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>{t('Documentation', 'Документация')}</Link>
            <Link href="/docs?section=api" className="transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>{t('API Reference', 'Справочник API')}</Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LangSwitcher />
            <Link href="/login" className="text-sm font-medium transition-colors hover:text-white" style={{ color: '#a0a8c0' }}>{t('Log in', 'Войти')}</Link>
            <Link href="/login?mode=register"
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 cta-glow hidden sm:inline-flex"
              style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
              {t('Get Started', 'Начать')}
            </Link>
            <button className="md:hidden w-10 h-10 flex items-center justify-center" onClick={() => setMobileNav(!mobileNav)}>
              <span className="material-symbols-outlined">{mobileNav ? 'close' : 'menu'}</span>
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        {mobileNav && (
          <div className="md:hidden px-4 pb-4 space-y-1" style={{ background: 'rgba(10, 14, 26, 0.98)', backdropFilter: 'blur(24px)' }}>
            <span className="block py-3 text-sm font-semibold" style={{ color: '#818cf8' }}>{t('Help Center', 'Центр помощи')}</span>
            <Link href="/docs" onClick={() => setMobileNav(false)} className="block py-3 text-sm font-medium" style={{ color: '#a0a8c0' }}>{t('Documentation', 'Документация')}</Link>
            <Link href="/docs?section=api" onClick={() => setMobileNav(false)} className="block py-3 text-sm font-medium" style={{ color: '#a0a8c0' }}>{t('API Reference', 'Справочник API')}</Link>
            <div className="pt-3 mt-2 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <LangSwitcher className="w-fit" />
              <Link href="/login?mode=register" onClick={() => setMobileNav(false)}
                className="w-full py-3 rounded-xl text-sm font-bold text-center cta-glow"
                style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
                {t('Get Started Free', 'Начать бесплатно')}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main style={{ paddingTop: '56px' }}>
        {/* ═══ Hero ════════════════════════════════════════════════════ */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 text-center relative overflow-hidden">
          {/* Background glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute rounded-full" style={{ top: '-10%', left: '20%', width: '500px', height: '500px', background: 'rgba(99,102,241,0.06)', filter: 'blur(80px)' }} />
            <div className="absolute rounded-full" style={{ top: '0', right: '15%', width: '400px', height: '400px', background: 'rgba(139,92,246,0.05)', filter: 'blur(80px)' }} />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <AnimatedSection animation="fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: '#818cf8' }}>
                <span className="material-symbols-outlined text-sm">help</span>
                {t('Help Center', 'Центр помощи')}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold tracking-tight mb-4">
                <span className="gradient-text">{t('Help Center', 'Центр помощи')}</span>
              </h1>
              <p className="text-base sm:text-lg mb-8" style={{ color: '#a0a8c0' }}>
                {t('Find answers to everything about Caller', 'Найдите ответы на все вопросы о Caller')}
              </p>

              {/* Search */}
              <div className="relative max-w-lg mx-auto">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <span className="material-symbols-outlined text-lg" style={{ color: '#64748b' }}>search</span>
                </div>
                <input
                  type="text"
                  placeholder={t('Search articles...', 'Поиск статей...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input w-full pl-12 pr-4 py-3.5 rounded-xl text-sm"
                  style={{
                    background: 'rgba(26, 32, 44, 0.55)',
                    backdropFilter: 'blur(24px)',
                    border: '0.5px solid rgba(140, 144, 159, 0.18)',
                    color: '#dde2f3',
                    transition: 'border-color 0.2s ease',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: '#64748b' }}>
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>

              {/* Search results dropdown */}
              {searchQuery && searchResults.length > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-full max-w-lg rounded-xl z-20 overflow-hidden text-left"
                  style={{ background: 'rgba(16, 20, 34, 0.98)', border: '0.5px solid rgba(140, 144, 159, 0.18)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                  {searchResults.slice(0, 8).map(r => (
                    <button key={r.titleKey} onClick={() => { selectArticle(r.catId, r.titleKey); setMobileView('article'); }}
                      className="article-row w-full flex items-center gap-3 px-4 py-3 text-left">
                      <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: CAT_COLORS[r.catId]?.accent ?? '#6366f1' }}>article</span>
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#dde2f3' }}>{r.title}</div>
                        <div className="text-xs" style={{ color: '#64748b' }}>{r.catTitleStr}</div>
                      </div>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="px-4 py-3 text-sm" style={{ color: '#64748b' }}>{t('No articles found', 'Статьи не найдены')}</div>
                  )}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-full max-w-lg rounded-xl z-20 overflow-hidden text-left"
                  style={{ background: 'rgba(16, 20, 34, 0.98)', border: '0.5px solid rgba(140, 144, 159, 0.18)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                  <div className="px-4 py-3 text-sm" style={{ color: '#64748b' }}>{t(`No articles found for "${searchQuery}"`, `Статьи не найдены для "${searchQuery}"`)}</div>
                </div>
              )}
            </AnimatedSection>
          </div>
        </section>

        {/* ═══ Main Content ════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">

          {/* ── DESKTOP LAYOUT ── */}
          <div className="hidden md:grid grid-cols-12 gap-6">
            {/* Sidebar */}
            <aside className="col-span-3">
              <div className="sticky top-20 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(26, 32, 44, 0.55)', backdropFilter: 'blur(24px)', border: '0.5px solid rgba(140, 144, 159, 0.12)' }}>
                <div className="px-4 pt-4 pb-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'rgba(194,198,214,0.4)' }}>Categories</div>
                </div>
                <nav className="p-2 space-y-0.5">
                  {HELP_CATEGORIES.map(cat => {
                    const colors = CAT_COLORS[cat.id] ?? { accent: '#6366f1', gradient: '' };
                    const isActive = selectedCatId === cat.id;
                    return (
                      <div key={cat.id}>
                        <button
                          onClick={() => {
                            if (selectedCatId === cat.id) {
                              setSelectedCatId(null);
                              setSelectedArticleKey(null);
                            } else {
                              setSelectedCatId(cat.id);
                              setSelectedArticleKey(null);
                            }
                          }}
                          className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                          style={{
                            background: isActive ? `${colors.accent}12` : 'transparent',
                            color: isActive ? colors.accent : '#a0a8c0',
                          }}>
                          <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1", color: isActive ? colors.accent : '#64748b' }}>
                            {cat.icon}
                          </span>
                          <span className="text-sm font-medium flex-1">{catTitle(cat.id)}</span>
                          <span className="material-symbols-outlined text-sm" style={{ color: '#64748b' }}>
                            {isActive ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>

                        {/* Expanded article list in sidebar */}
                        {isActive && (
                          <div className="pl-4 pb-1 space-y-0.5">
                            {cat.articles.map(art => {
                              const artTitleStr = artTitle(art.titleKey);
                              const isSelected = selectedArticleKey === art.titleKey;
                              return (
                                <button
                                  key={art.titleKey}
                                  onClick={() => setSelectedArticleKey(art.titleKey)}
                                  className="article-row w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left"
                                  style={{
                                    background: isSelected ? `${colors.accent}10` : 'transparent',
                                    color: isSelected ? colors.accent : '#a0a8c0',
                                  }}>
                                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: isSelected ? colors.accent : '#64748b' }} />
                                  <span className="text-xs font-medium leading-snug">{artTitleStr}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* Main content area */}
            <div className="col-span-9">
              {selectedArticle && selectedCat ? (
                <AnimatedSection animation="fade-in" key={selectedArticle.titleKey}>
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-xs mb-6" style={{ color: '#64748b' }}>
                    <button onClick={() => { setSelectedCatId(null); setSelectedArticleKey(null); }} className="hover:text-white transition-colors">{t('Help Center', 'Центр помощи')}</button>
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                    <button onClick={() => setSelectedArticleKey(null)} className="hover:text-white transition-colors">
                      {catTitle(selectedCat.id)}
                    </button>
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                    <span style={{ color: '#a0a8c0' }}>{artTitle(selectedArticle.titleKey)}</span>
                  </div>

                  <div className="rounded-2xl p-6 sm:p-8 help-article-wrapper"
                    style={{ background: 'rgba(26, 32, 44, 0.55)', backdropFilter: 'blur(24px)', border: '0.5px solid rgba(140, 144, 159, 0.12)' }}>
                    <HelpArticle content={selectedArticle.content[lang] || selectedArticle.content.en} accentColor={accentColor} />
                  </div>
                </AnimatedSection>
              ) : selectedCat ? (
                <AnimatedSection animation="fade-in" key={selectedCat.id + '-list'}>
                  <h2 className="text-xl font-headline font-bold mb-5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl" style={{ color: CAT_COLORS[selectedCat.id]?.accent ?? '#6366f1', fontVariationSettings: "'FILL' 1" }}>{selectedCat.icon}</span>
                    {catTitle(selectedCat.id)}
                  </h2>
                  <div className="space-y-2">
                    {selectedCat.articles.map(art => {
                      const artTitleStr = artTitle(art.titleKey);
                      const colors = CAT_COLORS[selectedCat.id] ?? { accent: '#6366f1', gradient: '' };
                      return (
                        <button key={art.titleKey} onClick={() => setSelectedArticleKey(art.titleKey)}
                          className="article-row w-full flex items-center gap-4 px-5 py-4 rounded-xl text-left"
                          style={{ background: 'rgba(26, 32, 44, 0.55)', backdropFilter: 'blur(24px)', border: '0.5px solid rgba(140, 144, 159, 0.12)' }}>
                          <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: colors.accent }}>article</span>
                          <span className="text-sm font-medium flex-1" style={{ color: '#dde2f3' }}>{artTitleStr}</span>
                          <span className="material-symbols-outlined text-sm" style={{ color: '#64748b' }}>chevron_right</span>
                        </button>
                      );
                    })}
                  </div>
                </AnimatedSection>
              ) : (
                /* Welcome grid */
                <AnimatedSection animation="fade-up">
                  <h2 className="text-xl font-headline font-bold mb-6">{t('Browse by Category', 'Категории')}</h2>
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                    {HELP_CATEGORIES.map((cat, i) => {
                      const colors = CAT_COLORS[cat.id] ?? { accent: '#6366f1', gradient: 'none' };
                      return (
                        <AnimatedSection key={cat.id} animation="fade-up" delay={i * 50}>
                          <button
                            onClick={() => setSelectedCatId(cat.id)}
                            className="cat-card w-full text-left p-5 rounded-2xl"
                            style={{ background: colors.gradient, border: `0.5px solid ${colors.accent}20` }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                              style={{ background: `${colors.accent}15` }}>
                              <span className="material-symbols-outlined text-xl" style={{ color: colors.accent, fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
                            </div>
                            <div className="font-headline font-bold text-sm mb-1" style={{ color: '#dde2f3' }}>{catTitle(cat.id)}</div>
                            <div className="text-xs" style={{ color: '#64748b' }}>{cat.articles.length} {t('articles', 'статей')}</div>
                          </button>
                        </AnimatedSection>
                      );
                    })}
                  </div>
                </AnimatedSection>
              )}
            </div>
          </div>

          {/* ── MOBILE LAYOUT ── */}
          <div className="md:hidden">
            {/* Mobile: Category list */}
            {mobileView === 'categories' && (
              <div className="grid grid-cols-2 gap-3">
                {HELP_CATEGORIES.map((cat, i) => {
                  const colors = CAT_COLORS[cat.id] ?? { accent: '#6366f1', gradient: 'none' };
                  return (
                    <AnimatedSection key={cat.id} animation="fade-up" delay={i * 40}>
                      <button
                        onClick={() => { setSelectedCatId(cat.id); setMobileView('articles'); }}
                        className="cat-card w-full text-left p-4 rounded-2xl"
                        style={{ background: colors.gradient, border: `0.5px solid ${colors.accent}20` }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                          style={{ background: `${colors.accent}15` }}>
                          <span className="material-symbols-outlined text-lg" style={{ color: colors.accent, fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
                        </div>
                        <div className="font-headline font-bold text-xs mb-0.5" style={{ color: '#dde2f3' }}>{catTitle(cat.id)}</div>
                        <div className="text-[11px]" style={{ color: '#64748b' }}>{cat.articles.length} {t('articles', 'статей')}</div>
                      </button>
                    </AnimatedSection>
                  );
                })}
              </div>
            )}

            {/* Mobile: Article list */}
            {mobileView === 'articles' && selectedCat && (
              <div>
                <button onClick={() => { setMobileView('categories'); setSelectedCatId(null); }}
                  className="flex items-center gap-2 mb-5 text-sm font-medium transition-colors hover:text-white"
                  style={{ color: '#a0a8c0' }}>
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  {t('Back to categories', 'Назад к категориям')}
                </button>
                <h2 className="font-headline font-bold text-lg mb-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl" style={{ color: CAT_COLORS[selectedCat.id]?.accent ?? '#6366f1', fontVariationSettings: "'FILL' 1" }}>{selectedCat.icon}</span>
                  {catTitle(selectedCat.id)}
                </h2>
                <div className="space-y-2">
                  {selectedCat.articles.map(art => {
                    const artTitleStr = artTitle(art.titleKey);
                    const colors = CAT_COLORS[selectedCat.id] ?? { accent: '#6366f1' };
                    return (
                      <button key={art.titleKey}
                        onClick={() => { setSelectedArticleKey(art.titleKey); setMobileView('article'); }}
                        className="article-row w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left"
                        style={{ background: 'rgba(26, 32, 44, 0.55)', backdropFilter: 'blur(24px)', border: '0.5px solid rgba(140, 144, 159, 0.12)' }}>
                        <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: colors.accent }}>article</span>
                        <span className="text-sm font-medium flex-1" style={{ color: '#dde2f3' }}>{artTitleStr}</span>
                        <span className="material-symbols-outlined text-sm" style={{ color: '#64748b' }}>chevron_right</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile: Article view */}
            {mobileView === 'article' && selectedArticle && selectedCat && (
              <div>
                <button onClick={() => { setMobileView('articles'); setSelectedArticleKey(null); }}
                  className="flex items-center gap-2 mb-4 text-sm font-medium transition-colors hover:text-white"
                  style={{ color: '#a0a8c0' }}>
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  {catTitle(selectedCat.id)}
                </button>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-xs mb-5 flex-wrap" style={{ color: '#64748b' }}>
                  <button onClick={() => setMobileView('categories')} className="hover:text-white transition-colors">{t('Help Center', 'Центр помощи')}</button>
                  <span className="material-symbols-outlined text-xs">chevron_right</span>
                  <button onClick={() => { setMobileView('articles'); setSelectedArticleKey(null); }} className="hover:text-white transition-colors">
                    {catTitle(selectedCat.id)}
                  </button>
                  <span className="material-symbols-outlined text-xs">chevron_right</span>
                  <span style={{ color: '#a0a8c0' }}>{artTitle(selectedArticle.titleKey)}</span>
                </div>

                <div className="rounded-2xl p-4 sm:p-6 help-article-wrapper"
                  style={{ background: 'rgba(26, 32, 44, 0.55)', backdropFilter: 'blur(24px)', border: '0.5px solid rgba(140, 144, 159, 0.12)' }}>
                  <HelpArticle content={selectedArticle.content[lang] || selectedArticle.content.en} accentColor={accentColor} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══ CTA ════════════════════════════════════════════════════ */}
        <section className="py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at center, rgba(129,140,248,0.08), transparent 70%)' }} />
            <AnimatedSection>
              <div className="relative glass-panel rounded-3xl p-8 sm:p-12 text-center overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(173,198,255,0.15), transparent)' }} />
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.2)' }}>
                  <span className="material-symbols-outlined text-2xl" style={{ color: '#818cf8' }}>support_agent</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-headline font-extrabold tracking-tight mb-3">
                  {t("Can't find what you need?", 'Не нашли ответ?')}
                </h2>
                <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#a0a8c0' }}>
                  {t('Sign in to your account and use the in-app Help Center for personalized support, or get started for free.', 'Войдите в аккаунт и используйте встроенный центр помощи для персональной поддержки, или начните бесплатно.')}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#dde2f3' }}>
                    <span className="material-symbols-outlined text-base">login</span>
                    {t('Log in', 'Войти')}
                  </Link>
                  <Link href="/login?mode=register"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all cta-glow"
                    style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)', color: '#fff' }}>
                    {t('Get Started Free', 'Начать бесплатно')}
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>

      {/* ═══ Footer ════════════════════════════════════════════════════ */}
      <footer className="border-t" style={{ background: '#080b14', borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
          <div className="flex flex-col md:flex-row justify-between gap-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818cf8, #4d8eff)' }}>
                  <span className="material-symbols-outlined text-base" style={{ color: '#fff', fontVariationSettings: "'FILL' 1" }}>call</span>
                </div>
                <span className="font-headline font-extrabold text-lg">Caller</span>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(194,198,214,0.4)' }}>
                {t('AI phone agents and live translation for the globally connected business. One platform, zero complexity.', 'AI-телефонные агенты и живой перевод для глобального бизнеса. Одна платформа, никакой сложности.')}
              </p>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
                <span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>{t('All systems operational', 'Все системы работают')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-12">
              {[
                { title: t('Product', 'Продукт'), links: [
                  { label: t('AI Agents', 'AI Агенты'), href: '/#products' },
                  { label: t('Live Translator', 'Живой переводчик'), href: '/translator' },
                  { label: t('Pricing', 'Цены'), href: '/pricing' },
                  { label: t('Features', 'Возможности'), href: '/#features' },
                ] },
                { title: t('Resources', 'Ресурсы'), links: [
                  { label: t('Documentation', 'Документация'), href: '/docs' },
                  { label: t('API Reference', 'Справочник API'), href: '/docs?section=api' },
                  { label: t('Help Center', 'Центр помощи'), href: '/help' },
                ] },
                { title: t('Legal', 'Правовая информация'), links: [
                  { label: t('Privacy Policy', 'Политика конфиденциальности'), href: '/privacy' },
                  { label: t('Terms of Service', 'Условия использования'), href: '/terms' },
                  { label: t('Acceptable Use', 'Допустимое использование'), href: '/acceptable-use' },
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
            <p className="text-[11px]" style={{ color: 'rgba(194,198,214,0.25)' }}>&copy; {new Date().getFullYear()} Caller. {t('All rights reserved.', 'Все права защищены.')}</p>
          </div>
        </div>
      </footer>

      <ContactPopup />
    </div>
  );
}
