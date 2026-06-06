export interface HelpArticle {
  id: string;
  titleKey: string;
  content: { ru: string; en: string };
}

export interface HelpCategory {
  id: string;
  titleKey: string;
  icon: string; // material symbol name
  articles: HelpArticle[];
}

// Help content for the Live Translator product (single-product SaaS).
// Plain, simple instructions: how to use the translator and how to top up balance.
export const HELP_CATEGORIES: HelpCategory[] = [
  // ─── 1. Getting started ───────────────────────────────────────────
  {
    id: 'getting-started',
    titleKey: 'help.cat.gettingStarted',
    icon: 'rocket_launch',
    articles: [
      {
        id: 'what-is-translator',
        titleKey: 'help.art.whatIsTranslator',
        content: {
          ru: `# Что такое Live Translator

Live Translator — это живой переводчик для телефонных звонков.

Вы звоните на свой персональный номер, включаете громкую связь — и AI переводит
разговор между вами и собеседником **в реальном времени, в обе стороны**.

## Главное

- **Работает с любого телефона** — приложения не нужны.
- **Переводит обе стороны** — вы говорите на своём языке, собеседник на своём.
- **Оплата по факту** — платите только за минуты разговора, без подписки.

## Что нужно, чтобы начать

1. Узнать свой номер переводчика (он на **Главной**).
2. Выбрать языки (на каком говорите вы и на какой переводить).
3. Пополнить баланс.

Готово — можно звонить. Дальше в этой справке всё по шагам.`,
          en: `# What is Live Translator

Live Translator is a live interpreter for phone calls.

You call your personal number, turn on speakerphone — and the AI translates the
conversation between you and the other person **in real time, both ways**.

## The essentials

- **Works from any phone** — no apps needed.
- **Translates both sides** — you speak your language, they speak theirs.
- **Pay as you go** — you only pay for minutes used, no subscription.

## What you need to start

1. Find your translator number (it's on **Home**).
2. Choose your languages (what you speak and what to translate to).
3. Top up your balance.

That's it — you're ready to call. The rest of this help walks you through each step.`,
        },
      },
      {
        id: 'first-call',
        titleKey: 'help.art.firstCall',
        content: {
          ru: `# Ваш первый перевод — за 4 шага

1. **Откройте страницу «Переводчик».** Там крупно показан ваш номер.

2. **Выберите языки.** «Я говорю на» — ваш язык, «Переводить на» — язык собеседника.
   Настройка сохраняется автоматически.

3. **Позвоните на номер** с любого телефона и **включите громкую связь**, чтобы вас
   обоих было слышно.

4. **Говорите по очереди.** Скажите фразу и сделайте короткую паузу — AI переведёт её
   вслух на нужный язык. Затем ответит собеседник, и перевод пойдёт в обратную сторону.

> Совет: говорите законченными фразами и делайте паузу в 1–2 секунды — так перевод
> точнее.

Во время звонка на странице видно живую расшифровку разговора. После звонка он
сохранится в разделе **«Звонки»**.`,
          en: `# Your first translation — in 4 steps

1. **Open the "Translator" page.** Your number is shown there in large text.

2. **Choose your languages.** "I speak" — your language; "Translate to" — the other
   person's language. The setting saves automatically.

3. **Call the number** from any phone and **turn on speakerphone** so both of you can
   be heard.

4. **Take turns speaking.** Say a phrase and pause briefly — the AI will speak the
   translation aloud. Then the other person replies, and it translates back.

> Tip: speak in complete phrases and pause for 1–2 seconds — it makes translation
> more accurate.

During the call you'll see a live transcript on the page. After the call it's saved
under **"Calls"**.`,
        },
      },
    ],
  },

  // ─── 2. Using the translator ──────────────────────────────────────
  {
    id: 'translator',
    titleKey: 'help.cat.translator',
    icon: 'translate',
    articles: [
      {
        id: 'how-to-call',
        titleKey: 'help.art.howToCall',
        content: {
          ru: `# Как идёт звонок с переводчиком

Переводчик подключается к разговору как третий участник, который слышит обоих и
озвучивает перевод.

## Как правильно

- **Оба собеседника — у одного телефона** на громкой связи. Переводчик слышит обоих
  через один микрофон.
- **Говорите по очереди.** Закончили мысль — пауза. AI переводит и озвучивает.
- **Не перебивайте перевод** — дайте фразе доозвучиться, потом говорите дальше.

## Что переводится

По умолчанию перевод идёт **в обе стороны**: ваша речь → на язык собеседника, его
речь → на ваш язык. Язык определяется автоматически по тому, что было сказано.

> Если нужно переводить только в одну сторону — включите режим «Одна сторона» в
> расширенных настройках.`,
          en: `# How a translated call works

The translator joins the conversation as a third participant that hears both people
and voices the translation.

## How to do it right

- **Both people are near one phone** on speakerphone. The translator hears both
  through the same microphone.
- **Take turns.** Finish your thought, then pause. The AI translates and speaks it.
- **Don't talk over the translation** — let the phrase finish, then continue.

## What gets translated

By default it translates **both ways**: your speech → the other person's language,
their speech → your language. The language is detected automatically from what's said.

> If you need one-way translation only, switch to "One direction" mode in advanced
> settings.`,
        },
      },
      {
        id: 'languages-settings',
        titleKey: 'help.art.languagesSettings',
        content: {
          ru: `# Языки и настройки голоса

Все настройки — на странице **«Переводчик»**.

## Языки (главное)

- **Я говорю на** — ваш язык.
- **Переводить на** — язык собеседника.

Меняются в один клик и сохраняются сразу.

## Расширенные настройки (необязательно)

- **Голос** — каким голосом озвучивается перевод (мужские и женские варианты).
- **Тон** — стиль перевода: нейтральный, деловой, дружеский, медицинский, юридический.
- **Приветствие** — фраза, которую переводчик скажет в начале звонка.
- **Личный контекст** — ваши данные (имя, дата рождения, страховка, адрес). Помогает
  AI точно произносить имена и цифры при звонках в банк, госпиталь и т.п.

Эти настройки скрыты под «Расширенные настройки» — большинству достаточно только
выбрать языки.`,
          en: `# Languages & voice settings

All settings live on the **"Translator"** page.

## Languages (the main thing)

- **I speak** — your language.
- **Translate to** — the other person's language.

Change with one click; saved instantly.

## Advanced settings (optional)

- **Voice** — which voice speaks the translation (male and female options).
- **Tone** — translation style: neutral, business, friendly, medical, legal.
- **Greeting** — a phrase the translator says at the start of the call.
- **Personal context** — your details (name, date of birth, insurance, address).
  Helps the AI pronounce names and numbers precisely on calls to a bank, hospital, etc.

These are tucked under "Advanced settings" — most people only need to pick the
languages.`,
        },
      },
      {
        id: 'live-and-history',
        titleKey: 'help.art.liveHistory',
        content: {
          ru: `# Живой перевод и история звонков

## Во время звонка

На странице «Переводчик» в реальном времени видно расшифровку: что сказал каждый и
как это переведено. Там же есть кнопка завершить звонок.

## После звонка

Все разговоры сохраняются в разделе **«Звонки»**. По каждому звонку можно посмотреть:

- дату, длительность и стоимость;
- полную расшифровку разговора с переводом;
- запись звонка (если включена).

> Получать ссылку на живой перевод и итог звонка можно также в Telegram — см. раздел
> «Уведомления в Telegram».`,
          en: `# Live translation & call history

## During the call

On the "Translator" page you see a live transcript: what each person said and how it
was translated. There's also a button to end the call.

## After the call

Every conversation is saved under **"Calls"**. For each call you can see:

- date, duration, and cost;
- the full transcript with translation;
- the call recording (if enabled).

> You can also get the live-translation link and call summary in Telegram — see
> "Telegram notifications".`,
        },
      },
    ],
  },

  // ─── 3. Balance & payments ────────────────────────────────────────
  {
    id: 'billing',
    titleKey: 'help.cat.billing',
    icon: 'payments',
    articles: [
      {
        id: 'how-balance-works',
        titleKey: 'help.art.howBalanceWorks',
        content: {
          ru: `# Как работает баланс и цены

Live Translator работает по принципу **«оплата по факту»** — никакой подписки и
ежемесячной платы.

## Как это устроено

- Вы пополняете баланс на любую сумму.
- За каждый звонок с баланса списывается стоимость минут разговора.
- Списание происходит **после завершения звонка**.

## Сколько стоит

Перевод стоит примерно **$0.20 за минуту** разговора. Точную текущую ставку и остаток
видно на странице **«Баланс»**.

Ваш баланс всегда виден слева в меню (и в шапке на телефоне). Рядом — примерная оценка,
на сколько минут перевода хватит текущего остатка.

> Когда баланс становится низким, появляется предупреждение и кнопка пополнить — чтобы
> звонок не прервался на середине.`,
          en: `# How balance & pricing work

Live Translator is **pay as you go** — no subscription, no monthly fee.

## How it works

- You top up your balance with any amount.
- Each call deducts the cost of the minutes used.
- The charge happens **after the call ends**.

## What it costs

Translation costs about **$0.20 per minute** of conversation. The exact current rate
and your remaining balance are shown on the **"Balance"** page.

Your balance is always visible in the left menu (and in the top bar on mobile). Next to
it is a rough estimate of how many minutes of translation your balance covers.

> When your balance runs low, you'll see a warning and a top-up button — so a call
> doesn't get cut off mid-conversation.`,
        },
      },
      {
        id: 'how-to-topup',
        titleKey: 'help.art.howToTopup',
        content: {
          ru: `# Как пополнить баланс

1. Откройте раздел **«Баланс»** (или нажмите **«Пополнить»** рядом с балансом в меню).

2. **Выберите сумму** — есть готовые варианты ($10, $25, $50, $100) или введите свою.

3. Нажмите **«Оплатить»** — откроется защищённая страница оплаты **Stripe**.

4. Введите данные карты и подтвердите платёж.

Баланс пополнится **сразу** после оплаты, и можно звонить.

## Полезно знать

- Оплата проходит через Stripe — мы не храним данные вашей карты.
- Все пополнения и списания видны в истории на странице «Баланс».
- Деньги не сгорают — остаток сохраняется до использования.`,
          en: `# How to top up your balance

1. Open the **"Balance"** page (or tap **"Top up"** next to the balance in the menu).

2. **Choose an amount** — preset options ($10, $25, $50, $100) or enter your own.

3. Click **"Pay"** — a secure **Stripe** payment page opens.

4. Enter your card details and confirm the payment.

Your balance is credited **instantly** after payment, and you can make calls.

## Good to know

- Payment is handled by Stripe — we never store your card details.
- All top-ups and charges are listed in the history on the "Balance" page.
- Funds don't expire — your balance stays until you use it.`,
        },
      },
    ],
  },

  // ─── 4. Settings & notifications ──────────────────────────────────
  {
    id: 'settings',
    titleKey: 'help.cat.settings',
    icon: 'settings',
    articles: [
      {
        id: 'telegram-notifications',
        titleKey: 'help.art.telegramNotifs',
        content: {
          ru: `# Уведомления в Telegram

Вы можете получать в Telegram уведомления о звонках и ссылку на живой перевод.

## Как подключить

1. Откройте **Настройки**.
2. В разделе Telegram укажите токен бота и подключите чат (по инструкции на странице).
3. Отправьте боту команду **/start**, чтобы связать чат.

## Что приходит

- Уведомление о начале звонка со ссылкой на **живой перевод** в браузере.
- Итог по завершении: длительность и стоимость.

Также боту доступны команды управления текущим звонком: \`/live\`, \`/pause\`,
\`/resume\`, \`/hangup\`, \`/summary\`.`,
          en: `# Telegram notifications

You can receive call notifications and a live-translation link in Telegram.

## How to connect

1. Open **Settings**.
2. In the Telegram section, enter your bot token and connect the chat (per the
   on-page instructions).
3. Send the bot **/start** to link your chat.

## What you get

- A notification when a call starts, with a link to the **live translation** in the
  browser.
- A summary when it ends: duration and cost.

The bot also accepts commands to control the current call: \`/live\`, \`/pause\`,
\`/resume\`, \`/hangup\`, \`/summary\`.`,
        },
      },
      {
        id: 'account',
        titleKey: 'help.art.account',
        content: {
          ru: `# Аккаунт и рабочее пространство

В **Настройках** можно:

- посмотреть данные рабочего пространства и участников;
- управлять подключением Telegram;
- изменить язык интерфейса (RU / EN) — переключатель в левом меню.

Язык интерфейса и язык перевода — это разные вещи: язык интерфейса меняет надписи в
панели, а языки перевода настраиваются на странице «Переводчик».`,
          en: `# Account & workspace

In **Settings** you can:

- view your workspace details and members;
- manage the Telegram connection;
- change the interface language (RU / EN) — the toggle is in the left menu.

The interface language and the translation language are different things: the
interface language changes the labels in the panel, while the translation languages
are configured on the "Translator" page.`,
        },
      },
    ],
  },

  // ─── 5. FAQ ───────────────────────────────────────────────────────
  {
    id: 'faq',
    titleKey: 'help.cat.faq',
    icon: 'help',
    articles: [
      {
        id: 'faq',
        titleKey: 'help.art.faq',
        content: {
          ru: `# Частые вопросы

**С какого телефона можно звонить?**
С любого — мобильного или стационарного, любого оператора. Приложения не нужны.

**Нужно ли обоим быть рядом?**
Да. Оба собеседника находятся у одного телефона на громкой связи — так переводчик
слышит обоих.

**Какие языки поддерживаются?**
Английский, русский, испанский, немецкий, французский, китайский, японский, корейский,
арабский, португальский, итальянский, хинди и другие. Полный список — в выборе языков.

**Перевод робот или живой голос?**
Используются премиальные AI-голоса — звучит естественно, не «по-роботски».

**Не слышно перевода / тишина в начале.**
Убедитесь, что включена громкая связь и микрофон не перекрыт. Перевод начинается после
того, как вы закончили фразу и сделали паузу.

**Что будет, если кончится баланс?**
Заранее появится предупреждение. Пополните баланс на странице «Баланс» — звонок не
прервётся, если успеть пополнить.

**Это конфиденциально?**
Расшифровки и записи доступны только в вашем рабочем пространстве.

Остались вопросы — напишите в поддержку (кнопка на этой странице).`,
          en: `# Frequently asked questions

**What phone can I call from?**
Any phone — mobile or landline, any carrier. No apps required.

**Do both people need to be together?**
Yes. Both people are near one phone on speakerphone — that's how the translator hears
both of you.

**Which languages are supported?**
English, Russian, Spanish, German, French, Chinese, Japanese, Korean, Arabic,
Portuguese, Italian, Hindi, and more. The full list is in the language picker.

**Is it a robotic or a natural voice?**
It uses premium AI voices — it sounds natural, not robotic.

**No translation / silence at the start.**
Make sure speakerphone is on and the mic isn't blocked. Translation starts after you
finish a phrase and pause.

**What happens if my balance runs out?**
You'll get a warning in advance. Top up on the "Balance" page — the call won't be cut
off if you top up in time.

**Is it private?**
Transcripts and recordings are only available within your workspace.

Still have questions? Message support (button on this page).`,
        },
      },
    ],
  },
];
