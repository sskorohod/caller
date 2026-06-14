import type { Metadata } from 'next';
import DocsPageClient from '../../docs/DocsPageClient';
import JsonLd from '@/components/JsonLd';
import { breadcrumbSchema, SITE_URL, altLanguages } from '../../_seo/schema';

export const metadata: Metadata = {
  title: 'Документация',
  description:
    'Как пользоваться LingoLine — живым AI-переводчиком звонков: начало работы, подключение переводчика к звонку, языки и как работает баланс.',
  alternates: { canonical: `${SITE_URL}/ru/docs`, languages: altLanguages('/docs') },
  openGraph: { locale: 'ru_RU', url: `${SITE_URL}/ru/docs` },
};

export default function DocsPageRu() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Главная', url: `${SITE_URL}/ru` },
          { name: 'Документация', url: `${SITE_URL}/ru/docs` },
        ])}
      />
      <DocsPageClient initialLang="ru" />
    </>
  );
}
