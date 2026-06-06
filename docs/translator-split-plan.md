# План разделения: Translator ↔ Business-Agent

Цель: вынести **Live Translator** в самостоятельный продукт, отделив его от
**бизнес-агента** (AI-агенты для звонков, миссии, knowledge/RAG, MCP). Основано
на карте связности из аудита (11 точек). Подход — **инкрементальный**: каждый шаг
деплоится отдельно и обратим. Сначала разрезаем код в монорепо (логические
границы), и только потом — опционально — разносим на два деплоя.

## Где сейчас всё переплетено (11 точек)

| # | Точка сцепления | Файл | Серьёзность среза |
|---|---|---|---|
| 1 | Один WS-хендлер на 3 режима (translator + agent + sandbox) | `routes/webhooks/media-stream.ts` | средняя |
| 2 | Translator пишет в общие `calls`/`ai_call_sessions` | `routes/webhooks/twilio.ts` | **высокая** |
| 3 | Общий `session-finalizer` на оба продукта | `services/session-finalizer.service.ts` | **высокая** |
| 4 | Post-call LLM-аналитика гоняется на транскриптах переводчика | `workers/post-call.worker.ts` | средняя |
| 5 | `telegram-commands` мешает translator и mission/agent команды | `services/telegram-commands.service.ts` | средняя |
| 6 | Общий Socket.IO неймспейс `call:<id>` | `services/conference-translator.ts` | средняя |
| 7 | Общий `billing.service` + `workspaces.balance_usd` | `services/conference-translator.ts` | средняя |
| 8 | Один Twilio inbound-вебхук маршрутизирует оба | `routes/webhooks/twilio.ts` | **высокая** |
| 9 | ElevenLabs-провайдер прописан вопреки правилу «No ElevenLabs» | `services/tts.service.ts` | низкая |
| 10 | Caller-workspace lookup на каждом входящем | `routes/webhooks/twilio.ts` | низкая |
| 11 | Translator-уведомления Telegram внутри общего `telegram.service` | `services/telegram.service.ts` | низкая (safe) |

## Целевые границы

**Translator-продукт** владеет: `conference-translator`, `grok-realtime`,
`sandbox-session`, `live-translate`, роуты `translator/*`, таблицы
`translator_subscribers` / `translator_sessions` (+ новая `translator_calls`),
xAI Grok Voice Agent, Stripe pay-per-use по минутам.

**Business-agent-продукт** владеет: `call-orchestrator`, `agents`, `missions`,
`knowledge`/`memory`, `mcp-server`, post-call аналитика, таблицы `calls` /
`ai_call_sessions`, биллинг по балансу.

**Остаётся общим (инфраструктура):** auth/workspaces/users, Twilio-аккаунт
(номера), Postgres, Redis, Socket.IO-сервер, MinIO, деплой-стек.

## Фазы (каждая — отдельный деплой)

### Фаза 0 — подготовка, без смены поведения (низкий риск)
- **#11**: вынести 4 translator-функции из `telegram.service` в
  `telegram-translator.service` (чистый перенос). ✅ безопасно.
- **#5**: разнести translator- и agent/mission-обработчики в
  `telegram-commands` на два модуля с явной диспетчеризацией.
- **#9**: убрать ElevenLabs как дефолт/фолбэк (правило проекта) — провайдер
  голоса по умолчанию xai/openai; ElevenLabs-ветку убрать или загейтить.

### Фаза 1 — собственная модель данных переводчика (высокий риск, миграция)
- **#2, #8**: новая таблица `translator_calls` (from/to/status/duration), чтобы
  переводчик перестал «занимать» `calls`/`ai_call_sessions`. Миграция +
  бэкфилл активных строк не нужен (сессии короткие) — переключаем новые звонки.
- **#10**: маршрутизация входящего по **набранному** номеру (`To`), а не по
  caller-lookup: translator-номера → translator-хендлер; остальные → agent.
  Явный признак продукта на уровне `telephonyConnections`.

### Фаза 2 — разрезать обработку звонка (средний риск)
- **#1**: выделить `routes/webhooks/translator-stream.ts` (translator WS) из
  общего `media-stream.ts`; agent-режим остаётся в `media-stream.ts`.
- **#3, #4, #7**: translator-специфичный финализатор (пишет `translator_sessions`,
  считает минуты/Grok-стоимость, **не** зовёт post-call LLM-аналитику и общий
  `deductUsageCost`); `finalizeSession` остаётся для агента.
- **#6**: неймспейсить translator realtime-комнаты (`translate:<sessionId>`)
  отдельно от `call:<id>` агента.

### Фаза 3 — опционально: физический раздел на два деплоя
- Монорепо-пакеты `packages/translator-backend` и `packages/agent-backend`
  (или один backend с двумя bounded-context модулями).
- Общая БД, но непересекающиеся таблицы; общий auth-модуль как библиотека.
- Отдельные контейнеры в `docker-compose`, общий nginx по путям
  (`/api/translator/*` → translator, остальное → agent).

## Принципы
- На каждом шаге — `tsc` + смок-проверка + деплой; ничего «большим взрывом».
- Прод-данные не мигрируем разрушительно: новые сущности, переключение новых
  звонков, старые дочитываются по-старому.
- Сначала Фаза 0 (обратимая, низкий риск) — на ней проверяем подход.

## Открытые вопросы к Славе
1. Сплит **на уровне кода** (модули в одном backend) или **на два деплоя**
   (отдельные контейнеры/процессы)? Влияет на объём Фазы 3.
2. Биллинг переводчика — окончательно отвязать от `workspaces.balance_usd`
   (минуты подписчика) или оставить общий баланс?
3. Номерная маршрутизация: у translator-номеров будет явный флаг продукта в
   `telephonyConnections`?
