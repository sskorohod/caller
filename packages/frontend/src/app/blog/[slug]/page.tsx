import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { articles, getArticle } from '../_lib/articles';

/* ── Article content imports ──────────────────────────────────────────── */
import LanguageLineAlternative from '../_articles/languageline-alternative';
import UscisInterpreterPolicy from '../_articles/uscis-interpreter-policy';
import CallInsuranceNoEnglish from '../_articles/call-insurance-no-english';
import RealTimePhoneTranslation from '../_articles/real-time-phone-translation';
import KakPozvonitvBank from '../_articles/kak-pozvonit-v-bank';

const articleComponents: Record<string, React.ComponentType> = {
  'languageline-alternative': LanguageLineAlternative,
  'uscis-interpreter-policy': UscisInterpreterPolicy,
  'call-insurance-no-english': CallInsuranceNoEnglish,
  'real-time-phone-translation': RealTimePhoneTranslation,
  'kak-pozvonit-v-bank': KakPozvonitvBank,
};

/* ── Static params ────────────────────────────────────────────────────── */
export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

/* ── Dynamic metadata ─────────────────────────────────────────────────── */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  const url = `https://caller.n8nskorx.top/blog/${slug}`;

  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    authors: [{ name: 'Caller' }],
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedAt,
      url,
      siteName: 'Caller',
      locale: article.locale === 'ru' ? 'ru_RU' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
    },
    alternates: {
      canonical: url,
    },
  };
}

/* ── CTA Component ────────────────────────────────────────────────────── */
function ArticleCTA({ locale }: { locale: 'en' | 'ru' }) {
  const isRu = locale === 'ru';
  return (
    <div className="my-12 rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(129,140,248,0.08))', border: '1px solid rgba(34,211,238,0.15)' }}>
      <h3 className="font-headline text-2xl font-bold text-white mb-3">
        {isRu ? 'Попробуйте Live Translator' : 'Try Live Translator'}
      </h3>
      <p className="mb-6" style={{ color: 'rgba(194,198,214,0.7)' }}>
        {isRu
          ? 'Добавьте наш номер в любой звонок — AI переведёт обе стороны. $0.15/мин. Первые $2 бесплатно.'
          : 'Merge our number into any phone call — AI translates both sides. $0.15/min. First $2 free.'}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)', boxShadow: '0 4px 24px rgba(34,211,238,0.25)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>translate</span>
          {isRu ? 'Начать бесплатно' : 'Get Started Free'}
        </Link>
        <Link
          href="/translator"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-medium transition-colors"
          style={{ color: 'rgba(194,198,214,0.7)', border: '1px solid rgba(140,144,159,0.15)' }}
        >
          {isRu ? 'Как это работает' : 'How It Works'}
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
        </Link>
      </div>
      <p className="mt-4 text-xs" style={{ color: 'rgba(194,198,214,0.4)' }}>
        {isRu ? (
          <>Смотрите <Link href="/pricing" className="underline" style={{ color: '#22d3ee' }}>тарифы</Link> — оплата только за использование, никаких подписок.</>
        ) : (
          <>See <Link href="/pricing" className="underline" style={{ color: '#22d3ee' }}>pricing</Link> — pay per minute, no subscriptions.</>
        )}
      </p>
    </div>
  );
}

