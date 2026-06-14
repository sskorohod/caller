import type { Metadata } from 'next';
import HelpPageClient from '../../help/HelpPageClient';
import { SITE_URL, altLanguages } from '../../_seo/schema';

export const metadata: Metadata = {
  title: 'Центр помощи',
  description:
    'Ответы на частые вопросы о LingoLine — живом переводчике звонков: начало работы, подключение к звонку, языки и оплата.',
  alternates: { canonical: `${SITE_URL}/ru/help`, languages: altLanguages('/help') },
  openGraph: { locale: 'ru_RU', url: `${SITE_URL}/ru/help` },
};

export default function HelpPageRu() {
  return <HelpPageClient initialLang="ru" />;
}
