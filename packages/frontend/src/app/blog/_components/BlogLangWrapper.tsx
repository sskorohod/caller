'use client';
import { LangProvider } from '@/app/_landing/useLang';
import type { ReactNode } from 'react';

export function BlogLangWrapper({ children }: { children: ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}
