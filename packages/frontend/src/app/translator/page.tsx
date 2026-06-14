import type { Metadata } from 'next';
import TranslatorPageClient from './TranslatorPageClient';
import JsonLd from '@/components/JsonLd';
import { softwareApplicationSchema } from '../_seo/schema';
import { faqPageSchema, translatorFaq } from '../_seo/faq';
import { altLanguages } from '../_seo/schema';

export const metadata: Metadata = {
  title: 'Live Translator — Real-Time Phone Translation',
  description: 'Merge a live translator into any phone call in seconds. Real-time translation in 13 languages with natural AI voices.',
  alternates: { canonical: 'https://lingoline.net/translator', languages: altLanguages('/translator') },
};

export default function TranslatorPage() {
  return (
    <>
      <JsonLd data={[softwareApplicationSchema, faqPageSchema(translatorFaq)]} />
      <TranslatorPageClient />
    </>
  );
}
