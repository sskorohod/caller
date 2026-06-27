import type { Metadata } from 'next';
import HelpPageClient from '../../help/HelpPageClient';
import { SITE_URL, altLanguages } from '../../_seo/schema';

export const metadata: Metadata = {
  title: 'Centro de ayuda',
  description:
    'Respuestas a preguntas frecuentes sobre LingoLine — el traductor de llamadas AI en vivo: primeros pasos, conectar a una llamada, idiomas y pagos.',
  alternates: { canonical: `${SITE_URL}/es/help`, languages: altLanguages('/help') },
  openGraph: { locale: 'es_ES', url: `${SITE_URL}/es/help` },
};

export default function HelpPageEs() {
  return <HelpPageClient initialLang="es" />;
}
