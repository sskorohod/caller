import type { Metadata } from 'next';
import { BlogLangWrapper } from '@/app/blog/_components/BlogLangWrapper';

export const metadata: Metadata = {
  title: {
    template: '%s | LingoLine Blog',
    default: 'Blog — LingoLine',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <BlogLangWrapper>{children}</BlogLangWrapper>;
}
