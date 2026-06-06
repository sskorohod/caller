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
          ru: `# Ваш первый перевод

## Подготовка (один раз)

1. **Откройте страницу «Переводчик»** — там крупно показан ваш номер.
2. **Сохраните этот номер в контакты** телефона (например, «Переводчик»).
3. **Выберите языки**: «Я говорю на» — ваш язык, «Переводить на» — язык собеседника.
   Сохраняется автоматически.

## Звонок

**Если собеседник далеко (обычный случай):**
1. Позвоните ему как обычно.
2. Попросите подождать: «Одну секунду, я подключу переводчика».
3. Нажмите **«Добавить звонок»**, наберите сохранённый номер переводчика.
4. Когда переводчик ответит — нажмите **«Объединить» / «Merge»**.
5. Говорите по очереди — AI переводит обе стороны.

**Если вы рядом:** просто позвоните на номер переводчика и включите **громкую связь**.

> Совет: говорите законченными фразами и делайте паузу 1–2 секунды — так перевод
> точнее. Подробнее — в статье «Как идёт звонок».

Во время звонка на странице видно живую расшифровку. После звонка он сохранится в
разделе **«Звонки»**.`,
          en: `# Your first translation

## Set up (once)

1. **Open the "Translator" page** — your number is shown there in large text.
2. **Save that number to your phone contacts** (e.g. "Translator").
3. **Choose your languages**: "I speak" — your language; "Translate to" — the other
   person's language. Saved automatically.

## The call

**If the other person is remote (the common case):**
1. Call them as usual.
2. Ask them to hold: "One second, I'll add a translator."
3. Tap **"Add call"** and dial the saved translator number.
4. When the translator answers — tap **"Merge" / "Merge calls"**.
5. Take turns speaking — the AI translates both sides.

**If you're together:** just call the translator number and turn on **speakerphone**.

> Tip: speak in complete phrases and pause 1–2 seconds — it makes translation more
> accurate. See "How a call works" for details.

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
озвучивает перевод. Есть два способа подключить его — выберите свой.

## Сначала сохраните номер

Добавьте номер переводчика в контакты телефона (например, «Переводчик») — так его
будет быстро набрать во время звонка.

## Способ 1 — удалённый звонок (объединение звонков)

Когда вы и собеседник в разных местах:

1. **Позвоните собеседнику** как обычно и дождитесь ответа.
2. **Попросите его подождать** короткой фразой, например:
   «Одну секунду, я подключу переводчика».
3. На экране звонка нажмите **«Добавить звонок» (Add call)** и наберите сохранённый
   номер переводчика.
4. Когда переводчик ответит, нажмите **«Объединить» / «Merge calls»** — все окажутся
   в одном разговоре.
5. Говорите — AI переводит обе стороны.

> Кнопка называется «Объединить», «Merge» или «Merge calls» — она появляется на экране
> звонка после того, как вы добавили второй вызов.

## Способ 2 — личная встреча (громкая связь)

Когда вы и собеседник рядом:

1. **Позвоните на номер переводчика** и включите **громкую связь**.
2. Положите телефон между вами — переводчик слышит обоих через один микрофон.
3. Говорите по очереди.

## Общие правила

- **Говорите по очереди.** Закончили мысль — короткая пауза. AI переведёт и озвучит.
- **Не перебивайте перевод** — дайте фразе доозвучиться, потом продолжайте.
- Перевод по умолчанию идёт **в обе стороны**; язык определяется автоматически.`,
          en: `# How a translated call works

The translator joins the conversation as a third participant that hears both people
and voices the translation. There are two ways to add it — pick what fits.

## First, save the number

Add the translator number to your phone contacts (e.g. "Translator") so you can dial
it quickly during a call.

## Option 1 — remote call (merge calls)

When you and the other person are in different places:

1. **Call the other person** as usual and wait for them to answer.
2. **Ask them to hold** with a short phrase, e.g.:
   "One second, I'll add a translator."
3. On the call screen tap **"Add call"** and dial the saved translator number.
4. When the translator answers, tap **"Merge" / "Merge calls"** — everyone is now in
   one conversation.
5. Speak — the AI translates both sides.

> The button is labeled "Merge", "Merge calls", or "Combine" — it appears on the call
> screen once you've added the second call.

## Option 2 — in person (speakerphone)

When you and the other person are together:

1. **Call the translator number** and turn on **speakerphone**.
2. Put the phone between you — the translator hears both through one microphone.
3. Take turns speaking.

## General rules

- **Take turns.** Finish your thought, then pause briefly. The AI translates and
  speaks it.
- **Don't talk over the translation** — let the phrase finish, then continue.
- Translation is **both ways** by default; the language is detected automatically.`,
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
Нет. Если собеседник далеко — позвоните ему, затем добавьте звонок на номер
переводчика и нажмите «Объединить» (Merge). Если вы рядом — включите громкую связь.
Подробнее в статье «Как идёт звонок».

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
No. If the other person is remote — call them, then add a call to the translator
number and tap "Merge". If you're together — use speakerphone. See "How a call works"
for details.

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
