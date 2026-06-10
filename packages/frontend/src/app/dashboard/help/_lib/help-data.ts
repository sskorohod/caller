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
// Written for a complete beginner. The PRIMARY flow is merging the translator
// into an ongoing phone call; speakerphone is the secondary flow.
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

Live Translator — это ваш личный переводчик для телефонных звонков.

Вы разговариваете по телефону с человеком, который говорит на другом языке, —
подключаете к звонку переводчика, и AI переводит разговор **голосом, в обе стороны,
в реальном времени**.

## Главное

- **Работает с любого телефона** — мобильного или городского. Приложение ставить не нужно.
- **Основной способ:** во время обычного звонка вы добавляете переводчика в разговор
  (кнопкой «Объединить» на телефоне) — и он переводит вас и собеседника.
- **Если собеседник рядом:** просто позвоните переводчику и включите громкую связь.
- **Оплата по факту** — только за минуты разговора, без подписки.

## Что где находится

- **Главная** — ваш номер переводчика, баланс, все настройки и живая расшифровка звонка.
- **Записи звонков** — история: расшифровка, краткое содержание, аудиозапись каждого звонка.
- **Баланс** — пополнение и история платежей.
- **Настройки** — ваше имя и ваши номера телефонов (по ним переводчик вас узнаёт).
- **Справка** — вы здесь :)

## Три шага, чтобы начать

1. В **Настройках** добавьте номер телефона, с которого будете звонить.
2. На **Главной** сохраните номер переводчика в контакты и выберите языки.
3. Пополните **Баланс** — и можно звонить.

Дальше в справке — всё по шагам.`,
          en: `# What is Live Translator

Live Translator is your personal interpreter for phone calls.

You're on the phone with someone who speaks another language — you add the
translator to the call, and the AI translates the conversation **by voice, both
ways, in real time**.

## The essentials

- **Works from any phone** — mobile or landline. No app to install.
- **The main way:** during a normal call you add the translator to the conversation
  (with the "Merge" button on your phone) — and it translates both of you.
- **If the other person is next to you:** just call the translator and turn on
  speakerphone.
- **Pay as you go** — only for minutes used, no subscription.

## What's where

- **Home** — your translator number, balance, all settings, and the live transcript.
- **Calls** — history: transcript, summary, and audio recording of every call.
- **Balance** — top-ups and payment history.
- **Settings** — your name and your phone numbers (that's how the translator
  recognizes you).
- **Help** — you're here :)

## Three steps to start

1. In **Settings**, add the phone number you'll be calling from.
2. On **Home**, save the translator number to your contacts and pick the languages.
3. Top up your **Balance** — and you're ready to call.

The rest of this help walks you through each step.`,
        },
      },
      {
        id: 'first-call',
        titleKey: 'help.art.firstCall',
        content: {
          ru: `# Ваш первый перевод

## Подготовка (один раз, 2 минуты)

1. **Настройки → Ваши номера.** Добавьте номер телефона, с которого будете звонить
   (в формате +1…). Именно по этому номеру переводчик узнаёт, что звоните вы, и
   применяет ваши языки и настройки.
2. **Главная → номер переводчика.** Сохраните его в контакты телефона — например,
   под именем «Переводчик».
3. **Главная → Языки перевода.** Слева «Мой язык» — на каком говорите вы. Справа
   «Язык собеседника» — на какой переводить. Сохраняется автоматически.
4. Проверьте, что на **Балансе** есть деньги.

## Звонок — основной способ (объединение звонков)

Так подключают переводчика к обычному телефонному разговору:

1. **Позвоните собеседнику** как обычно и дождитесь ответа.
2. Скажите: **«Подождите, я подключу переводчика»**.
3. На экране звонка нажмите **«Добавить звонок»** и наберите сохранённый номер
   переводчика.
4. Когда переводчик ответит, на экране появится кнопка **«Объединить» (Merge)** —
   нажмите её. Все три участника окажутся в одном разговоре.
5. Через пару секунд переводчик **представится на языке собеседника** — и начнёт
   переводить. Говорите по очереди.
6. Закончили — просто **завершите звонок** как обычно.

