import type { Metadata } from 'next';
import DocsPageClient from './DocsPageClient';

export const metadata: Metadata = {
  title: 'Documentation — LingoLine',
  description: 'Complete documentation for LingoLine platform — getting started guides, API reference, agent configuration, and architecture overview.',
};

export default function DocsPage() {
  return <DocsPageClient />;
}
