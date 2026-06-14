import type { MetadataRoute } from 'next';
import { articles } from './blog/_lib/articles';
import { altLanguages } from './_seo/schema';

const BASE_URL = 'https://lingoline.net';

export default function sitemap(): MetadataRoute.Sitemap {
  // Pages that have both an EN (root) and RU (/ru) version.
  const localized: { path: string; priority: number; freq: 'weekly' | 'monthly' }[] = [
    { path: '', priority: 1.0, freq: 'weekly' },
    { path: '/translator', priority: 0.9, freq: 'weekly' },
    { path: '/docs', priority: 0.5, freq: 'monthly' },
    { path: '/help', priority: 0.5, freq: 'monthly' },
  ];

  const localizedEntries: MetadataRoute.Sitemap = localized.flatMap(({ path, priority, freq }) => {
    const languages = altLanguages(path);
    return [
      { url: `${BASE_URL}${path || '/'}`, lastModified: new Date(), changeFrequency: freq, priority, alternates: { languages } },
      { url: `${BASE_URL}/ru${path}`, lastModified: new Date(), changeFrequency: freq, priority: priority - 0.1, alternates: { languages } },
    ];
  });

  // EN-only pages (no RU variant yet).
  const enOnly: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/acceptable-use`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Blog posts — driven from articles.ts, freshness from updatedAt ?? publishedAt.
  const blogPages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE_URL}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt ?? a.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...localizedEntries, ...enOnly, ...blogPages];
}
