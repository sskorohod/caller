/**
 * Canonical structured-data (schema.org / JSON-LD) building blocks for GEO.
 *
 * Single source of truth for the product facts that generative engines read.
 * Keep every value factual and consistent with the on-page copy (esp. the
 * $0.20/min price). No marketing imperatives or instruction-like text here.
 */

export const SITE_URL = 'https://lingoline.net';
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** The 13 phone-call translation languages (BCP-47-ish codes). */
export const TRANSLATION_LANGS = ['en', 'ru', 'uk', 'es', 'de', 'fr', 'zh', 'ja', 'ko', 'ar', 'pt', 'it', 'hi'];

export const organizationSchema: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'LingoLine',
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description:
    'LingoLine is an AI live phone interpreter that joins a phone call and translates both sides in real time, on any phone, with no app to install.',
};

export const websiteSchema: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: SITE_URL,
  name: 'LingoLine',
  publisher: { '@id': ORG_ID },
  inLanguage: ['en', 'ru'],
};

/**
 * The primary entity LLMs cite for "what is LingoLine" / "how much does it cost".
 * `offers` carries the canonical $0.20/min price — keep in sync with the pages
 * and llms.txt. No `aggregateRating` (no real reviews exist — do not fabricate).
 */
export const softwareApplicationSchema: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'LingoLine',
  url: SITE_URL,
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'Any (no app install — works from any phone)',
  description:
    'AI live phone interpreter. Merge it into any phone call (or use speakerphone) and it translates both sides out loud in real time. 13 languages, any direction, detected automatically. No app, pay-as-you-go.',
  featureList: [
    'Real-time two-way phone call translation',
    'Merge into any call via the phone conference/merge button',
    '13 languages with automatic direction detection',
    'No app install — works from any phone',
    'Pay-as-you-go billing, no subscription',
    'Live text transcript',
    'Telegram call summaries',
  ],
  inLanguage: TRANSLATION_LANGS,
  publisher: { '@id': ORG_ID },
  offers: {
    '@type': 'Offer',
    priceCurrency: 'USD',
    price: '0.20',
    unitText: 'minute',
    description:
      'Pay-as-you-go, about $0.20 per minute, charged only while talking. $2 in free credit on signup. No subscription, no monthly fee.',
  },
};

/**
 * hreflang alternates for a page that has an EN (root) and RU (/ru) version.
 * `enPath` is the path WITHOUT locale prefix: '' for home, '/translator', etc.
 */
export function altLanguages(enPath: string): Record<string, string> {
  const en = `${SITE_URL}${enPath || '/'}`;
  return { en, ru: `${SITE_URL}/ru${enPath}`, 'x-default': en };
}

/** Build a BreadcrumbList from [{ name, url }] crumbs. */
export function breadcrumbSchema(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
