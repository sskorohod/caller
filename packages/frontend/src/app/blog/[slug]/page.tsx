import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articles, getArticle } from '../_lib/articles';
import BlogArticleClient from './BlogArticleClient';
import JsonLd from '@/components/JsonLd';
import { breadcrumbSchema, SITE_URL } from '../../_seo/schema';

/* ── Static params ────────────────────────────────────────────────────── */
export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

/* ── Dynamic metadata ─────────────────────────────────────────────────── */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  const url = `https://lingoline.net/blog/${slug}`;

  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    authors: [{ name: 'LingoLine' }],
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      url,
      siteName: 'LingoLine',
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

  const url = `${SITE_URL}/blog/${slug}`;
  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: { '@type': 'Organization', name: 'LingoLine', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'LingoLine', url: SITE_URL },
    mainEntityOfPage: url,
    inLanguage: article.locale === 'ru' ? 'ru' : 'en',
  };

  const breadcrumb = breadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
    { name: article.title, url },
  ]);

  return (
    <>
      <JsonLd data={[blogPosting, breadcrumb]} />
      <BlogArticleClient article={article} slug={slug} />
    </>
  );
}
