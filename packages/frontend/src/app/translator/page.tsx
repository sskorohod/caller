import type { Metadata } from 'next';
import TranslatorPageClient from './TranslatorPageClient';

export const metadata: Metadata = {
  title: 'Live Translator — Real-Time Phone Translation | Caller',
  description: 'Merge a live translator into any phone call in seconds. Real-time translation in 15+ languages with professional AI voices.',
};

export default function TranslatorPage() {
  return <TranslatorPageClient />;
}
