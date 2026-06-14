import type { Metadata } from 'next';
import TranslatorPageClient from '../../translator/TranslatorPageClient';
import JsonLd from '@/components/JsonLd';
import { softwareApplicationSchema, altLanguages } from '../../_seo/schema';
import { faqPageSchema, translatorFaq } from '../../_seo/faq';

export const metadata: Metadata = {
  title: 'Живой переводчик — перевод звонков в реальном времени',
  description:
    'Подключите живого переводчика к любому телефонному звонку за секунды. Перевод в реальном времени на 13 языков естественными AI-голосами.',
  alternates: { canonical: 'https://lingoline.net/ru/translator', languages: altLanguages('/translator') },
  openGraph: { locale: 'ru_RU', url: 'https://lingoline.net/ru/translator' },
};

export default function TranslatorPageRu() {
  return (
    <>
      <JsonLd data={[softwareApplicationSchema, faqPageSchema(translatorFaq, 'ru')]} />
      <TranslatorPageClient initialLang="ru" />
    </>
  );
}
