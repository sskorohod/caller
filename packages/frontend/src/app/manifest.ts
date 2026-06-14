import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LingoLine — AI Live Phone Translator',
    short_name: 'LingoLine',
    description:
      'AI live phone interpreter — merge it into any call and it translates both sides in real time. No app, any phone, pay-as-you-go.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0e131f',
    theme_color: '#0e131f',
    lang: 'en',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
