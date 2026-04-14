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

export const HELP_CATEGORIES: HelpCategory[] = [
  // ─── 1. Начало работы ─────────────────────────────────────────────
  {
    id: 'getting-started',
    titleKey: 'help.cat.gettingStarted',
    icon: 'rocket_launch',
    articles: [
      {
        id: 'what-is-caller',
        titleKey: 'help.art.whatIsCaller',
        content: {
          ru: `# Что такое Caller

Caller — это платформа для создания AI-телефонных агентов и живого перевода звонков.

## Что можно делать с Caller

- **AI Phone Agents** — создавайте виртуальных телефонных агентов, которые автоматически отвечают на входящие звонки и совершают исходящие. Агенты понимают речь, отвечают человеческим голосом и выполняют задачи.

- **Живой переводчик** — подключайте переводчика к любому телефонному звонку. Система переводит речь собеседника в реальном времени и озвучивает перевод.

- **Миссии** — опишите задачу в чате с AI, и система спланирует и выполнит звонок: от формулировки цели до получения результата.

- **Интеграции** — подключайте Caller к вашим системам через MCP Server, API, вебхуки и OAuth.

## Для кого Caller

- Бизнесы, которым нужна автоматизация телефонных коммуникаций
- Компании с международными клиентами (живой перевод)
- Разработчики, интегрирующие телефонию в свои продукты (MCP/API)`,
          en: `# What is Caller

Caller is a platform for creating AI phone agents and live call translation.

## What you can do with Caller

- **AI Phone Agents** — create virtual phone agents that automatically answer inbound calls and make outbound ones. Agents understand speech, respond with human-like voice, and complete tasks.

- **Live Translator** — connect a translator to any phone call. The system translates your counterpart's speech in real time and voices the translation.

- **Missions** — describe a task in a chat with AI, and the system will plan and execute the call: from goal formulation to getting the result.

- **Integrations** — connect Caller to your systems via MCP Server, API, webhooks, and OAuth.

## Who is Caller for

- Businesses that need phone communication automation
- Companies with international clients (live translation)
- Developers integrating telephony into their products (MCP/API)`,
        },
      },
      {
        id: 'registration',
        titleKey: 'help.art.registration',
        content: {
          ru: `# Регистрация и первые шаги

## Создание аккаунта

1. Откройте сайт Caller и нажмите **Sign Up**
2. Введите ваш email и придумайте пароль
3. Подтвердите email по ссылке из письма
4. Вы попадёте на страницу выбора тарифа

## Выбор тарифа при регистрации

На странице онбординга вам будут предложены 3 тарифа:

- **Translator** — живой переводчик, кредит при регистрации
- **Agents** — AI-агенты + всё из Translator, бесплатный пробный период
- **Agents + MCP** — всё из Agents + API-доступ, бесплатный пробный период

Для планов Agents и Agents + MCP пробный период активируется без ввода данных карты.

## Первые шаги после регистрации

### Для плана Translator
Переводчик работает из коробки — все провайдеры (Twilio, xAI, Deepgram) предоставляются платформой. Вам нужно только:
1. **Пополните депозит** — в разделе Billing
2. **Настройте языки** — в разделе Translator выберите пару языков
3. **Звоните** — позвоните на номер переводчика

### Для планов Agents / Agents + MCP
1. **Настройте провайдеров** — перейдите в Settings → Provider Credentials и подключите **свои** ключи (Twilio, Anthropic, OpenAI и т.д.)
2. **Создайте агента** — перейдите в Agents → New Agent
3. **Подключите номер** — в Settings → Provider Credentials добавьте Twilio, затем активируйте номер

> **Важно:** На планах Agents и Agents + MCP вы используете собственные API-ключи для всех провайдеров. Переводчик — единственная функция, работающая на платформенных ключах для всех планов.`,
          en: `# Registration and first steps

## Creating an account

1. Open the Caller website and click **Sign Up**
2. Enter your email and create a password
3. Confirm your email via the link in the message
4. You'll be taken to the plan selection page

## Choosing a plan during registration

On the onboarding page you'll see 3 plans:

- **Translator** — live translator, credit on signup
- **Agents** — AI agents + everything in Translator, free trial
- **Agents + MCP** — everything in Agents + API access, free trial

For Agents and Agents + MCP plans, the trial activates without entering card details.

## First steps after registration

### For the Translator plan
The translator works out of the box — all providers (Twilio, xAI, Deepgram) are supplied by the platform. You only need to:
1. **Top up deposit** — in the Billing section
2. **Configure languages** — in the Translator section choose your language pair
3. **Call** — dial the translator number

### For Agents / Agents + MCP plans
1. **Set up providers** — go to Settings → Provider Credentials and connect **your own** keys (Twilio, Anthropic, OpenAI, etc.)
2. **Create an agent** — go to Agents → New Agent
3. **Connect a phone number** — in Settings → Provider Credentials add Twilio, then activate a number

> **Important:** On Agents and Agents + MCP plans, you use your own API keys for all providers. The translator is the only feature that works on platform keys for all plans.`,
        },
      },
      {
        id: 'choosing-plan',
        titleKey: 'help.art.choosingPlan',
        content: {
          ru: `# Выбор тарифа

## Сравнение планов

### Translator
Подходит, если вам нужен только живой перевод звонков. Вы получаете:
- Живой переводчик (merge к звонку)
- 10+ языковых пар
- Текстовый перевод в реальном времени
- Telegram-уведомления
- Кредит при регистрации
- **Все провайдеры предоставляются платформой** — работает из коробки
- Диалер (исходящие звонки) доступен только если администратор расшарил Twilio

Оплата: pay-as-you-go из депозита за использование провайдеров платформы.

### Agents
Подходит для бизнесов, которым нужны AI-телефонные агенты. Включает:
- Живой переводчик (на платформенных ключах)
- До 10 AI-агентов
- До 5 телефонных номеров
- Входящие и исходящие звонки
- Запись и транскрипция
- База знаний, промпты, скиллы
- Миссии и рабочие процессы
- **Требуются собственные API-ключи** для всех провайдеров (кроме переводчика)

### Agents + MCP
Подходит для разработчиков и компаний с потребностью в API. Включает:
- Всё из плана Agents
- MCP Server API-доступ
- Неограниченное количество агентов и номеров
- OAuth 2.0 интеграция
- Вебхуки и коннекторы
- Приоритетная поддержка

## Как сменить тариф

Перейдите в раздел **Billing** в дашборде. Там вы увидите текущий план и сможете переключиться на другой.`,
          en: `# Choosing a plan

## Plan comparison

### Translator
Suitable if you only need live call translation. You get:
- Live translator (merge to call)
- 10+ language pairs
- Real-time text translation
- Telegram notifications
- Credit on signup
- **All providers supplied by the platform** — works out of the box
- Dialer (outbound calls) available only if admin shares Twilio access

Payment: pay-as-you-go from deposit for platform provider usage.

### Agents
Suitable for businesses that need AI phone agents. Includes:
- Live translator (on platform keys)
- Up to 10 AI agents
- Up to 5 phone numbers
- Inbound & outbound calls
- Recording & transcription
- Knowledge base, prompts, skills
- Missions & workflows
- **Own API keys required** for all providers (except translator)

### Agents + MCP
Suitable for developers and companies needing API access. Includes:
- Everything in Agents plan
- MCP Server API access
- Unlimited agents and phone numbers
- OAuth 2.0 integration
- Webhooks & connectors
- Priority support

## How to change plan

Go to the **Billing** section in the dashboard. There you'll see your current plan and can switch to another.`,
        },
      },
      {
        id: 'trial-period',
        titleKey: 'help.art.trialPeriod',
        content: {
          ru: `# Пробный период

## Как работает пробный период

Планы **Agents** и **Agents + MCP** предоставляют 15-дневный бесплатный пробный период.

### Активация
- Выберите план при регистрации или в разделе Billing
- Пробный период активируется мгновенно
- **Карта не требуется** — данные карты нужны только при оформлении подписки после пробного периода

### Во время пробного периода
- Вам доступны все функции выбранного плана
- В дашборде отображается оставшееся количество дней
- За 3 дня до окончания баннер становится красным

### После окончания
- Ваш план автоматически переключается на Translator (бесплатный)
- AI-агенты и связанные функции становятся недоступны
- Ваши данные (агенты, настройки, история) сохраняются
- Чтобы продолжить использование, оформите подписку через Stripe

### Отмена пробного периода
- Вы можете отменить пробный период в любой момент в разделе Billing
- При отмене план переключается на Translator немедленно

> **Примечание:** Пробный период доступен только один раз для каждого рабочего пространства.`,
          en: `# Trial period

## How the trial works

**Agents** and **Agents + MCP** plans offer a 15-day free trial.

### Activation
- Choose a plan during registration or in the Billing section
- The trial activates instantly
- **No credit card required** — card details are only needed when subscribing after the trial

### During the trial
- You have access to all features of the selected plan
- The dashboard shows the remaining number of days
- 3 days before expiration, the banner turns red

### After expiration
- Your plan automatically switches to Translator (free)
- AI agents and related features become unavailable
- Your data (agents, settings, history) is preserved
- To continue using, subscribe via Stripe

### Canceling the trial
- You can cancel the trial at any time in the Billing section
- Upon cancellation, the plan switches to Translator immediately

> **Note:** The trial is available only once per workspace.`,
        },
      },
    ],
  },

  // ─── 2. Тарифы и оплата ──────────────────────────────────────────
  {
    id: 'billing',
    titleKey: 'help.cat.billing',
    icon: 'payments',
    articles: [
      {
        id: 'how-deposit-works',
        titleKey: 'help.art.howDepositWorks',
        content: {
          ru: `# Как работает депозит

## Модель оплаты

Caller работает по модели предоплаченного депозита. Вы пополняете баланс, и стоимость использования провайдеров платформы списывается автоматически.

## Пополнение

1. Перейдите в раздел **Billing** в дашборде
2. В секции «Deposit» выберите сумму (от $1) или введите свою
3. Нажмите **Top Up** — откроется страница оплаты Stripe
4. Оплатите картой — средства зачислятся на баланс моментально

## Списание

Когда вы используете провайдеров платформы (STT, LLM, TTS, телефония), стоимость использования списывается из вашего баланса.

**Что списывается:**
- Распознавание речи (STT) — Deepgram, OpenAI Whisper
- Генерация ответов (LLM) — Claude, GPT, Grok
- Синтез речи (TTS) — ElevenLabs, OpenAI TTS
- Телефония — Twilio (звонки, минуты)

## Когда баланс заканчивается

- Звонки через провайдеров платформы приостанавливаются
- Функции, работающие через ваши собственные ключи, продолжают работать
- Вы получите уведомление о низком балансе

## Бонус при регистрации

При регистрации на план Translator вы получаете **бесплатный кредит** для тестирования платформы.

## История транзакций

В разделе Billing вы можете просмотреть историю всех транзакций:
- Тип (пополнение, использование, возврат, промо, бонус)
- Сумма
- Баланс после операции
- Описание и дата`,
          en: `# How the deposit works

## Payment model

Caller works on a prepaid deposit model. You top up your balance, and platform provider usage costs are deducted automatically.

## Topping up

1. Go to the **Billing** section in the dashboard
2. In the "Deposit" section, choose an amount (from $1) or enter your own
3. Click **Top Up** — a Stripe payment page will open
4. Pay by card — funds are credited to your balance instantly

## Deductions

When you use platform providers (STT, LLM, TTS, telephony), usage costs are deducted from your balance.

**What's charged:**
- Speech recognition (STT) — Deepgram, OpenAI Whisper
- Response generation (LLM) — Claude, GPT, Grok
- Speech synthesis (TTS) — ElevenLabs, OpenAI TTS
- Telephony — Twilio (calls, minutes)

## When balance runs out

- Calls via platform providers are paused
- Features using your own keys continue working
- You'll receive a low balance notification

## Signup bonus

When registering for the Translator plan, you receive **free credit** to test the platform.

## Transaction history

In the Billing section you can view all transaction history:
- Type (top-up, usage, refund, promo, bonus)
- Amount
- Balance after operation
- Description and date`,
        },
      },
      {
        id: 'own-keys-vs-platform',
        titleKey: 'help.art.ownKeysVsPlatform',
        content: {
          ru: `# Свои ключи vs Платформа

## Зависит от вашего плана

### План Translator
На плане Translator **все провайдеры предоставляются платформой** автоматически. Вам не нужно подключать свои ключи — всё работает из коробки. Стоимость использования списывается из вашего депозита.

### Планы Agents / Agents + MCP
На этих планах вам **необходимо подключить собственные API-ключи** для всех провайдеров (Twilio, Anthropic, OpenAI, Deepgram, ElevenLabs, xAI). Единственное исключение — **живой переводчик**, который работает на ключах платформы для всех планов.

## Два режима использования провайдеров (Agents / Agents + MCP)

### Свои ключи (Own)
- Вы подключаете **собственные API-ключи** провайдера
- Плата за этот провайдер **не взимается** со стороны Caller
- Вы платите провайдеру напрямую по его тарифам

### Платформа (Platform)
- Используется только для **живого переводчика** — на всех планах
- Стоимость переводчика **списывается из вашего депозита**

## Как подключить ключи

1. Перейдите в **Settings → Provider Credentials**
2. Для каждого провайдера введите свои ключи
3. Нажмите **Save**

## Диалер на плане Translator

По умолчанию на плане Translator диалер (исходящие звонки из браузера) недоступен. Чтобы он заработал, администратор платформы должен расшарить Twilio-доступ для вашего рабочего пространства.`,
          en: `# Own keys vs Platform

## Depends on your plan

### Translator plan
On the Translator plan, **all providers are supplied by the platform** automatically. You don't need to connect your own keys — everything works out of the box. Usage costs are deducted from your deposit.

### Agents / Agents + MCP plans
On these plans, you **must connect your own API keys** for all providers (Twilio, Anthropic, OpenAI, Deepgram, ElevenLabs, xAI). The only exception is the **live translator**, which runs on platform keys for all plans.

## Two provider usage modes (Agents / Agents + MCP)

### Own Keys
- You connect your **own API keys** for the provider
- **No charges** from Caller for this provider
- You pay the provider directly at their rates

### Platform
- Used only for the **live translator** — on all plans
- Translator costs are **deducted from your deposit**

## How to connect keys

1. Go to **Settings → Provider Credentials**
2. For each provider, enter your keys
3. Click **Save**

## Dialer on the Translator plan

By default, the dialer (outbound calls from the browser) is not available on the Translator plan. For it to work, the platform admin must share Twilio access to your workspace.`,
        },
      },
      {
        id: 'managing-subscription',
        titleKey: 'help.art.managingSubscription',
        content: {
          ru: `# Управление подпиской

## Просмотр текущего плана

Перейдите в раздел **Billing** в дашборде. В верхней части вы увидите:
- Название текущего плана
- Статус подписки (активна, пробный период, отменена)
- Дату следующего списания или окончания пробного периода
- Текущий баланс депозита

## Оформление подписки

1. В разделе Billing найдите блок сравнения планов
2. Нажмите **Subscribe** на нужном плане
3. Вы перейдёте на страницу оплаты Stripe
4. Введите данные карты и подтвердите

Подписка обновляется автоматически каждый месяц.

## Отмена подписки

1. В разделе Billing прокрутите до секции «Subscription Management»
2. Нажмите **Cancel Subscription**
3. Подтвердите отмену

При отмене:
- Подписка действует до конца оплаченного периода
- После этого план переключается на Translator
- Ваши данные сохраняются

## Управление через Stripe

Нажмите **Manage in Stripe** для доступа к порталу Stripe, где можно:
- Обновить данные карты
- Просмотреть историю платежей
- Скачать счета`,
          en: `# Managing subscription

## Viewing current plan

Go to the **Billing** section in the dashboard. At the top you'll see:
- Current plan name
- Subscription status (active, trial, canceled)
- Next billing date or trial end date
- Current deposit balance

## Subscribing

1. In the Billing section, find the plan comparison block
2. Click **Subscribe** on the desired plan
3. You'll be redirected to the Stripe payment page
4. Enter card details and confirm

The subscription renews automatically each month.

## Canceling subscription

1. In the Billing section, scroll to the "Subscription Management" section
2. Click **Cancel Subscription**
3. Confirm cancellation

Upon cancellation:
- The subscription remains active until the end of the paid period
- After that, the plan switches to Translator
- Your data is preserved

## Managing via Stripe

Click **Manage in Stripe** to access the Stripe portal where you can:
- Update card details
- View payment history
- Download invoices`,
        },
      },
    ],
  },

  // ─── 3. Настройка провайдеров ──────────────────────────────────────
  {
    id: 'providers',
    titleKey: 'help.cat.providers',
    icon: 'settings',
    articles: [
      {
        id: 'setup-twilio',
        titleKey: 'help.art.setupTwilio',
        content: {
          ru: `# Настройка Twilio

Twilio — провайдер телефонии. Нужен для совершения и приёма звонков.

> **Для плана Translator:** Twilio предоставляется платформой автоматически. Вам не нужно настраивать свой Twilio — переводчик работает из коробки. Диалер (исходящие звонки) доступен только если администратор расшарил Twilio для вашего рабочего пространства.

## Зачем нужен Twilio (для планов Agents / Agents + MCP)

- Совершение исходящих звонков AI-агентами
- Приём входящих звонков
- Работа диалера
- Собственные телефонные номера

## Как получить ключи

1. Зарегистрируйтесь на [console.twilio.com](https://console.twilio.com)
2. На главной странице консоли найдите:
   - **Account SID** — идентификатор аккаунта (начинается с AC...)
   - **Auth Token** — секретный токен
3. Скопируйте оба значения

## Как подключить в Caller

1. Перейдите в **Settings → Provider Credentials**
2. Найдите секцию **Twilio**
3. Вставьте **Account SID** и **Auth Token**
4. Нажмите **Save**
5. Система автоматически проверит ключи и загрузит список ваших номеров

## Покупка телефонного номера

Если у вас ещё нет номера в Twilio:
1. В консоли Twilio перейдите в **Phone Numbers → Buy a Number**
2. Выберите страну и тип номера
3. Купите номер
4. Номер появится в Caller автоматически после сохранения ключей

## Активация номера в Caller

1. Перейдите в **Settings → Provider Credentials → Twilio**
2. После сохранения ключей вы увидите список доступных номеров
3. Или перейдите в раздел телефонных подключений для настройки входящих/исходящих

> **Важно:** При использовании собственных ключей Twilio вы платите Twilio напрямую. Caller не взимает дополнительную плату.`,
          en: `# Setting up Twilio

Twilio is a telephony provider. Required for making and receiving calls.

> **For the Translator plan:** Twilio is provided by the platform automatically. You don't need to set up your own Twilio — the translator works out of the box. The dialer (outbound calls) is only available if the admin shares Twilio access to your workspace.

## Why you need Twilio (for Agents / Agents + MCP plans)

- Making outbound calls with AI agents
- Receiving inbound calls
- Dialer functionality
- Your own phone numbers

## How to get keys

1. Register at [console.twilio.com](https://console.twilio.com)
2. On the console main page, find:
   - **Account SID** — account identifier (starts with AC...)
   - **Auth Token** — secret token
3. Copy both values

## How to connect in Caller

1. Go to **Settings → Provider Credentials**
2. Find the **Twilio** section
3. Paste **Account SID** and **Auth Token**
4. Click **Save**
5. The system will automatically verify the keys and load your phone numbers list

## Buying a phone number

If you don't have a Twilio number yet:
1. In the Twilio console, go to **Phone Numbers → Buy a Number**
2. Choose country and number type
3. Purchase the number
4. The number will appear in Caller automatically after saving keys

## Activating a number in Caller

1. Go to **Settings → Provider Credentials → Twilio**
2. After saving keys, you'll see a list of available numbers
3. Or go to the telephony connections section to configure inbound/outbound

> **Important:** When using your own Twilio keys, you pay Twilio directly. Caller does not charge extra.`,
        },
      },
      {
        id: 'setup-anthropic',
        titleKey: 'help.art.setupAnthropic',
        content: {
          ru: `# Настройка Anthropic

Anthropic — провайдер LLM (языковой модели). Используется для генерации ответов AI-агентов.

## Зачем нужен

- Генерация ответов AI-агентов (Claude Sonnet, Claude Opus, Claude Haiku)
- Анализ звонков (резюме, извлечение фактов)
- AI-рекомендации (скилл-паки, форматирование знаний)

## Как получить ключ

1. Зарегистрируйтесь на [console.anthropic.com](https://console.anthropic.com)
2. Перейдите в **API Keys**
3. Нажмите **Create Key**
4. Скопируйте ключ (он начинается с \`sk-ant-...\`)

> **Важно:** Ключ показывается только один раз. Сохраните его в надёжном месте.

## Как подключить в Caller

1. Перейдите в **Settings → Provider Credentials**
2. Найдите секцию **Anthropic**
3. Вставьте ваш API Key
4. Нажмите **Save**

## Нужен ли мне ключ Anthropic?

- **План Translator** — нет, платформа предоставит ключ автоматически. Стоимость списывается из депозита.
- **Планы Agents / Agents + MCP** — да, необходимо подключить собственный ключ Anthropic для работы AI-агентов.

## Доступные модели

При использовании Anthropic в Caller доступны:
- **Claude Sonnet 4.6** — основная модель, баланс скорости и качества
- **Claude Opus 4.6** — самая мощная модель для сложных задач
- **Claude Haiku 4.5** — быстрая и экономичная модель`,
          en: `# Setting up Anthropic

Anthropic is an LLM (language model) provider. Used for generating AI agent responses.

## Why you need it

- AI agent response generation (Claude Sonnet, Claude Opus, Claude Haiku)
- Call analysis (summaries, fact extraction)
- AI recommendations (skill packs, knowledge formatting)

## How to get a key

1. Register at [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys**
3. Click **Create Key**
4. Copy the key (it starts with \`sk-ant-...\`)

> **Important:** The key is shown only once. Save it in a secure place.

## How to connect in Caller

1. Go to **Settings → Provider Credentials**
2. Find the **Anthropic** section
3. Paste your API Key
4. Click **Save**

## Do I need an Anthropic key?

- **Translator plan** — no, the platform provides the key automatically. Costs are deducted from your deposit.
- **Agents / Agents + MCP plans** — yes, you must connect your own Anthropic key for AI agents to work.

## Available models

When using Anthropic in Caller:
- **Claude Sonnet 4.6** — main model, balance of speed and quality
- **Claude Opus 4.6** — most powerful model for complex tasks
- **Claude Haiku 4.5** — fast and economical model`,
        },
      },
      {
        id: 'setup-openai',
        titleKey: 'help.art.setupOpenai',
        content: {
          ru: `# Настройка OpenAI

OpenAI — провайдер LLM и TTS/STT. Используется для генерации ответов, синтеза и распознавания речи.

## Зачем нужен

- Генерация ответов AI-агентов (GPT-4.1, GPT-4o и др.)
- Синтез речи (OpenAI TTS)
- Распознавание речи (Whisper) — как резервный STT

## Как получить ключ

1. Зарегистрируйтесь на [platform.openai.com](https://platform.openai.com)
2. Перейдите в **API Keys** (левое меню)
3. Нажмите **Create new secret key**
4. Задайте имя и скопируйте ключ (начинается с \`sk-...\`)

> **Важно:** Ключ показывается только один раз.

## Как подключить в Caller

1. Перейдите в **Settings → Provider Credentials**
2. Найдите секцию **OpenAI**
3. Вставьте ваш API Key
4. Нажмите **Save**

## Доступные модели

**LLM:**
- GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano
- o3, o4-mini
- GPT-4o, GPT-4o Mini

**TTS (синтез речи):**
- OpenAI TTS — несколько встроенных голосов

**STT (распознавание речи):**
- Whisper — как альтернатива Deepgram`,
          en: `# Setting up OpenAI

OpenAI is an LLM and TTS/STT provider. Used for response generation, speech synthesis, and recognition.

## Why you need it

- AI agent response generation (GPT-4.1, GPT-4o, etc.)
- Speech synthesis (OpenAI TTS)
- Speech recognition (Whisper) — as backup STT

## How to get a key

1. Register at [platform.openai.com](https://platform.openai.com)
2. Go to **API Keys** (left menu)
3. Click **Create new secret key**
4. Set a name and copy the key (starts with \`sk-...\`)

> **Important:** The key is shown only once.

## How to connect in Caller

1. Go to **Settings → Provider Credentials**
2. Find the **OpenAI** section
3. Paste your API Key
4. Click **Save**

## Available models

**LLM:**
- GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano
- o3, o4-mini
- GPT-4o, GPT-4o Mini

**TTS (speech synthesis):**
- OpenAI TTS — several built-in voices

**STT (speech recognition):**
- Whisper — as an alternative to Deepgram`,
        },
      },
      {
        id: 'setup-deepgram',
        titleKey: 'help.art.setupDeepgram',
        content: {
          ru: `# Настройка Deepgram

Deepgram — основной провайдер STT (распознавания речи). Модель Nova-2 обеспечивает высокую точность и низкую задержку.

## Зачем нужен

- Распознавание речи собеседника в реальном времени
- Транскрипция звонков
- Работа живого переводчика (распознавание для перевода)

## Как получить ключ

1. Зарегистрируйтесь на [console.deepgram.com](https://console.deepgram.com)
2. Перейдите в **API Keys**
3. Нажмите **Create a New API Key**
4. Задайте имя, выберите разрешения (Member или Admin)
5. Скопируйте ключ

## Как подключить в Caller

1. Перейдите в **Settings → Provider Credentials**
2. Найдите секцию **Deepgram**
3. Вставьте ваш API Key
4. Нажмите **Save**

## Нужен ли мне ключ Deepgram?

- **План Translator** — нет, платформа предоставит ключ автоматически.
- **Планы Agents / Agents + MCP** — да, необходимо подключить собственный ключ Deepgram для распознавания речи AI-агентами.`,
          en: `# Setting up Deepgram

Deepgram is the primary STT (speech recognition) provider. The Nova-2 model provides high accuracy and low latency.

## Why you need it

- Real-time speech recognition of the caller
- Call transcription
- Live translator operation (recognition for translation)

## How to get a key

1. Register at [console.deepgram.com](https://console.deepgram.com)
2. Go to **API Keys**
3. Click **Create a New API Key**
4. Set a name, choose permissions (Member or Admin)
5. Copy the key

## How to connect in Caller

1. Go to **Settings → Provider Credentials**
2. Find the **Deepgram** section
3. Paste your API Key
4. Click **Save**

## Do I need a Deepgram key?

- **Translator plan** — no, the platform provides the key automatically.
- **Agents / Agents + MCP plans** — yes, you must connect your own Deepgram key for AI agent speech recognition.`,
        },
      },
      {
        id: 'setup-elevenlabs',
        titleKey: 'help.art.setupElevenlabs',
        content: {
          ru: `# Настройка ElevenLabs

ElevenLabs — основной провайдер TTS (синтеза речи). Обеспечивает реалистичные голоса для AI-агентов и переводчика.

## Зачем нужен

- Синтез речи AI-агентов (голосовые ответы)
- Озвучивание перевода в живом переводчике
- Выбор из множества голосов

## Как получить ключ

1. Зарегистрируйтесь на [elevenlabs.io](https://elevenlabs.io)
2. Нажмите на иконку профиля → **Profile + API key**
3. Скопируйте ваш **API Key**

## Как подключить в Caller

1. Перейдите в **Settings → Provider Credentials**
2. Найдите секцию **ElevenLabs**
3. Вставьте ваш API Key
4. Нажмите **Save**

## Популярные голоса ElevenLabs

При создании агента или настройке переводчика вы можете выбрать голос:
- **Sarah** — женский, нейтральный
- **Rachel** — женский, тёплый
- **Adam** — мужской, нейтральный
- **Domi** — женский, уверенный
- И другие из библиотеки ElevenLabs`,
          en: `# Setting up ElevenLabs

ElevenLabs is the primary TTS (speech synthesis) provider. Provides realistic voices for AI agents and translator.

## Why you need it

- AI agent speech synthesis (voice responses)
- Translation voicing in live translator
- Choice of many voices

## How to get a key

1. Register at [elevenlabs.io](https://elevenlabs.io)
2. Click the profile icon → **Profile + API key**
3. Copy your **API Key**

## How to connect in Caller

1. Go to **Settings → Provider Credentials**
2. Find the **ElevenLabs** section
3. Paste your API Key
4. Click **Save**

## Popular ElevenLabs voices

When creating an agent or setting up the translator, you can choose a voice:
- **Sarah** — female, neutral
- **Rachel** — female, warm
- **Adam** — male, neutral
- **Domi** — female, confident
- And others from the ElevenLabs library`,
        },
      },
      {
        id: 'setup-xai',
        titleKey: 'help.art.setupXai',
        content: {
          ru: `# Настройка xAI

xAI — провайдер LLM (языковой модели Grok). Альтернатива Anthropic и OpenAI.

## Зачем нужен

- Генерация ответов AI-агентов (Grok 3, Grok 3 Mini)
- Перевод текста (используется как быстрый переводчик)

## Как получить ключ

1. Зарегистрируйтесь на [console.x.ai](https://console.x.ai)
2. Перейдите в раздел **API Keys**
3. Создайте новый ключ
4. Скопируйте ключ

## Как подключить в Caller

1. Перейдите в **Settings → Provider Credentials**
2. Найдите секцию **xAI**
3. Вставьте ваш API Key
4. Нажмите **Save**

## Доступные модели

- **Grok 3** — мощная модель для сложных задач
- **Grok 3 Mini Fast** — быстрая и экономичная модель`,
          en: `# Setting up xAI

xAI is an LLM provider (Grok language model). An alternative to Anthropic and OpenAI.

## Why you need it

- AI agent response generation (Grok 3, Grok 3 Mini)
- Text translation (used as a fast translator)

## How to get a key

1. Register at [console.x.ai](https://console.x.ai)
2. Go to the **API Keys** section
3. Create a new key
4. Copy the key

## How to connect in Caller

1. Go to **Settings → Provider Credentials**
2. Find the **xAI** section
3. Paste your API Key
4. Click **Save**

## Available models

- **Grok 3** — powerful model for complex tasks
- **Grok 3 Mini Fast** — fast and economical model`,
        },
      },
      {
        id: 'setup-telegram',
        titleKey: 'help.art.setupTelegram',
        content: {
          ru: `# Настройка Telegram-бота

Telegram-бот используется для уведомлений о звонках и событиях.

## Зачем нужен

- Уведомления о новых звонках
- Ссылки на мониторинг звонков в реальном времени
- Оперативная информация о событиях в рабочем пространстве

## Как создать бота

1. Откройте Telegram и найдите **@BotFather**
2. Отправьте команду \`/newbot\`
3. Введите имя бота (например, «My Caller Bot»)
4. Введите username бота (например, \`my_caller_bot\`)
5. BotFather выдаст вам **Bot Token** — длинную строку вида \`123456:ABC-DEF...\`

## Как подключить в Caller

1. Перейдите в **Settings → Provider Credentials**
2. Найдите секцию **Telegram**
3. Вставьте **Bot Token**
4. Нажмите **Save**
5. Вебхук для бота настроится автоматически

## Как получать уведомления

После подключения бота:
1. Найдите вашего бота в Telegram
2. Нажмите **Start**
3. Бот привяжется к вашему рабочему пространству
4. Теперь вы будете получать уведомления о звонках

> **Примечание:** Telegram-провайдер работает только в режиме «Own» — нужен свой бот.`,
          en: `# Setting up Telegram bot

The Telegram bot is used for call and event notifications.

## Why you need it

- Notifications about new calls
- Links to real-time call monitoring
- Real-time information about workspace events

## How to create a bot

1. Open Telegram and find **@BotFather**
2. Send the command \`/newbot\`
3. Enter the bot name (e.g., "My Caller Bot")
4. Enter the bot username (e.g., \`my_caller_bot\`)
5. BotFather will give you a **Bot Token** — a long string like \`123456:ABC-DEF...\`

## How to connect in Caller

1. Go to **Settings → Provider Credentials**
2. Find the **Telegram** section
3. Paste the **Bot Token**
4. Click **Save**
5. The webhook for the bot will be configured automatically

## How to receive notifications

After connecting the bot:
1. Find your bot in Telegram
2. Click **Start**
3. The bot will be linked to your workspace
4. Now you'll receive call notifications

> **Note:** Telegram provider only works in "Own" mode — you need your own bot.`,
        },
      },
    ],
  },

  // ─── 4. AI Агенты ────────────────────────────────────────────────
  {
    id: 'agents',
    titleKey: 'help.cat.agents',
    icon: 'smart_toy',
    articles: [
      {
        id: 'creating-agent',
        titleKey: 'help.art.creatingAgent',
        content: {
          ru: `# Создание агента

AI-агент — это виртуальный сотрудник, который может отвечать на звонки и совершать звонки от имени вашей компании.

## Пошаговое создание

1. Перейдите в раздел **Agents** в дашборде
2. Нажмите **New Agent** (или «+»)
3. Заполните форму:

### Основные данные
- **Name** — внутреннее имя (для вас, machine-readable)
- **Display Name** — имя, которым агент представляется
- **Description** — описание для вашей команды
- **Company Name** — название компании, от имени которой работает агент
- **Company Identity** — контекст компании (чем занимается, ценности)
- **Language** — язык агента (en, ru, es, de, fr, auto)

### Аватар
- Выберите один из 8 стандартных аватаров
- Или загрузите свою картинку

### Голос
- **Voice Provider** — ElevenLabs (основной), OpenAI TTS, xAI
- **Voice** — выберите конкретный голос из списка

### LLM (языковая модель)
- **Provider** — Anthropic, OpenAI, xAI
- **Model** — конкретная модель (Claude Sonnet 4.5, GPT-4.1, Grok 3 и др.)
- **Temperature** — от 0 (точные ответы) до 1 (творческие ответы)

### STT (распознавание речи)
- **Provider** — Deepgram (рекомендуется) или OpenAI Whisper

4. Нажмите **Create**

## Настройки по умолчанию

Вы можете отметить агента как **Default** — он будет использоваться для звонков, где агент не указан явно.

## Лимиты

- **Agents**: до 10 агентов
- **Agents + MCP**: неограниченно`,
          en: `# Creating an agent

An AI agent is a virtual employee that can answer calls and make calls on behalf of your company.

## Step-by-step creation

1. Go to the **Agents** section in the dashboard
2. Click **New Agent** (or "+")
3. Fill out the form:

### Basic data
- **Name** — internal name (for you, machine-readable)
- **Display Name** — name the agent introduces itself as
- **Description** — description for your team
- **Company Name** — company name the agent represents
- **Company Identity** — company context (what it does, values)
- **Language** — agent language (en, ru, es, de, fr, auto)

### Avatar
- Choose one of 8 standard avatars
- Or upload your own image

### Voice
- **Voice Provider** — ElevenLabs (primary), OpenAI TTS, xAI
- **Voice** — choose a specific voice from the list

### LLM (language model)
- **Provider** — Anthropic, OpenAI, xAI
- **Model** — specific model (Claude Sonnet 4.5, GPT-4.1, Grok 3, etc.)
- **Temperature** — from 0 (precise answers) to 1 (creative answers)

### STT (speech recognition)
- **Provider** — Deepgram (recommended) or OpenAI Whisper

4. Click **Create**

## Default settings

You can mark an agent as **Default** — it will be used for calls where no agent is explicitly specified.

## Limits

- **Agents plan**: up to 10 agents
- **Agents + MCP**: unlimited`,
        },
      },
      {
        id: 'agent-voice',
        titleKey: 'help.art.agentVoice',
        content: {
          ru: `# Настройка голоса агента

Голос агента определяет, как он звучит при ответах во время звонков.

## Провайдеры голоса

### ElevenLabs (рекомендуется)
- Самые реалистичные голоса
- Большая библиотека голосов
- Настройка параметров голоса
- Популярные: Sarah, Rachel, Adam, Domi

### OpenAI TTS
- Встроенные голоса OpenAI
- Хорошее качество
- Ниже стоимость

### xAI
- Голоса на основе Grok
- Хорошая скорость

## Как настроить

1. Перейдите в редактирование агента (Agents → выберите агента → Edit)
2. В секции **Voice** выберите:
   - **Provider** — провайдер голоса
   - **Voice** — конкретный голос
3. Сохраните изменения

## Советы

- Для бизнес-звонков рекомендуется **нейтральный голос** (Sarah или Adam)
- Для дружеского общения — **тёплый голос** (Rachel)
- Тестируйте голоса, совершая пробные звонки`,
          en: `# Agent voice settings

The agent's voice determines how it sounds when responding during calls.

## Voice providers

### ElevenLabs (recommended)
- Most realistic voices
- Large voice library
- Voice parameter customization
- Popular: Sarah, Rachel, Adam, Domi

### OpenAI TTS
- Built-in OpenAI voices
- Good quality
- Lower cost

### xAI
- Grok-based voices
- Good speed

## How to set up

1. Go to agent editing (Agents → select agent → Edit)
2. In the **Voice** section, choose:
   - **Provider** — voice provider
   - **Voice** — specific voice
3. Save changes

## Tips

- For business calls, a **neutral voice** is recommended (Sarah or Adam)
- For friendly communication — a **warm voice** (Rachel)
- Test voices by making trial calls`,
        },
      },
      {
        id: 'agent-llm',
        titleKey: 'help.art.agentLlm',
        content: {
          ru: `# Настройка LLM агента

LLM (Large Language Model) — это «мозг» вашего агента, который генерирует ответы.

## Выбор провайдера и модели

### Anthropic
- **Claude Sonnet 4.5** — рекомендуется для большинства задач. Отличный баланс скорости и качества.
- **Claude Opus 4.5** — самая мощная модель. Для сложных задач, требующих глубокого анализа.
- **Claude Haiku 3.5** — самая быстрая и дешёвая. Для простых задач.

### OpenAI
- **GPT-4.1** — мощная универсальная модель
- **GPT-4.1 Mini** — быстрая и экономичная
- **GPT-4o** — мультимодальная модель

### xAI
- **Grok 3** — мощная модель для сложных задач
- **Grok 3 Mini Fast** — быстрая модель

## Температура

**Temperature** (0–1) управляет «творчеством» ответов:
- **0.0–0.3** — точные, предсказуемые ответы (для FAQ, поддержки)
- **0.5–0.7** — сбалансированные ответы (рекомендуется, по умолчанию 0.7)
- **0.8–1.0** — творческие, разнообразные ответы (для продаж, маркетинга)

## Как настроить

1. При создании или редактировании агента
2. В секции **LLM** выберите провайдера и модель
3. Настройте температуру ползунком
4. Сохраните`,
          en: `# Agent LLM settings

LLM (Large Language Model) is the "brain" of your agent that generates responses.

## Choosing provider and model

### Anthropic
- **Claude Sonnet 4.5** — recommended for most tasks. Excellent balance of speed and quality.
- **Claude Opus 4.5** — most powerful model. For complex tasks requiring deep analysis.
- **Claude Haiku 3.5** — fastest and cheapest. For simple tasks.

### OpenAI
- **GPT-4.1** — powerful universal model
- **GPT-4.1 Mini** — fast and economical
- **GPT-4o** — multimodal model

### xAI
- **Grok 3** — powerful model for complex tasks
- **Grok 3 Mini Fast** — fast model

## Temperature

**Temperature** (0–1) controls response "creativity":
- **0.0–0.3** — precise, predictable answers (for FAQ, support)
- **0.5–0.7** — balanced answers (recommended, default 0.7)
- **0.8–1.0** — creative, diverse answers (for sales, marketing)

## How to set up

1. When creating or editing an agent
2. In the **LLM** section, select provider and model
3. Adjust temperature with the slider
4. Save`,
        },
      },
      {
        id: 'prompt-packs',
        titleKey: 'help.art.promptPacks',
        content: {
          ru: `# Промпт-паки

Промпт-паки — это переиспользуемые блоки системных инструкций, которые определяют поведение агента.

## Что это такое

Промпт-пак содержит текстовые инструкции для AI-агента. Например:
- «Всегда начинай разговор с приветствия и представления»
- «При жалобе клиента извинись и предложи решение»
- «Запиши контактные данные звонящего»

## Создание промпт-пака

1. Перейдите в раздел **Prompts** в дашборде
2. Нажмите **New Prompt Pack**
3. Заполните:
   - **Name** — название (например, «Приветствие клиента»)
   - **Description** — описание назначения
   - **Content** — текст промпта (инструкции для агента)
   - **Category** — категория (опционально)
4. Нажмите **Create**

## Привязка к агенту

1. Перейдите в редактирование агента
2. В секции **Prompts** добавьте нужные промпт-паки
3. Установите **приоритет** — чем выше число, тем важнее промпт
4. Сохраните

Один агент может иметь несколько промпт-паков — они объединяются по приоритету.

## Советы

- Разделяйте промпты по задачам (приветствие, обработка жалоб, запись данных)
- Используйте конкретные инструкции, а не общие фразы
- Тестируйте промпты, совершая пробные звонки`,
          en: `# Prompt packs

Prompt packs are reusable blocks of system instructions that define agent behavior.

## What are they

A prompt pack contains text instructions for an AI agent. For example:
- "Always start the conversation with a greeting and introduction"
- "When a client complains, apologize and offer a solution"
- "Record the caller's contact details"

## Creating a prompt pack

1. Go to the **Prompts** section in the dashboard
2. Click **New Prompt Pack**
3. Fill in:
   - **Name** — name (e.g., "Customer greeting")
   - **Description** — purpose description
   - **Content** — prompt text (instructions for the agent)
   - **Category** — category (optional)
4. Click **Create**

## Attaching to an agent

1. Go to agent editing
2. In the **Prompts** section, add the needed prompt packs
3. Set **priority** — higher number means more important
4. Save

An agent can have multiple prompt packs — they are combined by priority.

## Tips

- Separate prompts by task (greeting, complaint handling, data recording)
- Use specific instructions, not general phrases
- Test prompts by making trial calls`,
        },
      },
      {
        id: 'skill-packs',
        titleKey: 'help.art.skillPacks',
        content: {
          ru: `# Скилл-паки

Скилл-паки — это навыки и сценарии поведения, которые агент может использовать во время звонка.

## Что это такое

Скилл-пак описывает конкретный навык агента — когда его активировать, какие данные собрать, какие действия выполнить. Например:
- «Запись на приём» — собрать дату, время, имя, создать запись
- «Обработка жалобы» — выслушать, зафиксировать, предложить решение
- «Квалификация лида» — задать вопросы, оценить потенциал

## Создание скилл-пака

1. Перейдите в раздел **Skills** в дашборде
2. Нажмите **New Skill Pack**
3. Заполните:
   - **Name** — название навыка
   - **Intent** — что навык делает (цель)
   - **Description** — подробное описание
   - **Activation Rules** — когда активируется (JSON)
   - **Required Data** — какие данные нужно собрать
   - **Tool Sequence** — последовательность шагов
   - **Completion Criteria** — как понять, что навык выполнен
   - **Conversation Rules** — правила диалога
4. Нажмите **Create**

## AI-рекомендации

При редактировании агента Caller может **автоматически предложить** подходящие скилл-паки на основе конфигурации агента. Нажмите «Suggest Skills» для получения рекомендаций.

## Привязка к агенту

Так же, как промпт-паки: в редактировании агента, секция Skills, с приоритетом.`,
          en: `# Skill packs

Skill packs are capabilities and behavior scenarios that an agent can use during a call.

## What are they

A skill pack describes a specific agent skill — when to activate it, what data to collect, what actions to perform. For example:
- "Appointment booking" — collect date, time, name, create a record
- "Complaint handling" — listen, record, offer a solution
- "Lead qualification" — ask questions, evaluate potential

## Creating a skill pack

1. Go to the **Skills** section in the dashboard
2. Click **New Skill Pack**
3. Fill in:
   - **Name** — skill name
   - **Intent** — what the skill does (goal)
   - **Description** — detailed description
   - **Activation Rules** — when to activate (JSON)
   - **Required Data** — what data to collect
   - **Tool Sequence** — sequence of steps
   - **Completion Criteria** — how to know the skill is done
   - **Conversation Rules** — conversation guidelines
4. Click **Create**

## AI recommendations

When editing an agent, Caller can **automatically suggest** suitable skill packs based on the agent's configuration. Click "Suggest Skills" to get recommendations.

## Attaching to an agent

Same as prompt packs: in agent editing, Skills section, with priority.`,
        },
      },
      {
        id: 'knowledge-base',
        titleKey: 'help.art.knowledgeBase',
        content: {
          ru: `# База знаний

База знаний позволяет агентам работать с информацией о вашей компании, продуктах и процессах.

## Как это работает

1. Вы создаёте базу знаний и добавляете документы
2. Документы автоматически индексируются (векторные эмбеддинги)
3. Во время звонка агент может **искать** релевантную информацию
4. Агент отвечает на основе ваших данных, а не общих знаний

## Создание базы знаний

1. Перейдите в раздел **Knowledge** в дашборде
2. Нажмите **New Knowledge Base**
3. Задайте **название** и **описание**
4. Нажмите **Create**

## Добавление документов

1. Откройте созданную базу знаний
2. Нажмите **Add Document**
3. Заполните:
   - **Title** — заголовок документа
   - **Content** — текст документа
   - **Type** — тип: document, FAQ, policy, pricing, troubleshooting
4. Нажмите **Save**

### AI-форматирование
При добавлении документа вы можете нажать **Enhance** — AI поможет структурировать и отформатировать текст.

## Привязка к агенту

1. В редактировании агента, секция **Knowledge**
2. Добавьте нужные базы знаний
3. Агент будет использовать их при ответах

## Семантический поиск

Caller использует **векторные эмбеддинги** (pgvector) для семантического поиска. Это значит, что агент находит релевантную информацию даже если формулировка вопроса отличается от текста документа.`,
          en: `# Knowledge base

The knowledge base allows agents to work with information about your company, products, and processes.

## How it works

1. You create a knowledge base and add documents
2. Documents are automatically indexed (vector embeddings)
3. During a call, the agent can **search** for relevant information
4. The agent answers based on your data, not general knowledge

## Creating a knowledge base

1. Go to the **Knowledge** section in the dashboard
2. Click **New Knowledge Base**
3. Set a **name** and **description**
4. Click **Create**

## Adding documents

1. Open the created knowledge base
2. Click **Add Document**
3. Fill in:
   - **Title** — document title
   - **Content** — document text
   - **Type** — type: document, FAQ, policy, pricing, troubleshooting
4. Click **Save**

### AI formatting
When adding a document, you can click **Enhance** — AI will help structure and format the text.

## Attaching to an agent

1. In agent editing, **Knowledge** section
2. Add the needed knowledge bases
3. The agent will use them when answering

## Semantic search

Caller uses **vector embeddings** (pgvector) for semantic search. This means the agent finds relevant information even if the question wording differs from the document text.`,
        },
      },
      {
        id: 'assign-phone-number',
        titleKey: 'help.art.assignPhoneNumber',
        content: {
          ru: `# Привязка агента к номеру

Чтобы агент отвечал на входящие звонки, нужно привязать его к телефонному номеру.

## Предварительные требования

1. Twilio подключён (Settings → Provider Credentials → Twilio)
2. Телефонный номер активирован (создано подключение)
3. Агент создан

## Шаги

1. Перейдите в управление телефонными подключениями
2. Найдите нужный номер
3. Установите:
   - **AI Answering** — включить (агент будет отвечать на звонки)
   - **Default Agent** — выберите агента, который будет отвечать
   - **Inbound** — включить приём входящих звонков
4. Сохраните

## Как это работает

Когда кто-то звонит на ваш номер:
1. Twilio принимает звонок
2. Caller определяет назначенного агента
3. Агент «берёт трубку» и ведёт диалог
4. Звонок записывается и транскрибируется
5. После звонка генерируется резюме и извлекаются факты`,
          en: `# Assigning an agent to a phone number

For an agent to answer incoming calls, you need to assign it to a phone number.

## Prerequisites

1. Twilio connected (Settings → Provider Credentials → Twilio)
2. Phone number activated (connection created)
3. Agent created

## Steps

1. Go to telephony connection management
2. Find the needed number
3. Set:
   - **AI Answering** — enable (agent will answer calls)
   - **Default Agent** — select the agent that will answer
   - **Inbound** — enable receiving incoming calls
4. Save

## How it works

When someone calls your number:
1. Twilio receives the call
2. Caller identifies the assigned agent
3. Agent "picks up" and conducts the conversation
4. The call is recorded and transcribed
5. After the call, a summary is generated and facts are extracted`,
        },
      },
    ],
  },

  // ─── 5. Звонки ────────────────────────────────────────────────────
  {
    id: 'calls',
    titleKey: 'help.cat.calls',
    icon: 'call',
    articles: [
      {
        id: 'outbound-calls',
        titleKey: 'help.art.outboundCalls',
        content: {
          ru: `# Исходящие звонки

Исходящие звонки — это звонки, которые AI-агент совершает по вашему запросу.

## Способы инициации

### Через миссии (дашборд)
1. Создайте миссию в разделе **Missions**
2. Опишите задачу в чате с AI
3. Когда план готов, нажмите **Execute**

### Через API/MCP
Отправьте запрос:
\`\`\`
POST /api/calls/start
{
  "to": "+14155551234",
  "goal": "Confirm appointment for tomorrow at 3pm",
  "agent_profile_id": "uuid" // опционально
}
\`\`\`

### Через диалер
1. Перейдите в раздел **Dialer**
2. Введите номер
3. Нажмите «Позвонить»

## Что происходит во время звонка

1. Twilio инициирует звонок
2. Собеседник отвечает
3. AI-агент ведёт диалог согласно цели
4. Звонок записывается в реальном времени
5. По завершении — транскрипция, резюме, извлечение фактов

## Мониторинг

- В разделе **Calls** вы видите все звонки
- Активные звонки отмечены индикатором
- Можно просматривать транскрипцию в реальном времени`,
          en: `# Outbound calls

Outbound calls are calls that an AI agent makes at your request.

## Initiation methods

### Via missions (dashboard)
1. Create a mission in the **Missions** section
2. Describe the task in the AI chat
3. When the plan is ready, click **Execute**

### Via API/MCP
Send a request:
\`\`\`
POST /api/calls/start
{
  "to": "+14155551234",
  "goal": "Confirm appointment for tomorrow at 3pm",
  "agent_profile_id": "uuid" // optional
}
\`\`\`

### Via dialer
1. Go to the **Dialer** section
2. Enter the number
3. Click "Call"

## What happens during the call

1. Twilio initiates the call
2. The person answers
3. AI agent conducts the conversation according to the goal
4. The call is recorded in real time
5. Upon completion — transcription, summary, fact extraction

## Monitoring

- In the **Calls** section you see all calls
- Active calls are marked with an indicator
- You can view transcription in real time`,
        },
      },
      {
        id: 'inbound-calls',
        titleKey: 'help.art.inboundCalls',
        content: {
          ru: `# Входящие звонки

Входящие звонки — это когда кто-то звонит на ваш номер, и AI-агент автоматически отвечает.

## Настройка

1. **Подключите Twilio** и активируйте номер
2. **Включите Inbound** для номера (telephony connections)
3. **Включите AI Answering** — агент будет отвечать автоматически
4. **Назначьте агента** по умолчанию для этого номера

## Комплаенс

В **Settings → Compliance** можно настроить:
- **Call Recording Disclosure** — агент объявляет о записи звонка
- **AI Disclosure** — агент сообщает, что он AI
- **Auto-Answer Delay** — задержка перед ответом (5–120 сек)

## Как работает входящий звонок

1. Звонящий набирает ваш номер
2. Twilio принимает звонок и уведомляет Caller
3. После задержки (если настроена) агент берёт трубку
4. Агент приветствует звонящего (greeting message)
5. Ведёт диалог, используя промпты, скиллы и базу знаний
6. Звонок записывается и транскрибируется

## Память абонентов

Caller помнит предыдущие звонки с каждого номера. При повторном звонке агент имеет контекст из прошлых разговоров.`,
          en: `# Inbound calls

Inbound calls are when someone calls your number and an AI agent automatically answers.

## Setup

1. **Connect Twilio** and activate a number
2. **Enable Inbound** for the number (telephony connections)
3. **Enable AI Answering** — the agent will answer automatically
4. **Assign a default agent** for this number

## Compliance

In **Settings → Compliance** you can configure:
- **Call Recording Disclosure** — agent announces call recording
- **AI Disclosure** — agent announces it's AI
- **Auto-Answer Delay** — delay before answering (5–120 sec)

## How an inbound call works

1. The caller dials your number
2. Twilio accepts the call and notifies Caller
3. After a delay (if configured), the agent picks up
4. The agent greets the caller (greeting message)
5. Conducts conversation using prompts, skills, and knowledge base
6. The call is recorded and transcribed

## Caller memory

Caller remembers previous calls from each number. On repeat calls, the agent has context from past conversations.`,
        },
      },
      {
        id: 'dialer',
        titleKey: 'help.art.dialer',
        content: {
          ru: `# Диалер

Диалер — инструмент для ручного набора номеров из браузера.

## Как использовать

1. Перейдите в раздел **Dialer** в дашборде
2. Введите номер телефона в формате E.164 (например, +14155551234)
3. Настройте параметры:
   - **STT Language** — язык распознавания (auto, en, ru, es, de, fr)
   - **STT Provider** — Deepgram или OpenAI
   - **Voice Translate** — включить голосовой перевод (опционально)
4. Нажмите кнопку звонка

## Режим перевода

При включении Voice Translate:
- **Translation Mode** — sequential (последовательный) или translated (только перевод)
- **TTS Provider** — провайдер синтеза речи для перевода
- **Target Language** — на какой язык переводить

## Требования

- Настроенное исходящее телефонное подключение (Twilio)
- Достаточный баланс (если используете провайдеров платформы)

## Доступность по планам

| План | Диалер |
|------|--------|
| **Translator** | Только если администратор расшарил Twilio |
| **Agents** | Требуются собственные Twilio-ключи |
| **Agents + MCP** | Требуются собственные Twilio-ключи |`,
          en: `# Dialer

The dialer is a tool for manually dialing numbers from the browser.

## How to use

1. Go to the **Dialer** section in the dashboard
2. Enter a phone number in E.164 format (e.g., +14155551234)
3. Configure parameters:
   - **STT Language** — recognition language (auto, en, ru, es, de, fr)
   - **STT Provider** — Deepgram or OpenAI
   - **Voice Translate** — enable voice translation (optional)
4. Click the call button

## Translation mode

When Voice Translate is enabled:
- **Translation Mode** — sequential or translated (translation only)
- **TTS Provider** — speech synthesis provider for translation
- **Target Language** — language to translate into

## Requirements

- Configured outbound telephony connection (Twilio)
- Sufficient balance (if using platform providers)

## Availability by plan

| Plan | Dialer |
|------|--------|
| **Translator** | Only if admin shares Twilio access |
| **Agents** | Requires own Twilio keys |
| **Agents + MCP** | Requires own Twilio keys |`,
        },
      },
      {
        id: 'recording-transcription',
        titleKey: 'help.art.recordingTranscription',
        content: {
          ru: `# Запись и транскрипция

Все звонки в Caller автоматически записываются и транскрибируются.

## Запись звонков

- Запись ведётся автоматически для всех звонков
- Хранение: MinIO (внутреннее хранилище) или Twilio
- Формат: аудио (audio/mpeg)
- Срок хранения: настраивается (по умолчанию 90 дней)

## Транскрипция

- Полная транскрипция диалога с разделением по спикерам
- Распознавание в реальном времени (Deepgram Nova-2)
- Сохранение каждого хода диалога (turn)

## Аналитика после звонка

После завершения звонка AI автоматически генерирует:

- **Summary** — краткое резюме звонка
- **Short Title** — заголовок для списка
- **Sentiment** — тональность (позитивный/нейтральный/негативный)
- **Action Items** — список задач, выявленных в разговоре
- **Extracted Facts** — ключевые факты о звонящем (для памяти)
- **QA Score** — оценка качества звонка (0–10)
- **Outcome** — структурированный результат (если задана schema)

## Просмотр

1. Перейдите в раздел **Calls**
2. Нажмите на звонок
3. Вы увидите:
   - Плеер для прослушивания записи
   - Полную транскрипцию
   - Резюме и аналитику
   - Стоимость звонка по компонентам`,
          en: `# Recording and transcription

All calls in Caller are automatically recorded and transcribed.

## Call recording

- Recording is automatic for all calls
- Storage: MinIO (internal storage) or Twilio
- Format: audio (audio/mpeg)
- Retention period: configurable (default 90 days)

## Transcription

- Full conversation transcription with speaker separation
- Real-time recognition (Deepgram Nova-2)
- Each conversation turn saved

## Post-call analytics

After a call ends, AI automatically generates:

- **Summary** — brief call summary
- **Short Title** — title for the list
- **Sentiment** — tone (positive/neutral/negative)
- **Action Items** — list of tasks identified in conversation
- **Extracted Facts** — key facts about the caller (for memory)
- **QA Score** — call quality score (0–10)
- **Outcome** — structured result (if schema was set)

## Viewing

1. Go to the **Calls** section
2. Click on a call
3. You'll see:
   - Player for listening to the recording
   - Full transcription
   - Summary and analytics
   - Call cost by component`,
        },
      },
    ],
  },

  // ─── 6. Живой переводчик ──────────────────────────────────────────
  {
    id: 'translator',
    titleKey: 'help.cat.translator',
    icon: 'translate',
    articles: [
      {
        id: 'how-translator-works',
        titleKey: 'help.art.howTranslatorWorks',
        content: {
          ru: `# Как работает живой переводчик

Живой переводчик — это сервис, который подключается к вашему телефонному звонку и переводит речь в реальном времени.

## Принцип работы

1. Вы звоните на выделенный номер переводчика
2. Система подключается к вашему звонку как конференция (merge)
3. AI-переводчик (xAI Grok Voice Agent) распознаёт речь, переводит и озвучивает перевод — всё в одном потоке с минимальной задержкой
4. Вы слышите перевод в реальном времени

> **Важно:** Переводчик работает из коробки на всех планах. Все провайдеры (Twilio, xAI) предоставляются платформой. Стоимость использования списывается из вашего депозита.

## Поддерживаемые языки

10+ языковых пар, включая:
- Английский ↔ Русский
- Английский ↔ Испанский
- Английский ↔ Немецкий
- Английский ↔ Французский
- И другие комбинации

## Номер переводчика

Номер для звонка можно найти в разделе **Translator** в дашборде. Используется либо ваш номер (если настроен), либо номер платформы.

## Мониторинг

В разделе Translator вы можете наблюдать за активными сессиями перевода в реальном времени:
- Транскрипция оригинала и перевода
- Промежуточные результаты (пока человек говорит)
- Статус звонка`,
          en: `# How the live translator works

The live translator is a service that connects to your phone call and translates speech in real time.

## How it works

1. You call the designated translator number
2. The system connects to your call as a conference (merge)
3. The AI translator (xAI Grok Voice Agent) recognizes speech, translates, and voices the translation — all in a single stream with minimal latency
4. You hear the translation in real time

> **Important:** The translator works out of the box on all plans. All providers (Twilio, xAI) are supplied by the platform. Usage costs are deducted from your deposit.

## Supported languages

10+ language pairs, including:
- English ↔ Russian
- English ↔ Spanish
- English ↔ German
- English ↔ French
- And other combinations

## Translator number

The number to call can be found in the **Translator** section of the dashboard. Either your number (if configured) or the platform number is used.

## Monitoring

In the Translator section you can watch active translation sessions in real time:
- Transcription of original and translation
- Interim results (while the person is speaking)
- Call status`,
        },
      },
      {
        id: 'translator-settings',
        titleKey: 'help.art.translatorSettings',
        content: {
          ru: `# Настройки переводчика

В разделе **Translator** вы можете настроить параметры перевода для вашего рабочего пространства.

## Доступные настройки

### Пара языков
- **My Language** — ваш родной язык (на каком языке вы говорите)
- **Target Language** — язык собеседника (с какого языка переводить)

### Направление перевода
- **Bidirectional** — перевод в обе стороны (вы слышите перевод собеседника, собеседник слышит перевод вас)
- **Unidirectional** — перевод только в одну сторону

### Кто слышит перевод
- **Subscriber** — только вы слышите перевод
- **Both** — оба участника слышат перевод

### Тон перевода
- **Neutral** — нейтральный стиль
- **Business** — деловой стиль (удаляет слова-паразиты)
- **Friendly** — дружеский стиль
- **Medical** — медицинская терминология
- **Legal** — юридическая терминология

### Персональный контекст
Текстовое поле (до 2000 символов) для описания контекста:
- Ваша профессия
- Тема разговора
- Специфическая терминология

Это помогает переводчику быть точнее.

### Приветственное сообщение
Текст, который произносится в начале перевода.

### Голос TTS
Выбор голоса для озвучивания перевода.

## Сохранение

Нажмите **Save** — настройки сохранятся для всех будущих сессий перевода.`,
          en: `# Translator settings

In the **Translator** section you can configure translation parameters for your workspace.

## Available settings

### Language pair
- **My Language** — your native language (what language you speak)
- **Target Language** — counterpart's language (from which language to translate)

### Translation direction
- **Bidirectional** — translation both ways (you hear translation of counterpart, counterpart hears translation of you)
- **Unidirectional** — translation only one way

### Who hears translation
- **Subscriber** — only you hear the translation
- **Both** — both participants hear the translation

### Translation tone
- **Neutral** — neutral style
- **Business** — business style (removes filler words)
- **Friendly** — friendly style
- **Medical** — medical terminology
- **Legal** — legal terminology

### Personal context
Text field (up to 2000 characters) to describe context:
- Your profession
- Conversation topic
- Specific terminology

This helps the translator be more accurate.

### Greeting message
Text spoken at the beginning of translation.

### TTS voice
Voice selection for translation voicing.

## Saving

Click **Save** — settings are saved for all future translation sessions.`,
        },
      },
    ],
  },

  // ─── 7. Миссии ────────────────────────────────────────────────────
  {
    id: 'missions',
    titleKey: 'help.cat.missions',
    icon: 'task_alt',
    articles: [
      {
        id: 'what-is-mission',
        titleKey: 'help.art.whatIsMission',
        content: {
          ru: `# Что такое миссия

Миссия — это задание на звонок, которое вы планируете в чате с AI-ассистентом. AI помогает сформулировать цель, подобрать агента и выполнить звонок.

## Когда использовать миссии

- Нужно позвонить клиенту с конкретной задачей
- Хотите, чтобы AI помог спланировать разговор
- Нужна подготовка на основе предыдущих звонков
- Хотите запланировать звонок на определённое время

## Статусы миссии

| Статус | Описание |
|--------|----------|
| **Draft** | Черновик — миссия только создана |
| **Ready** | Готова — план звонка сформирован, можно выполнять |
| **Scheduled** | Запланирована — будет выполнена в указанное время |
| **Calling** | Звоним — звонок инициирован |
| **In Progress** | В процессе — звонок идёт |
| **Completed** | Завершена — звонок выполнен успешно |
| **Failed** | Неудача — звонок не удался |
| **Cancelled** | Отменена |

## Повторные попытки

Если звонок не удался, миссию можно повторить. По умолчанию доступно до 3 попыток.`,
          en: `# What is a mission

A mission is a call assignment that you plan in a chat with an AI assistant. AI helps formulate the goal, select an agent, and execute the call.

## When to use missions

- Need to call a client with a specific task
- Want AI to help plan the conversation
- Need preparation based on previous calls
- Want to schedule a call for a specific time

## Mission statuses

| Status | Description |
|--------|------------|
| **Draft** | Draft — mission just created |
| **Ready** | Ready — call plan formed, can execute |
| **Scheduled** | Scheduled — will be executed at the specified time |
| **Calling** | Calling — call initiated |
| **In Progress** | In progress — call ongoing |
| **Completed** | Completed — call executed successfully |
| **Failed** | Failed — call was unsuccessful |
| **Cancelled** | Cancelled |

## Retries

If the call fails, the mission can be retried. Up to 3 attempts are available by default.`,
        },
      },
      {
        id: 'creating-mission',
        titleKey: 'help.art.creatingMission',
        content: {
          ru: `# Создание и выполнение миссии

## Пошаговый процесс

### 1. Создайте миссию
- Перейдите в раздел **Missions**
- Нажмите **New Mission**
- Откроется чат с AI-ассистентом

### 2. Опишите задачу
Напишите в чате, что нужно сделать. Например:
- «Позвони Джону по номеру +14155551234, подтверди встречу на завтра в 15:00»
- «Свяжись с клиентом +14155559876, узнай отзыв о нашем сервисе»

### 3. AI уточнит детали
AI-ассистент может задать вопросы:
- Какой номер телефона?
- Какая цель звонка?
- На каком языке?
- Какого агента использовать?

### 4. План звонка
Когда все данные собраны, AI сформирует план:
- Номер телефона
- Цель звонка
- Выбранный агент
- Контекст (имя собеседника, компания и т.д.)

### 5. Выполнение
Нажмите **Execute** — агент начнёт звонок.

### 6. Результат
После завершения вы увидите:
- Статус миссии (completed/failed)
- Результат звонка (outcome)
- Транскрипцию и резюме

## Умные функции

- AI **автоматически определяет** номера телефонов в вашем тексте
- Загружает **историю звонков** с этим номером
- Использует **память абонента** из предыдущих разговоров
- Формирует план в JSON для точного выполнения`,
          en: `# Creating and executing a mission

## Step-by-step process

### 1. Create a mission
- Go to the **Missions** section
- Click **New Mission**
- An AI assistant chat will open

### 2. Describe the task
Write in the chat what needs to be done. For example:
- "Call John at +14155551234, confirm the meeting for tomorrow at 3pm"
- "Contact the client at +14155559876, get feedback on our service"

### 3. AI will clarify details
The AI assistant may ask questions:
- What phone number?
- What's the call goal?
- What language?
- Which agent to use?

### 4. Call plan
When all data is collected, AI will form a plan:
- Phone number
- Call goal
- Selected agent
- Context (counterpart name, company, etc.)

### 5. Execution
Click **Execute** — the agent will start the call.

### 6. Result
After completion you'll see:
- Mission status (completed/failed)
- Call result (outcome)
- Transcription and summary

## Smart features

- AI **automatically detects** phone numbers in your text
- Loads **call history** with that number
- Uses **caller memory** from previous conversations
- Forms a JSON plan for precise execution`,
        },
      },
    ],
  },

  // ─── 8. Интеграции ────────────────────────────────────────────────
  {
    id: 'integrations',
    titleKey: 'help.cat.integrations',
    icon: 'hub',
    articles: [
      {
        id: 'api-keys',
        titleKey: 'help.art.apiKeys',
        content: {
          ru: `# API-ключи

API-ключи позволяют программно взаимодействовать с Caller через API и MCP Server.

## Создание ключа

1. Перейдите в **Settings → MCP API Keys**
2. Нажмите **Create API Key**
3. Задайте имя ключа (например, «ChatGPT Integration»)
4. Нажмите **Create**
5. **Скопируйте ключ** — он показывается только один раз!

Формат ключа: \`mcp_\` + случайная строка (~50 символов)

## Использование

Передавайте ключ в заголовке запроса:
\`\`\`
Authorization: Bearer mcp_xxxx...
\`\`\`

## Отзыв ключа

Если ключ скомпрометирован:
1. Перейдите в **Settings → MCP API Keys**
2. Найдите ключ в списке
3. Нажмите **Revoke**
4. Ключ немедленно перестанет работать

## Безопасность

- Ключи хранятся как SHA-256 хэши (оригинал не хранится)
- Используется timing-safe сравнение
- Каждый запрос логируется (last_used_at)

> **Доступно на планах:** Agents и Agents + MCP`,
          en: `# API keys

API keys allow programmatic interaction with Caller via API and MCP Server.

## Creating a key

1. Go to **Settings → MCP API Keys**
2. Click **Create API Key**
3. Set a key name (e.g., "ChatGPT Integration")
4. Click **Create**
5. **Copy the key** — it's shown only once!

Key format: \`mcp_\` + random string (~50 characters)

## Usage

Pass the key in the request header:
\`\`\`
Authorization: Bearer mcp_xxxx...
\`\`\`

## Revoking a key

If a key is compromised:
1. Go to **Settings → MCP API Keys**
2. Find the key in the list
3. Click **Revoke**
4. The key immediately stops working

## Security

- Keys are stored as SHA-256 hashes (original is not stored)
- Timing-safe comparison is used
- Each request is logged (last_used_at)

> **Available on plans:** Agents and Agents + MCP`,
        },
      },
      {
        id: 'webhooks',
        titleKey: 'help.art.webhooks',
        content: {
          ru: `# Вебхуки

Вебхуки позволяют получать уведомления о событиях в Caller в вашу систему.

## Поддерживаемые события

| Событие | Описание |
|---------|----------|
| \`call.started\` | Звонок начался |
| \`call.completed\` | Звонок завершён |
| \`call.failed\` | Звонок не удался |
| \`session.summary_ready\` | Резюме звонка готово |

## Создание вебхука

1. Перейдите в раздел **Connectors** (или Settings → Webhooks)
2. Нажмите **New Webhook**
3. Заполните:
   - **URL** — HTTPS-адрес вашего эндпоинта
   - **Events** — выберите события для подписки
   - **Secret** — секретный ключ для верификации (опционально, мин. 16 символов)
4. Нажмите **Create**

## Тестирование

Нажмите **Test** рядом с вебхуком — Caller отправит тестовое событие на ваш URL.

## Верификация

Если вы указали secret, проверяйте подпись входящих запросов для защиты от подделки.

> **Важно:** URL должен быть HTTPS (HTTP не поддерживается).`,
          en: `# Webhooks

Webhooks allow you to receive notifications about Caller events in your system.

## Supported events

| Event | Description |
|-------|------------|
| \`call.started\` | Call started |
| \`call.completed\` | Call completed |
| \`call.failed\` | Call failed |
| \`session.summary_ready\` | Call summary ready |

## Creating a webhook

1. Go to the **Connectors** section (or Settings → Webhooks)
2. Click **New Webhook**
3. Fill in:
   - **URL** — HTTPS address of your endpoint
   - **Events** — select events to subscribe to
   - **Secret** — secret key for verification (optional, min 16 characters)
4. Click **Create**

## Testing

Click **Test** next to the webhook — Caller will send a test event to your URL.

## Verification

If you specified a secret, verify incoming request signatures to protect against spoofing.

> **Important:** URL must be HTTPS (HTTP is not supported).`,
        },
      },
      {
        id: 'mcp-server',
        titleKey: 'help.art.mcpServer',
        content: {
          ru: `# MCP Server

MCP (Model Context Protocol) Server позволяет подключить Caller как инструмент к AI-ассистентам: Claude Desktop, ChatGPT и другим.

## Что можно делать через MCP

- Совершать звонки (\`start_call\`)
- Проверять статус звонков (\`get_call_status\`)
- Получать результаты звонков (\`get_call_artifacts\`)
- Управлять агентами (\`list_agents\`, \`get_agent\`)
- Работать с базой знаний (\`search_knowledge\`)
- Управлять миссиями (\`execute_mission\`)
- Проверять баланс (\`get_balance\`)

## Настройка

### 1. Создайте API-ключ
Settings → MCP API Keys → Create

### 2. Настройте MCP-клиент

Добавьте в конфигурацию вашего AI-ассистента:

\`\`\`json
{
  "mcpServers": {
    "caller": {
      "command": "npx",
      "args": ["@caller/mcp-server"],
      "env": {
        "CALLER_API_URL": "https://your-caller-domain.com",
        "CALLER_API_KEY": "mcp_xxxx..."
      }
    }
  }
}
\`\`\`

### 3. Используйте
Теперь ваш AI-ассистент может совершать звонки и управлять агентами через Caller.

> **Доступно на плане:** Agents + MCP`,
          en: `# MCP Server

MCP (Model Context Protocol) Server allows connecting Caller as a tool to AI assistants: Claude Desktop, ChatGPT, and others.

## What you can do via MCP

- Make calls (\`start_call\`)
- Check call status (\`get_call_status\`)
- Get call results (\`get_call_artifacts\`)
- Manage agents (\`list_agents\`, \`get_agent\`)
- Work with knowledge base (\`search_knowledge\`)
- Manage missions (\`execute_mission\`)
- Check balance (\`get_balance\`)

## Setup

### 1. Create an API key
Settings → MCP API Keys → Create

### 2. Configure MCP client

Add to your AI assistant's configuration:

\`\`\`json
{
  "mcpServers": {
    "caller": {
      "command": "npx",
      "args": ["@caller/mcp-server"],
      "env": {
        "CALLER_API_URL": "https://your-caller-domain.com",
        "CALLER_API_KEY": "mcp_xxxx..."
      }
    }
  }
}
\`\`\`

### 3. Use it
Now your AI assistant can make calls and manage agents through Caller.

> **Available on plan:** Agents + MCP`,
        },
      },
      {
        id: 'oauth',
        titleKey: 'help.art.oauth',
        content: {
          ru: `# OAuth 2.0

OAuth 2.0 позволяет создавать интеграции, где внешние приложения получают доступ к Caller от имени пользователя.

## Когда использовать

- Интеграция с ChatGPT Actions (GPT делает звонки через Caller)
- Подключение к n8n, Zapier и другим автоматизациям
- Создание собственных интеграций с авторизацией

## Создание OAuth-приложения

1. Перейдите в **Settings → OAuth 2.0 Applications**
2. Нажмите **Create Application**
3. Заполните:
   - **Name** — название приложения
   - **Redirect URIs** — URL-адреса для callback (до 10)
4. Нажмите **Create**
5. Сохраните **Client ID** и **Client Secret** (показывается один раз!)

## Endpoints

| Endpoint | Назначение |
|----------|-----------|
| \`GET /api/oauth/authorize\` | Страница авторизации |
| \`POST /api/oauth/authorize\` | Подтверждение/отказ |
| \`POST /api/oauth/token\` | Обмен кода на токен |

## Пример: ChatGPT Actions

1. Создайте OAuth-приложение с redirect URI: \`https://chat.openai.com/aip/oauth/callback\`
2. В настройках GPT Actions укажите:
   - Authorization URL: \`https://your-domain/api/oauth/authorize\`
   - Token URL: \`https://your-domain/api/oauth/token\`
   - Client ID и Secret из шага 1
3. Опишите доступные actions (start_call, get_status и т.д.)

Токен действует 90 дней.

> **Доступно на плане:** Agents + MCP`,
          en: `# OAuth 2.0

OAuth 2.0 allows creating integrations where external applications access Caller on behalf of a user.

## When to use

- Integration with ChatGPT Actions (GPT makes calls through Caller)
- Connecting to n8n, Zapier, and other automations
- Creating custom integrations with authorization

## Creating an OAuth application

1. Go to **Settings → OAuth 2.0 Applications**
2. Click **Create Application**
3. Fill in:
   - **Name** — application name
   - **Redirect URIs** — callback URLs (up to 10)
4. Click **Create**
5. Save **Client ID** and **Client Secret** (shown once!)

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| \`GET /api/oauth/authorize\` | Authorization page |
| \`POST /api/oauth/authorize\` | Approve/deny |
| \`POST /api/oauth/token\` | Exchange code for token |

## Example: ChatGPT Actions

1. Create OAuth app with redirect URI: \`https://chat.openai.com/aip/oauth/callback\`
2. In GPT Actions settings specify:
   - Authorization URL: \`https://your-domain/api/oauth/authorize\`
   - Token URL: \`https://your-domain/api/oauth/token\`
   - Client ID and Secret from step 1
3. Describe available actions (start_call, get_status, etc.)

Token is valid for 90 days.

> **Available on plan:** Agents + MCP`,
        },
      },
      {
        id: 'connectors',
        titleKey: 'help.art.connectors',
        content: {
          ru: `# Коннекторы

Коннекторы позволяют связать Caller с внешними системами для обмена данными.

## Создание коннектора

1. Перейдите в раздел **Connectors** в дашборде
2. Нажмите **New Connector**
3. Заполните:
   - **Name** — название коннектора
   - **Type** — тип подключения
   - **Config** — параметры подключения (зависит от типа)
4. Нажмите **Create**

## Управление

- **Test** — проверить подключение
- **Execute** — выполнить действие через коннектор
- **Activate/Deactivate** — включить/выключить
- **Delete** — удалить коннектор

## Использование

Коннекторы могут использоваться агентами через скилл-паки для выполнения действий во внешних системах во время звонков.`,
          en: `# Connectors

Connectors allow you to link Caller with external systems for data exchange.

## Creating a connector

1. Go to the **Connectors** section in the dashboard
2. Click **New Connector**
3. Fill in:
   - **Name** — connector name
   - **Type** — connection type
   - **Config** — connection parameters (depends on type)
4. Click **Create**

## Management

- **Test** — check connection
- **Execute** — perform an action through the connector
- **Activate/Deactivate** — enable/disable
- **Delete** — delete connector

## Usage

Connectors can be used by agents through skill packs to perform actions in external systems during calls.`,
        },
      },
    ],
  },

  // ─── 9. Настройки ────────────────────────────────────────────────
  {
    id: 'settings',
    titleKey: 'help.cat.settings',
    icon: 'tune',
    articles: [
      {
        id: 'general-settings',
        titleKey: 'help.art.generalSettings',
        content: {
          ru: `# Общие настройки

В разделе **Settings → Workspace Settings** вы можете настроить основные параметры рабочего пространства.

## Доступные настройки

### Название рабочего пространства
Отображается в дашборде и уведомлениях.

### Имя владельца
Имя, которое используется в контексте звонков.

### Телефонные номера
До 3 номеров в формате E.164 (например, +14155551234). Используются для идентификации подписчика в звонках переводчика.

### Часовой пояс
Часовой пояс рабочего пространства (IANA формат, например America/New_York).

### Владелец диалога по умолчанию
- **Internal** — диалогом управляет встроенный AI Caller
- **External** — диалогом управляет внешняя система (через webhook)`,
          en: `# General settings

In the **Settings → Workspace Settings** section you can configure basic workspace parameters.

## Available settings

### Workspace name
Displayed in the dashboard and notifications.

### Owner name
Name used in call context.

### Phone numbers
Up to 3 numbers in E.164 format (e.g., +14155551234). Used for subscriber identification in translator calls.

### Timezone
Workspace timezone (IANA format, e.g., America/New_York).

### Default conversation owner
- **Internal** — conversation is managed by Caller's built-in AI
- **External** — conversation is managed by an external system (via webhook)`,
        },
      },
      {
        id: 'appearance-settings',
        titleKey: 'help.art.appearanceSettings',
        content: {
          ru: `# Внешний вид

В разделе **Settings → Appearance** можно настроить тему и акцентный цвет дашборда.

## Тема
Выберите тему оформления дашборда по вкусу.

## Акцентный цвет
Настройте основной акцентный цвет интерфейса.

## Язык
Переключение между английским и русским языком интерфейса. Настройка сохраняется в браузере.`,
          en: `# Appearance

In the **Settings → Appearance** section you can customize the dashboard theme and accent color.

## Theme
Choose a dashboard theme to your liking.

## Accent color
Customize the main accent color of the interface.

## Language
Switch between English and Russian interface language. The setting is saved in the browser.`,
        },
      },
      {
        id: 'compliance-settings',
        titleKey: 'help.art.complianceSettings',
        content: {
          ru: `# Комплаенс

В разделе **Settings → Compliance** настраиваются параметры, связанные с соблюдением правил и регуляций.

## Объявление о записи
**Call Recording Disclosure** — если включено, агент в начале звонка объявляет, что разговор записывается. Это требование многих юрисдикций.

## Объявление об AI
**AI Disclosure** — если включено, агент сообщает звонящему, что он является AI-ассистентом.

## Задержка автоответа
**Auto-Answer Delay** — задержка в секундах (5–120) перед тем, как AI-агент ответит на входящий звонок. Позволяет человеку ответить раньше агента.

> **Рекомендация:** Включите оба объявления для соблюдения законодательства о записи звонков и прозрачности AI.`,
          en: `# Compliance

In the **Settings → Compliance** section you can configure parameters related to rules and regulations compliance.

## Recording disclosure
**Call Recording Disclosure** — if enabled, the agent announces at the beginning of the call that the conversation is being recorded. This is a requirement in many jurisdictions.

## AI disclosure
**AI Disclosure** — if enabled, the agent informs the caller that it is an AI assistant.

## Auto-answer delay
**Auto-Answer Delay** — delay in seconds (5–120) before the AI agent answers an incoming call. Allows a human to answer before the agent.

> **Recommendation:** Enable both disclosures to comply with call recording legislation and AI transparency.`,
        },
      },
      {
        id: 'team-settings',
        titleKey: 'help.art.teamSettings',
        content: {
          ru: `# Управление командой

Вы можете приглашать участников в рабочее пространство и назначать им роли.

## Роли

| Роль | Права |
|------|-------|
| **Owner** | Полный доступ, управление биллингом, удаление workspace |
| **Admin** | Всё кроме удаления workspace, управление подпиской |
| **Operator** | Создание звонков, миссий, работа с агентами (без настроек) |
| **Analyst** | Просмотр звонков, статистики, аудита (только чтение) |

## Приглашение участника

1. Перейдите в **Settings** (секция Team, если доступна)
2. Нажмите **Invite Member**
3. Введите email
4. Выберите роль
5. Нажмите **Send Invite**

Участник получит приглашение на email.

## Удаление участника

1. Найдите участника в списке
2. Нажмите **Remove**
3. Подтвердите удаление

> **Примечание:** Владелец (Owner) не может быть удалён.`,
          en: `# Team management

You can invite members to the workspace and assign them roles.

## Roles

| Role | Permissions |
|------|------------|
| **Owner** | Full access, billing management, workspace deletion |
| **Admin** | Everything except workspace deletion, subscription management |
| **Operator** | Creating calls, missions, working with agents (no settings) |
| **Analyst** | Viewing calls, statistics, audit (read-only) |

## Inviting a member

1. Go to **Settings** (Team section, if available)
2. Click **Invite Member**
3. Enter email
4. Choose a role
5. Click **Send Invite**

The member will receive an invitation via email.

## Removing a member

1. Find the member in the list
2. Click **Remove**
3. Confirm removal

> **Note:** The Owner cannot be removed.`,
        },
      },
    ],
  },
];
