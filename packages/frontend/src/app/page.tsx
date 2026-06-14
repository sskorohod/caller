import type { Metadata } from 'next';
import LandingClient from './_landing/LandingClient';
import JsonLd from '@/components/JsonLd';
import { softwareApplicationSchema } from './_seo/schema';

export const metadata: Metadata = {
  title: 'LingoLine — AI Live Translator for Phone Calls',
  description: 'Real-time AI interpretation on any phone call. Merge our number into a call and the AI translates both sides live — no apps, works from any phone.',
};

export default function LandingPage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema} />
      <LandingClient />
    </>
  );
}
