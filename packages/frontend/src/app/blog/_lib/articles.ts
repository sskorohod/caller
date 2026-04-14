export interface Article {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  publishedAt: string;
  locale: 'en' | 'ru';
  readTime: string;
}

export const articles: Article[] = [
  {
    slug: 'languageline-alternative',
    title: 'Best LanguageLine Alternative in 2026: AI Phone Translation for $0.15/min',
    description: 'Compare Live Translator vs LanguageLine, Boostlingo, and KUDO. Get real-time phone translation for $0.15/min — no app, no contract, any phone.',
    keywords: ['languageline alternative', 'phone interpreter service', 'over the phone interpreter', 'boostlingo alternative'],
    publishedAt: '2026-04-15',
    locale: 'en',
    readTime: '6 min',
  },
  {
    slug: 'uscis-interpreter-policy',
    title: 'USCIS Stopped Providing Interpreters — Here\'s What You Can Do',
    description: 'USCIS ended free interpreter services. Learn about affordable alternatives including AI phone translation for immigrants with limited English proficiency.',
    keywords: ['USCIS interpreter policy', 'USCIS interpreter 2025', 'immigration interpreter', 'limited english proficiency'],
    publishedAt: '2026-04-16',
    locale: 'en',
    readTime: '5 min',
  },
  {
    slug: 'call-insurance-no-english',
    title: 'How to Call US Insurance If You Don\'t Speak English',
    description: 'Step-by-step guide for non-English speakers to call insurance companies. Options include bilingual agents, interpreter services, and AI phone translation.',
    keywords: ['call insurance no english', 'phone interpreter for insurance', 'insurance call translator', 'non english speaker insurance'],
    publishedAt: '2026-04-17',
    locale: 'en',
    readTime: '7 min',
  },
  {
    slug: 'real-time-phone-translation',
    title: 'Real-Time Phone Translation in 2026: How It Actually Works',
    description: 'How real-time phone translation works: app-based vs carrier-based vs merge-a-number. Compare T-Mobile, Telelingo, AIPhone, and Live Translator.',
    keywords: ['real-time phone translation', 'phone call translator', 'live phone translation', 'AI phone translator'],
    publishedAt: '2026-04-18',
    locale: 'en',
    readTime: '6 min',
  },
  {
    slug: 'kak-pozvonit-v-bank',
    title: 'Как позвонить в американский банк если плохо говоришь по-английски',
    description: 'Пошаговая инструкция: как позвонить в банк, страховую или госорганы в США без хорошего английского. AI-переводчик за $0.15/мин.',
    keywords: ['позвонить в банк сша', 'переводчик по телефону', 'переводчик для звонков', 'плохой английский звонок'],
    publishedAt: '2026-04-19',
    locale: 'ru',
    readTime: '5 мин',
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
