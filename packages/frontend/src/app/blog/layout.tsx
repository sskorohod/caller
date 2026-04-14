import type { Metadata } from 'next';
import { BlogLangWrapper } from '@/app/blog/_components/BlogLangWrapper';

export const metadata: Metadata = {
  title: {
    template: '%s | Caller Blog',
    default: 'Blog — Caller',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <BlogLangWrapper>{children}</BlogLangWrapper>;
}
