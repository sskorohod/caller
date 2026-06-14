import type { MetadataRoute } from 'next';

const SITE_URL = 'https://lingoline.net';

// Private/app areas that should never be indexed by any crawler.
const DISALLOW = ['/dashboard', '/admin', '/api', '/auth', '/login', '/onboarding', '/oauth', '/calls', '/translate'];

/**
 * AI crawlers we explicitly welcome (search/citation AND training) — the owner
 * opted in to maximum AI presence. Listing them by name (rather than relying on
 * the `*` rule alone) documents the intent and survives engines that look for a
 * named match first.
 *
 * NOTE: production robots.txt may also be shaped by a Cloudflare edge rule.
 * If AI bots still don't fetch, disable Cloudflare's "Block AI bots" for the
 * lingoline.net zone — see docs/superpowers/plans (GEO plan, Cloudflare gate).
 */
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'CCBot',
  'Applebot-Extended',
  'Amazonbot',
  'Meta-ExternalAgent',
  'Bytespider',
  'cohere-ai',
  'DuckAssistBot',
  'YouBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
      { userAgent: '*', allow: '/', disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
