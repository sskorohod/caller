# Живой переводчик на линии — Полный план реализации

## Context
Новый B2C-продукт: абонент во время разговора с иностранцем merge-ит наш номер как 3-го участника. Система автоматически слушает обе стороны, определяет язык и переводит голосом или текстом. Оплата через Stripe pay-per-use ($/мин).

---

## Шаг 1: База данных — таблица подписчиков переводчика

**Файл:** `packages/backend/src/db/schema.ts`

Новая таблица `translator_subscribers`:
```
- id (uuid, PK)
- workspace_id (uuid, FK → workspaces)
- phone_number (varchar) — номер абонента для определения caller ID
- name (varchar) — имя абонента
- email (varchar, nullable)
- my_language (varchar, default 'ru') — язык абонента
- target_language (varchar, default 'en') — язык собеседника (или 'auto')
- mode ('voice' | 'text' | 'both') — режим доставки перевода
- who_hears ('subscriber' | 'both') — кто слышит голосовой перевод
- greeting_text (text) — текст приветствия переводчика
- tts_provider (varchar, default 'elevenlabs')
- tts_voice_id (varchar, nullable)
- telegram_chat_id (varchar, nullable)
- stripe_customer_id (varchar, nullable)
- stripe_subscription_id (varchar, nullable)
- balance_minutes (numeric, default 0) — оставшиеся минуты
- enabled (boolean, default true)
- created_at, updated_at
```

Новая таблица `translator_sessions` (история звонков переводчика):
```
- id (uuid, PK)
- subscriber_id (uuid, FK → translator_subscribers)
- call_id (uuid, FK → calls)
- duration_seconds (integer)
- minutes_used (numeric)
- cost_usd (numeric)
- transcript (jsonb)
- created_at
```

**Миграция:** `supabase/migrations/YYYYMMDD_translator_tables.sql`

**Тест:** `npm run db:migrate` — миграция применяется без ошибок

---

## Шаг 2: CRUD API для подписчиков

**Файл:** `packages/backend/src/routes/translator/subscribers.ts`

REST API (защищён JWT auth, scoped to workspace):
- `GET /api/translator/subscribers` — список подписчиков
- `POST /api/translator/subscribers` — создать подписчика
- `GET /api/translator/subscribers/:id` — получить подписчика
- `PUT /api/translator/subscribers/:id` — обновить настройки
- `DELETE /api/translator/subscribers/:id` — удалить

**Реюз:** паттерн из существующих routes (auth middleware, Zod validation, workspace scoping)

**Тест:** curl/Postman — CRUD операции работают, валидация Zod отклоняет неверные данные

---

## Шаг 3: Определение абонента при входящем звонке

**Файл:** `packages/backend/src/routes/webhooks/twilio.ts` (модификация)

В обработчике `/webhooks/twilio/inbound`:
1. После определения `calledNumber` → проверить caller ID (`From`) в таблице `translator_subscribers`
2. Если найден + `enabled=true` + `balance_minutes > 0`:
   - Создать запись в `calls` с типом `translator`
   - Вернуть TwiML: приветствие (TTS из `greeting_text`) → подключение к conference media stream
3. Если не найден → существующая логика (AI agent или reject)

**Реюз:** 
- `telephonyService` из `packages/backend/src/services/telephony.service.ts`
- TTS providers из `packages/backend/src/services/tts.service.ts`
- Паттерн inbound webhook из `twilio.ts`

**Тест:** Позвонить с зарегистрированного номера → услышать приветствие переводчика. Позвонить с незарегистрированного → обычная обработка.

---

## Шаг 4: Conference Translator Engine (ядро)

**Файл:** `packages/backend/src/services/conference-translator.ts` (новый)

Основной сервис — слушает conference и переводит:

1. **Двусторонний STT**: один поток на входящий аудио
   - Deepgram с `interim_results=true` для реалтайма
   - Авто-определение языка через Deepgram `language=auto` или по настройкам подписчика

2. **Определение спикера + языка**:
   - Если определён русский → переводить на английский
   - Если определён английский → переводить на русский
   - (или по настройкам: my_language ↔ target_language)

3. **Перевод**: LLM (GPT-4o-mini / Grok) — быстрый non-streaming
4. **TTS**: озвучивание перевода, инъекция в conference stream
5. **Кто слышит**: 
   - `subscriber` — перевод только в канал абонента
   - `both` — перевод в оба канала (каждый слышит на своём языке)

**Реюз:**
- `DeepgramSTT` из `stt.service.ts` — STT streaming
- `createTTSProvider` из `tts.service.ts` — TTS synthesis
- `createLLMProvider` из `llm.service.ts` — LLM translation
- `finalizeVTSession` паттерн из `media-stream.ts` — idempotent save

**Тест:** Merge-нуть наш номер в звонок → услышать приветствие → говорить по-русски → собеседник слышит английский перевод (и наоборот).

---

## Шаг 5: Интеграция с media-stream WebSocket

**Файл:** `packages/backend/src/routes/webhooks/media-stream.ts` (модификация)

В обработчике `start` event:
1. Проверить тип звонка — если `call.type === 'translator'`:
   - Запустить `ConferenceTranslator` вместо `CallOrchestrator`
   - Подключить STT к входящему аудиоo
   - При переводе инъектировать TTS аудио обратно в stream

2. В обработчике `media` event:
   - Направлять аудио в ConferenceTranslator

3. В `stop`/`close`:
   - `finalizeTranslatorSession()` — сохранить транскрипт, посчитать минуты, списать баланс

