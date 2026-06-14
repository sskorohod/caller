import type { Metadata } from 'next';
import DocsPageClient from './DocsPageClient';
import JsonLd from '@/components/JsonLd';
import { breadcrumbSchema, SITE_URL, altLanguages } from '../_seo/schema';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'How to use LingoLine, the AI live phone translator — getting started, merging the translator into a call, supported languages, and how the balance works.',
  alternates: { canonical: `${SITE_URL}/docs`, languages: altLanguages('/docs') },
};

export default function DocsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: SITE_URL },
          { name: 'Documentation', url: `${SITE_URL}/docs` },
        ])}
      />
      <DocsPageClient />
    </>
  );
}
