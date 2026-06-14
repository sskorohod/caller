import type { Metadata } from 'next';
import PricingPageClient from './PricingPageClient';
import JsonLd from '@/components/JsonLd';
import { softwareApplicationSchema } from '../_seo/schema';

export const metadata: Metadata = {
  title: 'Pricing — Pay-as-you-go Phone Translation | LingoLine',
  description: 'No subscription. $2 free credit, then about $0.20/min — pay only while you talk. 13 languages, any phone, no app.',
  alternates: { canonical: 'https://lingoline.net/pricing' },
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema} />
      <PricingPageClient />
    </>
  );
}
