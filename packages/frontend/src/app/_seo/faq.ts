/**
 * Single source of truth for the on-page FAQ (landing + translator).
 *
 * Consumed by the client components for rendering AND by the server wrappers to
 * emit FAQPage JSON-LD — keeping the visible Q&A and the structured data in sync
 * (a mismatch can trigger a search "manual action"). Facts here are canonical:
 * 13 languages, ~$0.20/min, voices by xAI (Grok) and OpenAI (no ElevenLabs).
 */
export interface FaqItem {
  q: { en: string; ru: string };
  a: { en: string; ru: string };
}

export const landingFaq: FaqItem[] = [
  {
    q: { en: 'Do I need to install an app?', ru: 'Нужно ли устанавливать приложение?' },
    a: {
      en: 'No. LingoLine is a phone number you merge into a normal call. Nothing to download, and the other person needs nothing at all.',
      ru: 'Нет. LingoLine — это номер, который вы подключаете в обычный звонок. Ничего скачивать не нужно, а собеседнику — тем более.',
    },
  },
  {
    q: { en: 'Which languages are supported?', ru: 'Какие языки поддерживаются?' },
    a: {
      en: 'Thirteen: English, Russian, Ukrainian, Spanish, German, French, Chinese, Japanese, Korean, Arabic, Portuguese, Italian and Hindi — in any direction, detected automatically.',
      ru: 'Тринадцать: английский, русский, украинский, испанский, немецкий, французский, китайский, японский, корейский, арабский, португальский, итальянский и хинди — в любую сторону, с авто-определением.',
    },
  },
  {
    q: { en: 'How accurate and natural is it?', ru: 'Насколько это точно и естественно?' },
    a: {
      en: 'It uses premium AI voices and translates both sides of the call out loud. Take turns and pause briefly so each phrase can finish — it sounds like a real interpreter, not a robot.',
      ru: 'Используются премиальные AI-голоса, перевод озвучивается для обеих сторон. Говорите по очереди с короткой паузой, чтобы фраза успевала завершиться — звучит как живой переводчик, а не робот.',
    },
  },
  {
    q: { en: 'Is it really no subscription?', ru: 'Правда без подписки?' },
    a: {
      en: 'Yes. You top up a balance and pay about $0.20 per minute, only while you’re actually talking. No monthly fee, no commitment. New accounts get $2 free to try.',
      ru: 'Да. Вы пополняете баланс и платите около $0.20 за минуту, только во время разговора. Без абонплаты и обязательств. Новым аккаунтам — $2 бесплатно на пробу.',
    },
  },
  {
    q: { en: 'Does it work on the other person’s landline or mobile?', ru: 'Работает ли с мобильным или стационарным телефоном собеседника?' },
    a: {
      en: 'Yes. Because it’s an ordinary phone call, it works whoever you’re calling — a mobile, a landline, a clinic’s switchboard. They just talk normally.',
      ru: 'Да. Это обычный звонок, поэтому работает с кем угодно — мобильный, стационарный, телефон регистратуры. Собеседник просто говорит как обычно.',
    },
  },
  {
    q: { en: 'How do I pay?', ru: 'Как оплачивать?' },
    a: {
      en: 'Top up your balance by card through Stripe whenever you like. Usage is deducted per minute. You don’t need a card to create an account and use your free credit.',
      ru: 'Пополняйте баланс картой через Stripe в любой момент. Списание идёт по минутам. Карта не нужна, чтобы создать аккаунт и потратить бесплатный баланс.',
    },
  },
];

export const translatorFaq: FaqItem[] = [
  {
    q: { en: 'How does the translator join my call?', ru: 'Как переводчик подключается к моему звонку?' },
    a: {
      en: 'Simply merge our translator number into your active call. It joins within seconds, introduces itself briefly, and begins translating both sides of the conversation in real-time.',
      ru: 'Просто добавьте наш номер переводчика к активному звонку. Он подключается за секунды, коротко представляется и начинает переводить обе стороны разговора в режиме реального времени.',
    },
  },
  {
    q: { en: 'What languages are supported?', ru: 'Какие языки поддерживаются?' },
    a: {
      en: 'We support 13 languages — English, Russian, Ukrainian, Spanish, German, French, Chinese, Japanese, Korean, Arabic, Portuguese, Italian, and Hindi — in any direction. Auto-detection means you don’t need to specify the language upfront.',
      ru: 'Мы поддерживаем 13 языков — английский, русский, украинский, испанский, немецкий, французский, китайский, японский, корейский, арабский, португальский, итальянский и хинди — в любую сторону. Автоопределение языка означает, что указывать его заранее не нужно.',
    },
  },
  {
    q: { en: 'Can I use it on inbound calls too?', ru: 'Можно ли использовать при входящих звонках?' },
    a: {
      en: "Yes! Whether you're making a call or receiving one, you can merge the translator at any point during the conversation. It works seamlessly for both directions.",
      ru: 'Да! Неважно, звоните ли вы или принимаете звонок — вы можете подключить переводчика в любой момент разговора. Работает в обоих направлениях.',
    },
  },
  {
    q: { en: 'Do I need to install any app?', ru: 'Нужно ли устанавливать приложение?' },
    a: {
      en: 'No apps needed. The translator works with any phone — landline, mobile, or VoIP. Just merge the number into your call and the translator handles everything.',
      ru: 'Никаких приложений. Переводчик работает с любым телефоном — стационарным, мобильным или VoIP. Просто добавьте номер к звонку — переводчик всё сделает сам.',
    },
  },
  {
    q: { en: 'How does the Telegram integration work?', ru: 'Как работает интеграция с Telegram?' },
    a: {
      en: "Connect your Telegram account in settings. After each translated call, you'll receive a call summary and a link to the live transcript directly in Telegram — perfect for keeping records.",
      ru: 'Подключите аккаунт Telegram в настройках. После каждого переведённого звонка вы получите краткое резюме и ссылку на онлайн-транскрипцию прямо в Telegram — удобно для ведения записей.',
    },
  },
  {
    q: { en: 'What voices are available?', ru: 'Какие голоса доступны?' },
    a: {
      en: 'Choose from premium AI voices by xAI (Grok) and OpenAI. Each provider offers multiple voice options and tones to match your situation.',
      ru: 'Выбирайте из премиальных AI-голосов от xAI (Grok) и OpenAI. Каждый провайдер предлагает несколько голосов и тонов под вашу ситуацию.',
    },
  },
];

/** Build FAQPage JSON-LD from the English Q&A (one language per FAQPage; en = canonical). */
export function faqPageSchema(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q.en,
      acceptedAnswer: { '@type': 'Answer', text: it.a.en },
    })),
  };
}
