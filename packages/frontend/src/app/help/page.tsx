import type { Metadata } from 'next';
import HelpPageClient from './HelpPageClient';
import { SITE_URL, altLanguages } from '../_seo/schema';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Answers to common questions about LingoLine — the live phone translator: getting started, merging into a call, languages, and billing.',
  alternates: { canonical: `${SITE_URL}/help`, languages: altLanguages('/help') },
};

export default function HelpPage() {
  return <HelpPageClient />;
}