## Если собеседник рядом — громкая связь

Позвоните на номер переводчика, включите **громкую связь** и положите телефон между
вами. Переводчик слышит обоих и переводит всё, что слышит.

> Совет: говорите законченными фразами и делайте паузу 1–2 секунды после мысли —
> так перевод точнее и быстрее.

Во время звонка на **Главной** видна живая расшифровка. После звонка всё сохранится
в **«Записях звонков»**.`,
          en: `# Your first translation

## Set up (once, 2 minutes)

1. **Settings → Your numbers.** Add the phone number you'll call from (in +1…
   format). That number is how the translator recognizes you and applies your
   languages and settings.
2. **Home → translator number.** Save it to your phone contacts — e.g. as
   "Translator".
3. **Home → Languages.** On the left, "My language" — what you speak. On the right,
   "Other party's language" — what to translate into. Saved automatically.
4. Make sure your **Balance** has funds.

## The call — main way (merge calls)

This is how you add the translator to a normal phone conversation:

1. **Call the other person** as usual and wait for them to answer.
2. Say: **"Hold on, I'll connect my interpreter."**
3. On the call screen tap **"Add call"** and dial the saved translator number.
4. When the translator answers, a **"Merge"** button appears — tap it. All three
   of you are now in one conversation.
5. A couple of seconds later the interpreter **introduces itself in the other
   party's language** — and starts translating. Take turns speaking.
6. When you're done — just **hang up** as usual.

## If the other person is next to you — speakerphone

Call the translator number, turn on **speakerphone**, and put the phone between
you. The translator hears both of you and translates everything it hears.

> Tip: speak in complete phrases and pause 1–2 seconds after a thought — the
> translation comes out faster and more accurate.