/* ── Related Articles Component ───────────────────────────────────────── */
function RelatedArticles({ currentSlug, locale }: { currentSlug: string; locale: 'en' | 'ru' }) {
  const isRu = locale === 'ru';
  const related = articles.filter((a) => a.slug !== currentSlug).slice(0, 3);
  if (related.length === 0) return null;

  return (
    <div className="mt-16 pt-12" style={{ borderTop: '1px solid rgba(140,144,159,0.1)' }}>
      <h3 className="font-headline text-xl font-bold text-white mb-6">
        {isRu ? 'Читайте также' : 'Related Articles'}
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {related.map((a) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className="block rounded-xl p-5 transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(26,32,44,0.4)', border: '1px solid rgba(140,144,159,0.08)' }}
          >
            <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-2" style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
              {a.locale === 'ru' ? 'RU' : 'EN'}
            </span>
            <h4 className="text-sm font-semibold text-white mb-1 line-clamp-2">{a.title}</h4>
            <p className="text-xs line-clamp-2" style={{ color: 'rgba(194,198,214,0.5)' }}>{a.description}</p>
          </Link>
        ))}
      </div>
      <div className="text-center mt-6">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: '#22d3ee' }}>
          {isRu ? 'Все статьи' : 'All articles'} <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const Content = articleComponents[slug];
  if (!Content) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    author: { '@type': 'Organization', name: 'Caller', url: 'https://caller.n8nskorx.top' },
    publisher: { '@type': 'Organization', name: 'Caller', url: 'https://caller.n8nskorx.top' },
    mainEntityOfPage: `https://caller.n8nskorx.top/blog/${slug}`,
    inLanguage: article.locale === 'ru' ? 'ru' : 'en',
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a', color: '#e2e4ed' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .nav-link { color: rgba(194,198,214,0.7); transition: color 0.2s ease; font-size: 0.875rem; font-weight: 500; }
        .nav-link:hover { color: #22d3ee; }

        .article-content h2 { font-family: 'Manrope', sans-serif; font-size: 1.5rem; font-weight: 700; color: #fff; margin-top: 2.5rem; margin-bottom: 1rem; }
        .article-content h3 { font-family: 'Manrope', sans-serif; font-size: 1.25rem; font-weight: 700; color: #fff; margin-top: 2rem; margin-bottom: 0.75rem; }
        .article-content p { line-height: 1.8; margin-bottom: 1.25rem; color: rgba(194,198,214,0.8); }
        .article-content ul, .article-content ol { margin-bottom: 1.25rem; padding-left: 1.5rem; color: rgba(194,198,214,0.8); }
        .article-content li { margin-bottom: 0.5rem; line-height: 1.7; }
        .article-content strong { color: #fff; font-weight: 600; }
        .article-content a { color: #22d3ee; text-decoration: underline; text-underline-offset: 2px; }
        .article-content a:hover { color: #67e8f9; }
        .article-content blockquote { border-left: 3px solid #818cf8; padding-left: 1rem; margin: 1.5rem 0; color: rgba(194,198,214,0.6); font-style: italic; }

        .article-content table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.875rem; }
        .article-content th { text-align: left; padding: 0.75rem; font-weight: 600; color: #fff; border-bottom: 1px solid rgba(140,144,159,0.2); background: rgba(26,32,44,0.4); }
        .article-content td { padding: 0.75rem; border-bottom: 1px solid rgba(140,144,159,0.08); color: rgba(194,198,214,0.8); }
        .article-content tr:hover td { background: rgba(26,32,44,0.3); }
      `}</style>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Navbar */}
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
              <Link href="/translator" className="nav-link">Live Translator</Link>
              <Link href="/pricing" className="nav-link">Pricing</Link>
              <Link href="/blog" className="nav-link" style={{ color: '#22d3ee' }}>Blog</Link>
            </div>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)', boxShadow: '0 2px 16px rgba(34,211,238,0.2)' }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Article header */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm mb-8 hover:underline" style={{ color: 'rgba(194,198,214,0.5)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Back to Blog
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
            {article.locale === 'ru' ? 'RU' : 'EN'}
          </span>
          <span className="text-sm" style={{ color: 'rgba(194,198,214,0.5)' }}>
            {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="text-sm" style={{ color: 'rgba(194,198,214,0.4)' }}>
            · {article.readTime} read
          </span>
        </div>
        <h1 className="font-headline text-3xl sm:text-4xl font-bold text-white leading-tight">
          {article.title}
        </h1>
      </div>

      {/* Article content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="article-content">
          <Content />
        </div>
        <ArticleCTA locale={article.locale} />
        <RelatedArticles currentSlug={slug} locale={article.locale} />
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(140,144,159,0.08)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-xs" style={{ color: 'rgba(194,198,214,0.3)' }}>
            © {new Date().getFullYear()} Caller. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
