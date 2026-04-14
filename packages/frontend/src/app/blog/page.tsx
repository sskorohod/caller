import type { Metadata } from 'next';
import BlogIndexClient from './BlogIndexClient';

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
  return <BlogIndexClient />;
}
