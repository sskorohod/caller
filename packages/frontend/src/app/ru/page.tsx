import type { Metadata } from 'next';
import LandingClient from '../_landing/LandingClient';
import JsonLd from '@/components/JsonLd';
import { softwareApplicationSchema, altLanguages } from '../_seo/schema';
import { faqPageSchema, landingFaq } from '../_seo/faq';

export const metadata: Metadata = {
  title: { absolute: 'LingoLine — живой AI-переводчик телефонных звонков' },
  description:
    'LingoLine переводит ваши телефонные звонки в реальном времени, в обе стороны. Подключите наш номер к любому звонку или включите громкую связь — без приложений, с любого телефона, оплата по факту.',
  alternates: { canonical: 'https://lingoline.net/ru', languages: altLanguages('') },
  openGraph: { locale: 'ru_RU', url: 'https://lingoline.net/ru' },
};

export default function LandingPageRu() {
  return (
    <>
      <JsonLd data={[softwareApplicationSchema, faqPageSchema(landingFaq, 'ru')]} />
      <LandingClient initialLang="ru" />
    </>
  );
}
