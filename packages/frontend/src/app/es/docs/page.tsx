import type { Metadata } from 'next';
import DocsPageClient from '../../docs/DocsPageClient';
import JsonLd from '@/components/JsonLd';
import { breadcrumbSchema, SITE_URL, altLanguages } from '../../_seo/schema';

export const metadata: Metadata = {
  title: 'Documentación',
  description:
    'Cómo usar LingoLine — el traductor de llamadas AI en vivo: primeros pasos, conectar el traductor a una llamada, idiomas y cómo funciona el saldo.',
  alternates: { canonical: `${SITE_URL}/es/docs`, languages: altLanguages('/docs') },
  openGraph: { locale: 'es_ES', url: `${SITE_URL}/es/docs` },
};

export default function DocsPageEs() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Inicio', url: `${SITE_URL}/es` },
          { name: 'Documentación', url: `${SITE_URL}/es/docs` },
        ])}
      />
      <DocsPageClient initialLang="es" />
    </>
  );
}
