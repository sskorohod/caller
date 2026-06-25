/**
 * Single source of truth for the on-page FAQ (landing + translator).
 *
 * Consumed by the client components for rendering AND by the server wrappers to
 * emit FAQPage JSON-LD — keeping the visible Q&A and the structured data in sync
 * (a mismatch can trigger a search "manual action"). Facts here are canonical:
 * 13 languages, ~$0.20/min, voices by xAI (Grok) and OpenAI (no ElevenLabs).
 */
export interface FaqItem {
  q: { en: string; ru: string; es: string };
  a: { en: string; ru: string; es: string };
}

export const landingFaq: FaqItem[] = [
  {
    q: {
      en: 'Do I need to install an app?',
      ru: 'Нужно ли устанавливать приложение?',
      es: '¿Necesito instalar una app?',
    },
    a: {
      en: 'No. LingoLine is a phone number you merge into a normal call. Nothing to download, and the other person needs nothing at all.',
      ru: 'Нет. LingoLine — это номер, который вы подключаете в обычный звонок. Ничего скачивать не нужно, а собеседнику — тем более.',
      es: 'No. LingoLine es un número que añades a una llamada normal. No hay nada que descargar, y la otra persona no necesita nada en absoluto.',
    },
  },
  {
    q: {
      en: 'Which languages are supported?',
      ru: 'Какие языки поддерживаются?',
      es: '¿Qué idiomas son compatibles?',
    },
    a: {
      en: 'Thirteen: English, Russian, Ukrainian, Spanish, German, French, Chinese, Japanese, Korean, Arabic, Portuguese, Italian and Hindi — in any direction, detected automatically.',
      ru: 'Тринадцать: английский, русский, украинский, испанский, немецкий, французский, китайский, японский, корейский, арабский, португальский, итальянский и хинди — в любую сторону, с авто-определением.',
      es: 'Trece: inglés, ruso, ucraniano, español, alemán, francés, chino, japonés, coreano, árabe, portugués, italiano e hindi — en cualquier dirección, detectado automáticamente.',
    },
  },
  {
    q: {
      en: 'How accurate and natural is it?',
      ru: 'Насколько это точно и естественно?',
      es: '¿Qué tan preciso y natural suena?',
    },
    a: {
      en: 'It uses premium AI voices and translates both sides of the call out loud. Take turns and pause briefly so each phrase can finish — it sounds like a real interpreter, not a robot.',
      ru: 'Используются премиальные AI-голоса, перевод озвучивается для обеих сторон. Говорите по очереди с короткой паузой, чтобы фраза успевала завершиться — звучит как живой переводчик, а не робот.',
      es: 'Usa voces premium de IA y traduce ambos lados de la llamada en voz alta. Hablen por turnos con una breve pausa para que cada frase termine — suena como un intérprete real, no un robot.',
    },
  },
  {
    q: {
      en: 'Is it really no subscription?',
      ru: 'Правда без подписки?',
      es: '¿Realmente no hay suscripción?',
    },
    a: {
      en: "Yes. You top up a balance and pay about $0.20 per minute, only while you\'re actually talking. No monthly fee, no commitment. New accounts get $2 free to try.",
      ru: 'Да. Вы пополняете баланс и платите около $0.20 за минуту, только во время разговора. Без абонплаты и обязательств. Новым аккаунтам — $2 бесплатно на пробу.',
      es: 'Sí. Recargas un saldo y pagas unos $0.20 por minuto, solo mientras hablas. Sin cuota mensual ni compromisos. Las cuentas nuevas obtienen $2 gratis para probar.',
    },
  },
  {
    q: {
      en: "Does it work on the other person\'s landline or mobile?",
      ru: 'Работает ли с мобильным или стационарным телефоном собеседника?',
      es: '¿Funciona con el teléfono fijo o móvil de la otra persona?',
    },
    a: {
      en: "Yes. Because it\'s an ordinary phone call, it works whoever you\'re calling — a mobile, a landline, a clinic\'s switchboard. They just talk normally.",
      ru: 'Да. Это обычный звонок, поэтому работает с кем угодно — мобильный, стационарный, телефон регистратуры. Собеседник просто говорит как обычно.',
      es: 'Sí. Como es una llamada telefónica normal, funciona con quien sea que llames — un móvil, un fijo, la centralita de una clínica. Solo hablan con normalidad.',
    },
  },
  {
    q: {
      en: 'How do I pay?',
      ru: 'Как оплачивать?',
      es: '¿Cómo pago?',
    },
    a: {
      en: "Top up your balance by card through Stripe whenever you like. Usage is deducted per minute. You don\'t need a card to create an account and use your free credit.",
      ru: 'Пополняйте баланс картой через Stripe в любой момент. Списание идёт по минутам. Карта не нужна, чтобы создать аккаунт и потратить бесплатный баланс.',
      es: 'Recarga tu saldo con tarjeta a través de Stripe cuando quieras. El uso se descuenta por minuto. No necesitas tarjeta para crear una cuenta y usar el crédito gratuito.',
    },
  },
];

