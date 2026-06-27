import type { Metadata } from 'next';
import TranslatorPageClient from '../../translator/TranslatorPageClient';
import JsonLd from '@/components/JsonLd';
import { softwareApplicationSchema, altLanguages } from '../../_seo/schema';
import { faqPageSchema, translatorFaq } from '../../_seo/faq';

export const metadata: Metadata = {
  title: 'Traductor en vivo — traducción de llamadas en tiempo real',
  description:
    'Conecta un traductor en vivo a cualquier llamada telefónica en segundos. Traducción en tiempo real en 13 idiomas con voces naturales de IA.',
  alternates: { canonical: 'https://lingoline.net/es/translator', languages: altLanguages('/translator') },
  openGraph: { locale: 'es_ES', url: 'https://lingoline.net/es/translator' },
};

export default function TranslatorPageEs() {
  return (
    <>
      <JsonLd data={[softwareApplicationSchema, faqPageSchema(translatorFaq, 'es')]} />
      <TranslatorPageClient initialLang="es" />
    </>
  );
}
