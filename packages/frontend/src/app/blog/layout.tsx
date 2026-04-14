import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Caller Blog',
    default: 'Blog — Caller',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
