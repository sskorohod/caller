import type { Metadata } from 'next';
import LandingClient from './_landing/LandingClient';

export const metadata: Metadata = {
  title: 'Caller — AI Phone Agents & Live Translator',
  description: 'Automate phone calls with AI agents or get real-time translation on any call. Deploy intelligent voice agents, connect knowledge bases, and scale your phone operations.',
};

export default function LandingPage() {
  return <LandingClient />;
}
