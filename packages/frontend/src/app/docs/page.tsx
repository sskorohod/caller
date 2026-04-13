import type { Metadata } from 'next';
import DocsPageClient from './DocsPageClient';

export const metadata: Metadata = {
  title: 'Documentation — Caller',
  description: 'Complete documentation for Caller platform — getting started guides, API reference, agent configuration, and architecture overview.',
};

export default function DocsPage() {
  return <DocsPageClient />;
}
