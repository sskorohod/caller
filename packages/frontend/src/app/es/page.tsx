import type { Metadata } from 'next';
import LandingClient from '../_landing/LandingClient';
import JsonLd from '@/components/JsonLd';
import { softwareApplicationSchema, altLanguages } from '../_seo/schema';
import { faqPageSchema, landingFaq } from '../_seo/faq';

export const metadata: Metadata = {
  title: { absolute: 'LingoLine — traducción AI en tiempo real para llamadas telefónicas' },
  description:
    'LingoLine traduce tus llamadas telefónicas en tiempo real, en ambas direcciones. Añade nuestro número a cualquier llamada o pon el altavoz — sin apps, desde cualquier teléfono, pago por uso.',
  alternates: { canonical: 'https://lingoline.net/es', languages: altLanguages('') },
  openGraph: { locale: 'es_ES', url: 'https://lingoline.net/es' },
};

export default function LandingPageEs() {
  return (
    <>
      <JsonLd data={[softwareApplicationSchema, faqPageSchema(landingFaq, 'es')]} />
      <LandingClient initialLang="es" />
    </>
  );
}