export const translatorFaq: FaqItem[] = [
  {
    q: {
      en: 'How does the translator join my call?',
      ru: 'Как переводчик подключается к моему звонку?',
      es: '¿Cómo se une el traductor a mi llamada?',
    },
    a: {
      en: 'Simply merge our translator number into your active call. It joins within seconds, introduces itself briefly, and begins translating both sides of the conversation in real-time.',
      ru: 'Просто добавьте наш номер переводчика к активному звонку. Он подключается за секунды, коротко представляется и начинает переводить обе стороны разговора в режиме реального времени.',
      es: 'Simplemente agrega nuestro número de traductor a tu llamada activa. Se une en segundos, se presenta brevemente y comienza a traducir ambos lados en tiempo real.',
    },
  },
  {
    q: {
      en: 'What languages are supported?',
      ru: 'Какие языки поддерживаются?',
      es: '¿Qué idiomas son compatibles?',
    },
    a: {
      en: "We support 13 languages — English, Russian, Ukrainian, Spanish, German, French, Chinese, Japanese, Korean, Arabic, Portuguese, Italian, and Hindi — in any direction. Auto-detection means you don\'t need to specify the language upfront.",
      ru: 'Мы поддерживаем 13 языков — английский, русский, украинский, испанский, немецкий, французский, китайский, японский, корейский, арабский, португальский, итальянский и хинди — в любую сторону. Автоопределение языка означает, что указывать его заранее не нужно.',
      es: 'Soportamos 13 idiomas — inglés, ruso, ucraniano, español, alemán, francés, chino, japonés, coreano, árabe, portugués, italiano e hindi — en cualquier dirección. La detección automática significa que no necesitas especificar el idioma de antemano.',
    },
  },
  {
    q: {
      en: 'Can I use it on inbound calls too?',
      ru: 'Можно ли использовать при входящих звонках?',
      es: '¿Puedo usarlo también en llamadas entrantes?',
    },
    a: {
      en: "Yes! Whether you're making a call or receiving one, you can merge the translator at any point during the conversation. It works seamlessly for both directions.",
      ru: 'Да! Неважно, звоните ли вы или принимаете звонок — вы можете подключить переводчика в любой момент разговора. Работает в обоих направлениях.',
      es: '¡Sí! Tanto si estás haciendo una llamada como recibiéndola, puedes agregar el traductor en cualquier momento. Funciona perfectamente en ambas direcciones.',
    },
  },
  {
    q: {
      en: 'Do I need to install any app?',
      ru: 'Нужно ли устанавливать приложение?',
      es: '¿Necesito instalar alguna app?',
    },
    a: {
      en: 'No apps needed. The translator works with any phone — landline, mobile, or VoIP. Just merge the number into your call and the translator handles everything.',
      ru: 'Никаких приложений. Переводчик работает с любым телефоном — стационарным, мобильным или VoIP. Просто добавьте номер к звонку — переводчик всё сделает сам.',
      es: 'No se necesitan apps. El traductor funciona con cualquier teléfono — fijo, móvil o VoIP. Solo agrega el número a tu llamada y el traductor se encarga de todo.',
    },
  },
  {
    q: {
      en: 'How does the Telegram integration work?',
      ru: 'Как работает интеграция с Telegram?',
      es: '¿Cómo funciona la integración con Telegram?',
    },
    a: {
      en: "Connect your Telegram account in settings. After each translated call, you'll receive a call summary and a link to the live transcript directly in Telegram — perfect for keeping records.",
      ru: 'Подключите аккаунт Telegram в настройках. После каждого переведённого звонка вы получите краткое резюме и ссылку на онлайн-транскрипцию прямо в Telegram — удобно для ведения записей.',
      es: 'Conecta tu cuenta de Telegram en la configuración. Tras cada llamada traducida, recibirás un resumen y un enlace a la transcripción en vivo directamente en Telegram.',
    },
  },
  {
    q: {
      en: 'What voices are available?',
      ru: 'Какие голоса доступны?',
      es: '¿Qué voces están disponibles?',
    },
    a: {
      en: 'Choose from premium AI voices by xAI (Grok) and OpenAI. Each provider offers multiple voice options and tones to match your situation.',
      ru: 'Выбирайте из премиальных AI-голосов от xAI (Grok) и OpenAI. Каждый провайдер предлагает несколько голосов и тонов под вашу ситуацию.',
      es: 'Elige entre voces de IA premium de xAI (Grok) y OpenAI. Cada proveedor ofrece múltiples opciones de voz y tono para adaptarse a tu situación.',
    },
  },
];

/** Build FAQPage JSON-LD in one language (one language per FAQPage; en = default). */
export function faqPageSchema(items: FaqItem[], lang: 'en' | 'ru' | 'es' = 'en'): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: it.a[lang] },
    })),
  };
}