During the call, the live transcript is on **Home**. Afterwards everything is
saved under **Calls**.`,
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

Переводчик подключается к разговору как третий участник: он слышит обоих и озвучивает
перевод. Подключить его можно двумя способами.

## Способ 1 — объединение звонков (основной)

Вы и собеседник в разных местах — обычный телефонный звонок:

1. **Позвоните собеседнику** и дождитесь ответа.
2. **Попросите подождать**: «Одну секунду, я подключу переводчика».
3. Нажмите **«Добавить звонок» (Add call)** и наберите номер переводчика из контактов.
4. Когда переводчик ответит, нажмите **«Объединить» / «Merge»** — кнопка появляется
   на экране звонка после добавления второго вызова.
5. Переводчик представится и начнёт переводить.

## Способ 2 — громкая связь (если вы рядом)

Вы и собеседник у одного телефона:

1. **Позвоните на номер переводчика** и включите **громкую связь**.
2. Положите телефон между вами.
3. Говорите по очереди — переводчик переводит всё, что слышит, определяя язык
   автоматически.

## Что говорит переводчик в начале

После подключения переводчик выдерживает небольшую паузу (по умолчанию 3 секунды)
и произносит **приветствие — всегда на языке собеседника**, на каком бы языке вы его
ни написали в настройках. Сразу после приветствия начинается перевод.

## Правила хорошего перевода

- **Говорите по очереди.** Закончили мысль — короткая пауза, AI переведёт и озвучит её.
- **Не перебивайте перевод** — дайте фразе доозвучиться.
- Язык говорящего определяется **автоматически** — специально переключать ничего не нужно.

## Два режима перевода

- **Двусторонний** (по умолчанию) — речь обоих переводится голосом, перевод слышат оба.
- **Односторонний** — ваша речь переводится голосом для собеседника, а его речь вы
  **читаете субтитрами** на Главной в реальном времени. Удобно, когда вы в офисе перед
  экраном, а голосовой перевод в вашу сторону не нужен.

Режим выбирается на **Главной**, в настройках.`,
          en: `# How a translated call works

The translator joins the conversation as a third participant: it hears both people
and voices the translation. There are two ways to add it.

## Option 1 — merge calls (the main way)

You and the other person are in different places — a normal phone call:

1. **Call the other person** and wait for them to answer.
2. **Ask them to hold**: "One second, I'll add my interpreter."
3. Tap **"Add call"** and dial the translator number from your contacts.
4. When the translator answers, tap **"Merge"** — the button appears on the call
   screen once you've added the second call.
5. The interpreter introduces itself and starts translating.

## Option 2 — speakerphone (when you're together)

You and the other person share one phone:

1. **Call the translator number** and turn on **speakerphone**.
2. Put the phone between you.
3. Take turns speaking — the translator translates everything it hears, detecting
   the language automatically.

## What the interpreter says first

After connecting, the interpreter waits briefly (3 seconds by default) and speaks
the **greeting — always in the other party's language**, no matter what language
you wrote it in. Translation starts right after the greeting.

## Rules for a good translation

- **Take turns.** Finish a thought, pause briefly — the AI translates and voices it.
- **Don't talk over the translation** — let the phrase finish.
- The speaker's language is detected **automatically** — nothing to switch.

## Two translation modes

- **Bidirectional** (default) — both sides are voice-translated; everyone hears it.
- **Unidirectional** — your speech is voice-translated for the other party, while
  their speech appears to you as **real-time captions** on Home. Handy when you're
  at a screen and don't need voice translation toward you.

Pick the mode on **Home**, in the settings panel.`,
        },
      },
      {
        id: 'languages-settings',
        titleKey: 'help.art.languagesSettings',
        content: {
          ru: `# Настройки переводчика

Все настройки находятся на **Главной**, в панели «Настройки». Каждое изменение
**сохраняется автоматически** (появляется галочка «Сохранено») и действует со
следующего звонка.

## Языки перевода

- **Мой язык** (слева) — на каком говорите вы.
- **Язык собеседника** (справа) — на какой переводить.

## Режим перевода

- **Двусторонний** — речь обоих переводится голосом, перевод слышат оба. Стандартный
  вариант для телефонного разговора.
- **Односторонний** — ваша речь переводится голосом для собеседника, а его речь вы
  читаете на экране субтитрами в реальном времени.

## Голос

Шесть голосов: кнопки с **голубой обводкой — мужские** (Rex, Sal, Leo), с **розовой —
женские** (Ara, Eve, Tara). Выбранный голос озвучивает перевод и приветствие.

## Тон

Стиль, в котором переводчик передаёт вашу речь:

- **Нейтральный** — естественный перевод как есть.
- **Деловой** — формально, без слов-паразитов.
- **Дружеский** — тепло и непринуждённо.
- **Медицинский / Юридический** — точная терминология для звонков врачу или юристу.
- **Интеллектуальный** — перефразирует речь, чтобы звучала красноречиво и вежливо.

## Приветствие

Фраза, которую переводчик произносит, подключившись к звонку.

- Пишите **на любом языке** — переводчик сам переведёт её и произнесёт **на языке
  собеседника**.
- Рядом настраивается **задержка** (по умолчанию 3 секунды) — через сколько секунд
  после подключения прозвучит приветствие. После него сразу начинается перевод.`,
          en: `# Translator settings

All settings live on **Home**, in the "Settings" panel. Every change **saves
automatically** (you'll see a "Saved" check) and applies from the next call.

## Languages

- **My language** (left) — what you speak.
- **Other party's language** (right) — what to translate into.

## Translation mode

- **Bidirectional** — both sides are voice-translated; everyone hears it. The
  standard option for a phone conversation.
- **Unidirectional** — your speech is voice-translated for the other party, while
  you read their speech as real-time captions on screen.

## Voice

Six voices: buttons with a **blue outline are male** (Rex, Sal, Leo), **pink are
female** (Ara, Eve, Tara). The selected voice speaks the translation and greeting.

## Tone

The style the interpreter uses for your speech:

- **Neutral** — natural translation as is.
- **Business** — formal, no filler words.
- **Friendly** — warm and casual.
- **Medical / Legal** — precise terminology for calls to a doctor or lawyer.
- **Intelligent** — rephrases your speech to sound eloquent and polite.

## Greeting

The phrase the interpreter says when it joins the call.

- Write it **in any language** — the interpreter translates it itself and speaks it
  **in the other party's language**.
- Next to it is the **delay** (3 seconds by default) — how long after connecting
  the greeting is spoken. Translation starts right after it.`,
        },
      },
      {
        id: 'live-and-history',
        titleKey: 'help.art.liveHistory',
        content: {
          ru: `# Живой перевод и записи звонков

## Во время звонка — Главная

Когда идёт звонок с переводчиком, на **Главной** в реальном времени появляется
расшифровка: что сказал каждый и как это переведено. Рядом со статусом линии есть
красная кнопка — **завершить звонок** из браузера, если нужно.

## После звонка — «Записи звонков»

Каждый разговор сохраняется автоматически. Открыв звонок, вы увидите:

- **заголовок и краткое содержание** — создаются автоматически через минуту после звонка;
- **полную расшифровку** — кто что сказал и перевод;
- **аудиозапись** — можно прослушать прямо на странице;
- дату, длительность и стоимость.

> Если звонок был совсем коротким и никто ничего не сказал — расшифровка и
> содержание будут пустыми, это нормально.`,
          en: `# Live translation & call history

## During the call — Home

While a translated call is in progress, **Home** shows a live transcript: what each
person said and the translation. Next to the line status there's a red button to
**end the call** from the browser if needed.

## After the call — "Calls"

Every conversation is saved automatically. Open a call to see:

- **a title and summary** — generated automatically within a minute after the call;
- **the full transcript** — who said what, with translations;
- **the audio recording** — playable right on the page;
- date, duration, and cost.

> If a call was very short and nothing was said, the transcript and summary will be
> empty — that's normal.`,
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
- За каждый звонок списывается стоимость минут разговора — **после завершения звонка**.
- Если баланс на нуле, звонок переводчику не подключится: вы услышите голосовое
  сообщение с просьбой пополнить баланс.

## Сколько стоит

Перевод стоит примерно **$0.20 за минуту** разговора. Точную ставку и остаток видно
на странице **«Баланс»**.

Баланс всегда виден в левом меню. Рядом — примерная оценка, на сколько минут перевода
хватит остатка.

> Когда баланс становится низким, появляется предупреждение и кнопка пополнить —
> чтобы звонок не прервался на середине.`,
          en: `# How balance & pricing work

Live Translator is **pay as you go** — no subscription, no monthly fee.

## How it works

- You top up your balance with any amount.
- Each call deducts the cost of the minutes used — **after the call ends**.
- If your balance is at zero, the translator won't join: you'll hear a voice
  message asking you to top up.

## What it costs

Translation costs about **$0.20 per minute** of conversation. The exact rate and
your remaining balance are on the **"Balance"** page.

Your balance is always visible in the left menu, with a rough estimate of how many
minutes it covers.

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

2. **Выберите сумму** — есть готовые варианты или введите свою.

3. Нажмите **«Оплатить»** — откроется защищённая страница оплаты **Stripe**.

4. Введите данные карты и подтвердите платёж.

Баланс пополнится **сразу** после оплаты, и можно звонить.

## Полезно знать

- Оплата проходит через Stripe — мы не храним данные вашей карты.
- Все пополнения и списания видны в истории на странице «Баланс».
- Деньги не сгорают — остаток сохраняется до использования.`,
          en: `# How to top up your balance

1. Open the **"Balance"** page (or tap **"Top up"** next to the balance in the menu).

2. **Choose an amount** — preset options or enter your own.

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

  // ─── 4. Settings ──────────────────────────────────────────────────
  {
    id: 'settings',
    titleKey: 'help.cat.settings',
    icon: 'settings',
    articles: [
      {
        id: 'account',
        titleKey: 'help.art.account',
        content: {
          ru: `# Настройки аккаунта

Раздел **«Настройки»** — это про ваш аккаунт (настройки самого переводчика — на
Главной).

## Ваши номера телефонов — самое важное

Добавьте сюда **все номера, с которых вы звоните переводчику** (в формате +1…).
Именно по номеру входящего звонка система понимает, что это вы, и применяет ваши
языки, голос и настройки.

> Переводчик не отвечает или говорит не на тех языках? Первым делом проверьте, что
> номер, с которого вы звоните, добавлен здесь.

## Остальное

- **Имя** — как к вам обращаться.
- **Внешний вид** — светлая или тёмная тема.
- **Язык интерфейса** — переключатель RU / EN в левом меню.

Язык интерфейса и языки перевода — разные вещи: первый меняет надписи в панели,
вторые настраиваются на Главной.`,
          en: `# Account settings

The **"Settings"** section is about your account (the translator's own settings
live on Home).

## Your phone numbers — the important part

Add **every number you call the translator from** (in +1… format). The system
recognizes you by the incoming number and applies your languages, voice, and
settings.

> Translator doesn't answer or uses the wrong languages? First check that the
> number you're calling from is added here.

## The rest

- **Name** — how to address you.
- **Appearance** — light or dark theme.
- **Interface language** — the RU / EN toggle in the left menu.

The interface language and the translation languages are different things: the
first changes the panel labels, the second is configured on Home.`,
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
Главное — добавить свой номер в **Настройках**, чтобы переводчик вас узнал.

**Нужно ли обоим быть рядом?**
Нет. Основной сценарий — собеседник далеко: позвоните ему, добавьте звонок на номер
переводчика и нажмите **«Объединить» (Merge)**. Если вы рядом — позвоните переводчику
и включите громкую связь.

**Переводчик не отвечает или путает языки. Что проверить?**
1) Ваш номер добавлен в Настройках (формат +1…). 2) На балансе есть деньги.
3) Языки на Главной выбраны правильно.

**Какие языки поддерживаются?**
Английский, русский, испанский, немецкий, французский, китайский, японский, корейский,
арабский, португальский, итальянский, хинди и другие. Полный список — в выборе языков.

**Можно ли читать перевод, а не слушать?**
Да — включите **односторонний режим** на Главной: ваша речь переводится голосом для
собеседника, а его речь вы читаете субтитрами в реальном времени.

**Перевод робот или живой голос?**
Премиальные AI-голоса — звучит естественно. Голос можно выбрать (мужские и женские).

**Не слышно перевода / тишина в начале.**
Переводчик представляется через несколько секунд после подключения — подождите.
Говорите законченными фразами и делайте паузу: перевод начинается после паузы.
На громкой связи проверьте, что микрофон не перекрыт.

**Что будет, если кончится баланс?**
При нулевом балансе новый звонок не подключится — вы услышите голосовую просьбу
пополнить. Заранее появляется предупреждение в панели.

**Это конфиденциально?**
Расшифровки и записи доступны только в вашем аккаунте.

Остались вопросы — напишите в поддержку (кнопка на этой странице).`,
          en: `# Frequently asked questions

**What phone can I call from?**
Any phone — mobile or landline, any carrier. No apps needed. Just make sure your
number is added in **Settings** so the translator recognizes you.

**Do both people need to be together?**
No. The main scenario is a remote call: call the other person, add a call to the
translator number, and tap **"Merge"**. If you're together — call the translator
and use speakerphone.

**The translator doesn't answer or mixes up languages. What do I check?**
1) Your number is added in Settings (+1… format). 2) Your balance isn't empty.
3) The languages on Home are set correctly.

**Which languages are supported?**
English, Russian, Spanish, German, French, Chinese, Japanese, Korean, Arabic,
Portuguese, Italian, Hindi, and more. The full list is in the language picker.

**Can I read the translation instead of hearing it?**
Yes — turn on **unidirectional mode** on Home: your speech is voice-translated for
the other party, and you read their speech as real-time captions.

**Is it a robotic or a natural voice?**
Premium AI voices — it sounds natural. You can pick the voice (male and female).

**No translation / silence at the start.**
The interpreter introduces itself a few seconds after connecting — give it a moment.
Speak in complete phrases and pause: translation starts after a pause. On
speakerphone, check the mic isn't blocked.

**What happens if my balance runs out?**
At zero balance a new call won't connect — you'll hear a voice prompt to top up.
A warning appears in the panel beforehand.

**Is it private?**
Transcripts and recordings are only available in your account.

Still have questions? Message support (button on this page).`,
        },
      },
    ],
  },
];
