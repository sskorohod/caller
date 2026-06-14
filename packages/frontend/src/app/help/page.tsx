import type { Metadata } from 'next';
import HelpPageClient from './HelpPageClient';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Answers to common questions about LingoLine — the live phone translator: getting started, merging into a call, languages, and billing.',
};

export default function HelpPage() {
  return <HelpPageClient />;
}
