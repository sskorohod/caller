import type { Metadata } from 'next';
import Link from 'next/link';
import { articles } from './_lib/articles';

export const metadata: Metadata = {
  title: 'Blog — Live Translation Tips & Guides',
  description: 'Guides for immigrants, travelers, and businesses on phone translation, interpreter services, and breaking language barriers.',
  openGraph: {
    title: 'Blog — Caller',
    description: 'Guides on phone translation, interpreter services, and breaking language barriers.',
    type: 'website',
  },
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a', color: '#e2e4ed' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .blog-card { background: rgba(26,32,44,0.55); backdrop-filter: blur(24px); border: 0.5px solid rgba(140,144,159,0.12); transition: all 0.3s ease; }
        .blog-card:hover { transform: translateY(-3px); box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 0 32px rgba(34,211,238,0.06); border-color: rgba(34,211,238,0.2); }
        .gradient-text { background: linear-gradient(135deg, #22d3ee, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .nav-link { color: rgba(194,198,214,0.7); transition: color 0.2s ease; font-size: 0.875rem; font-weight: 500; }
        .nav-link:hover { color: #22d3ee; }
      `}</style>

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

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12">
        <h1 className="font-headline text-4xl sm:text-5xl font-bold text-white mb-4">
          <span className="gradient-text">Blog</span>
        </h1>
        <p className="text-lg" style={{ color: 'rgba(194,198,214,0.7)' }}>
          Guides on phone translation, interpreter services, and breaking language barriers.
        </p>
      </div>

      {/* Articles grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid gap-6">
          {articles.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`}>
              <article className="blog-card rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
                    {article.locale === 'ru' ? 'RU' : 'EN'}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(194,198,214,0.5)' }}>
                    {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(194,198,214,0.4)' }}>
                    · {article.readTime} read
                  </span>
                </div>
                <h2 className="font-headline text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">
                  {article.title}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(194,198,214,0.6)' }}>
                  {article.description}
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
        <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.06), rgba(129,140,248,0.06))', border: '1px solid rgba(34,211,238,0.12)' }}>
          <h3 className="font-headline text-xl font-bold text-white mb-2">Ready to try Live Translator?</h3>
          <p className="text-sm mb-5" style={{ color: 'rgba(194,198,214,0.6)' }}>
            Merge our AI translator into any phone call. $0.15/min. No app needed.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/translator"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #818cf8)', boxShadow: '0 4px 24px rgba(34,211,238,0.2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>translate</span>
              Learn More
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: 'rgba(194,198,214,0.7)', border: '1px solid rgba(140,144,159,0.15)' }}
            >
              See Pricing
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(140,144,159,0.08)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-xs" style={{ color: 'rgba(194,198,214,0.3)' }}>
            © {new Date().getFullYear()} Caller. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
