import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articles, getArticle } from '../_lib/articles';
import BlogArticleClient from './BlogArticleClient';

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

/* ── Page ──────────────────────────────────────────────────────────────── */
export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogArticleClient article={article} slug={slug} />
    </>
  );
}
