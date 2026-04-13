import type { Metadata } from 'next';
import HelpPageClient from './HelpPageClient';

export const metadata: Metadata = {
  title: 'Help Center — Caller',
  description: 'Find answers to common questions about Caller AI phone agents, live translation, billing, and more.',
};

export default function HelpPage() {
  return <HelpPageClient />;
}