**Реюз:** весь паттерн из Voice Translate (VT) sessions

**Тест:** Полный звонок через conference → перевод работает в обе стороны → данные сохраняются.

---

## Шаг 6: Live-страница с текстовым переводом

**Файл:** `packages/frontend/src/app/translate/[token]/page.tsx` (новый, публичный)

Публичная страница (без auth, доступ по share token):
- Подключается к Socket.IO через shareToken
- Показывает в реальном времени:
  - Транскрипцию речи собеседника (оригинал)
  - Перевод на язык абонента
- Авто-скролл, мобильно-адаптивная
- Индикатор «слушаю...» когда говорит собеседник

**Реюз:**
- Паттерн из `/calls/[id]/monitor/page.tsx` — shareToken auth, Socket.IO подключение
- `call_share_tokens` таблица — генерация токена при старте сессии

**Backend:**
- При старте translator session → создать share token → отправить ссылку в Telegram/SMS

**Тест:** Начать звонок → получить ссылку в Telegram → открыть страницу → видеть текст в реальном времени.

---

## Шаг 7: Telegram-бот — уведомления и ссылки

**Файл:** `packages/backend/src/services/telegram.service.ts` (модификация)

Добавить:
- `sendTranslatorSessionLink(chatId, callId, shareToken, subscriberName)` — отправка ссылки на live-страницу при начале сессии
- `sendTranslatorSessionEnd(chatId, duration, cost)` — уведомление о завершении с итогом

**Реюз:** существующий `sendTelegramMessage()` из telegram.service.ts

**Тест:** При начале/конце звонка → Telegram-сообщения приходят корректно.

---

## Шаг 8: Subscriber Dashboard (фронтенд)

**Файлы:** `packages/frontend/src/app/dashboard/translator/` (новая секция)

### 8a. Страница настроек `/dashboard/translator/settings`
- Список подписчиков (таблица)
- Добавление/редактирование подписчика:
  - Телефон, имя
  - Мой язык / язык собеседника
  - Режим перевода (голос / текст / оба)
  - Кто слышит перевод
  - Текст приветствия переводчика
  - TTS голос (выбор провайдера + voice)
  - Telegram chat ID
- Включение/выключение подписчика

### 8b. Страница истории `/dashboard/translator/history`
- Список сессий переводчика
- Для каждой: дата, длительность, стоимость, транскрипт
- Фильтры по дате, подписчику

### 8c. Страница баланса `/dashboard/translator/billing`
- Текущий баланс минут
- История списаний
- Кнопка «Пополнить» → Stripe Checkout

**Реюз:** 
- shadcn/ui компоненты из существующего дашборда
- Tailwind 4 стили из существующих страниц
- API-клиент из `packages/frontend/src/lib/api.ts`

**Тест:** Все CRUD операции через UI, создание/редактирование подписчика, просмотр истории.

---

## Шаг 9: Stripe Integration — Pay-per-use

**Файлы:**
- `packages/backend/src/services/stripe.service.ts` (новый)
- `packages/backend/src/routes/stripe/webhooks.ts` (новый)
- `packages/backend/src/routes/stripe/checkout.ts` (новый)

### 9a. Stripe Setup
- Stripe SDK (`stripe` npm package)
- Создание Product + Price в Stripe (metered, per-minute)
- Stripe Customer создаётся при регистрации подписчика

### 9b. Checkout Flow
- `POST /api/stripe/checkout` — создать Checkout Session для пополнения минут
- Пакеты: 30 мин / 60 мин / 120 мин (или кастом)
- После оплаты → webhook обновляет `balance_minutes`

### 9c. Webhooks
- `POST /webhooks/stripe` — обработка checkout.session.completed
- Обновление баланса подписчика
- Signature verification

### 9d. Списание минут
- При завершении translator session → вычесть использованные минуты из баланса
- Если баланс < 2 мин → предупреждение в Telegram
- Если баланс = 0 → не подключать переводчика (сообщить "баланс исчерпан")

**Тест:** Пополнить баланс через Stripe test mode → минуты появляются → позвонить → минуты списываются.

---

## Шаг 10: SMS-уведомления (ссылка на live-страницу)

**Файл:** `packages/backend/src/services/sms.service.ts` (новый)

- Отправка SMS через Twilio (уже есть credentials)
- При старте translator session в text-режиме → SMS с ссылкой на live-страницу
- Fallback если нет Telegram

**Реюз:** Twilio credentials из `provider_credentials`

**Тест:** Начать сессию без Telegram → получить SMS с ссылкой.

---

## Порядок реализации и зависимости

```
Шаг 1 (DB) ─────────────────────────────────────────────┐
Шаг 2 (CRUD API) ← зависит от 1                         │
Шаг 3 (Inbound webhook) ← зависит от 1, 2               │
Шаг 4 (Conference Engine) ← зависит от 1                 │ Ядро
Шаг 5 (Media Stream integration) ← зависит от 3, 4      │
                                                          │
Шаг 6 (Live-страница) ← зависит от 5                     │ Фронтенд
Шаг 7 (Telegram) ← зависит от 5                          │
Шаг 8 (Dashboard) ← зависит от 2                         │
                                                          │
Шаг 9 (Stripe) ← зависит от 2                            │ Биллинг
Шаг 10 (SMS) ← зависит от 5                              │
```

**MVP (первые 5 шагов):** DB → API → Webhook → Engine → Media Stream = рабочий переводчик голосом
**Полный продукт:** + Live-страница + Telegram + Dashboard + Stripe + SMS
