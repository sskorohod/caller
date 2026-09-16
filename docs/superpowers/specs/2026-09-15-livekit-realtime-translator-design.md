# Голосовой переводчик LingoLine на LiveKit + OpenAI Realtime

Дата: 2026-09-15
Статус: согласован, ждёт плана реализации

## 1. Цель

Перевести **голосовой** режим переводчика LingoLine на тот же принцип и голос, что
используются в проекте `aidispatch`: один сеанс OpenAI Realtime внутри LiveKit Agents
вместо текущего каскада Deepgram STT → gpt-4o-mini → TTS.

Мотив: каскад упирается в пол задержки Deepgram `utterance_end` (1000 мс, непробиваем —
см. `project_translator_latency`), и каждое звено добавляет свой штраф. Realtime-сеанс
делает STT + перевод + TTS одной моделью и убирает склейку.

### Критерии приёмки

1. Входящий звонок на номер переводчика доходит до Realtime-агента и переводится
   в обе стороны; транскрипт виден на `/translate/<token>` в реальном времени.
2. Медиана задержки «конец речи → начало озвучки перевода» ниже текущей, измеренной
   через существующую метрику `translator_turn_metrics`.
3. Агент не переводит собственный голос: за тестовый звонок на громкой связи — ноль
   реплик, где вход и выход на одном языке.
4. Биллинг, запись разговора, Telegram/SMS-уведомления, share-token и страница
   `/translate/<token>` работают без изменений в коде этих подсистем.
5. `VOICE_ENGINE=pipeline` возвращает прод на текущий каскад без передеплоя кода.
6. `npm run build` и `npm run lint` проходят; прогон сценария из `tests/` — зелёный.

## 2. Что остаётся нетронутым

Это жёсткая граница работ. Ни один из перечисленных модулей не меняется:

- **Preflight входящего звонка** в `routes/webhooks/twilio.ts`: проверка баланса и отбой,
  создание записи в `calls`, `ai_sessions`, старт записи разговора, Telegram/SMS
  со ссылкой, `createShareToken`. Меняется **только** финальный TwiML.
- **Биллинг**: Twilio остаётся в медиатракте, его status callback и `session-finalizer`
  работают как сейчас.
- **Stealth** (тихий текстовый перевод по ссылке), **sandbox-тренажёр**, **dialer
  voice-translate** — остаются на текущем каскаде в `stealth-translator.ts`.
- **Фронтенд**: `/translate/[token]`, `dashboard/*`. Формат событий Socket.IO
  сохраняется дословно.

Удаляется только `services/conference-translator.ts` — движок Grok Voice Agent, мёртвый
в проде с переходом на `VOICE_ENGINE=pipeline`.

## 3. Архитектура

### 3.1 Телефония: Twilio остаётся хозяином звонка

Номер переводчика остаётся привязанным к вебхуку `/webhooks/twilio/inbound`. Вместо
Elastic SIP Trunk (как в `aidispatch`) звонок заводится в LiveKit через TwiML — так весь
preflight остаётся там, где он есть, и не дублируется в воркере.

```
было:  <Connect><Stream url="wss://<API_DOMAIN>/webhooks/ws/media-stream/<callId>"/></Connect>
стало: <Dial><Sip>sip:tr-<callId>@<LIVEKIT_SIP_HOST>;transport=tcp</Sip></Dial>
```

LiveKit-сторона, создаётся один раз через `lk`:

- **Inbound trunk** с пустым `numbers` (catch-all: принимает любой destination) и
  авторизацией по `auth_username` / `auth_password`. Пустой `numbers` без авторизации
  означает открытый SIP-эндпоинт — пароль обязателен.
- **Dispatch rule типа `callee`**, `randomize: false`, без префикса. При такой настройке
  имя комнаты равно user-части SIP `To`, то есть `tr-<callId>`. Дефисы и UUID допустимы.
- В правиле — явный agent dispatch на `agentName: "lingoline-translator"`, чтобы комнату
  не подхватил посторонний воркер.

Почему имя комнаты, а не SIP-заголовки: кастомные `X-*` заголовки LiveKit отдаёт в
атрибуты участника **асинхронно**, они могут быть недоступны в момент входа в комнату.
Имя комнаты доступно воркеру синхронно при получении джоба.

### 3.2 Воркер: `packages/translator-agent`

Новый npm-workspace (корневой `package.json` уже объявляет `packages/*`):

- `@livekit/agents@1.9` + `@livekit/agents-plugin-openai@1.9`
- отдельный сервис `translator-agent` в `docker-compose.yml`
- переиспользует Drizzle-схему и `credential-resolver.service.ts` из backend. Пакет
  `@caller/backend` сейчас не объявляет `exports`, поэтому в него добавляются subpath-экспорты
  (`./db/schema`, `./services/credential-resolver`), а `translator-agent` объявляет его
  workspace-зависимостью. Ключ OpenAI берётся из workspace админа, как все
  инфраструктурные провайдеры

Жизненный цикл джоба:

1. Из имени комнаты `tr-<callId>` извлекается `callId`.
2. Из Postgres читаются `calls`, `workspaces.translator_defaults` — язык, приветствие,
   тон, `personal_context`, `who_hears`.
3. Поднимается `AgentSession` с Realtime-моделью.
4. По завершении комнаты пишется `translator_sessions` (длительность, минуты, стоимость,
   транскрипт) — в том же формате, что пишет `stealth-translator.ts` сейчас.

### 3.3 Голос и промпт

Конфигурация модели повторяет `aidispatch` один в один:

```ts
new openai.realtime.RealtimeModel({
  model: 'gpt-realtime-2.1',
  voice: 'marin',
  turnDetection: { type: 'semantic_vad' },
})
```

Node-SDK `@livekit/agents-plugin-openai` поддерживает ровно эти параметры, `marin` —
дефолтный голос и там, и в `aidispatch` (`AGENT_VOICE`).

Промпт пишется заново под переводчика. Ключевые требования, которых нет у диспетчера:

- выводить **только перевод**, не вести диалог, не комментировать, не отвечать на вопросы,
  адресованные собеседнику;
- направление определять по языку входящей речи: `my_language` ↔ `target_language`
  из `translator_defaults`;
- тон — из `translator_defaults.tone` (`friendly` / `formal` / `neutral`);
- `personal_context` подмешивается как справка о говорящем;
- страховка от эха: если распознанная речь совпадает с только что произнесённым
  переводом — молчать.

Админка промптов с версиями из `aidispatch` **не переносится**: настройки переводчика
уже живут в `translator_defaults` и редактируются в дашборде.

### 3.4 Мост воркер ↔ backend

Воркер — отдельный процесс, `getIo()` ему недоступен. Сейчас управление живым звонком
идёт через in-process map `getActiveConferenceTranslators()` в `media-stream.ts`, к
которому обращаются обработчики в `realtime/socket-server.ts`.

Мост строится на Redis pub/sub (`ioredis` уже в стеке), два канала:

- `translator:events` — воркер → backend. Реплики и метрики. Backend ретранслирует их в
  Socket.IO **теми же событиями и с той же полезной нагрузкой**, что сейчас:
  - `call:translation` в комнату `call:<id>:translate`
    (`{ call_id, speaker, original, translated, detected_language, timestamp }`)
  - `call:transcript` в комнату `call:<id>`
  - `translator:stats` в комнату `call:<id>`
- `translator:control` — backend → воркер. Существующие обработчики сокета
  (`translator:set-languages`, `set-voice`, `set-tone`, `set-mode`, `pause`, `resume`)
  вместо вызова методов на объекте публикуют команду в канал; воркер применяет её
  к активной сессии. Авторизация (`authorizeCallAccess`) остаётся на стороне backend.

Для `VOICE_ENGINE=livekit` обработчики роутятся в Redis, для `pipeline` — в текущую
in-process map. Развилка локализована в `realtime/socket-server.ts`.

### 3.5 Конфигурация

Новые переменные окружения backend и воркера:

```
VOICE_ENGINE=livekit        # livekit | pipeline  (значение grok уходит вместе с conference-translator.ts)
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_SIP_HOST=           # <project-id>.sip.livekit.cloud
LIVEKIT_SIP_AUTH_USER=
LIVEKIT_SIP_AUTH_PASS=
TRANSLATOR_REALTIME_MODEL=gpt-realtime-2.1
TRANSLATOR_VOICE=marin
```

LiveKit Cloud — **отдельный проект**, не общий с `aidispatch`: свой SIP host, свои ключи,
изоляция аварий и биллинга.

## 4. Эхо и barge-in

Главный технический риск. Продукт — `single-leg speakerphone`: оба собеседника говорят
в один телефон на громкой связи, поэтому агент слышит собственный перевод.

Текущий каскад решает это явным гейтом — входящее аудио отбрасывается, пока играет TTS
(`stealth-translator.ts`), плюс snowball guard против безостановочного говоруна (`d749e57`).
У `semantic_vad` такого гейта нет: из коробки модель услышит себя и начнёт переводить
собственный вывод.

Решение — три слоя:

1. Гейт входного аудио на время своей реплики (`session.input.audio` off/on).
2. `allowInterruptions: false` на время реплики.
3. Инструкция в промпте против эха (см. 3.3).

**Осознанный компромисс:** перебить перевод голосом станет нельзя. Для переводчика это
приемлемо — реплика должна быть произнесена целиком, — но это изменение поведения
относительно текущего прода, и его надо проверить на живом звонке.

## 5. Экономика

Прайс OpenAI по `aidispatch/agent/models.py` (проверен 2026-09-05): `gpt-realtime-2.1` —
audio in $32, audio in cached $0.40, audio out $64 за 1M токенов.

Оценка при ~10 аудио-токенах в секунду и работающем кэшировании контекста:

| Статья | $/мин |
|---|---|
| OpenAI Realtime (вход + выход + кэш) | 0.045–0.05 |
| LiveKit SIP + agent | 0.014 |
| Twilio (входящий + SIP-плечо) | 0.015–0.02 |
| **Итого** | **0.075–0.09** |

Против текущего каскада ~$0.03/мин при цене продукта $0.20/мин. Маржа сохраняется, но
сжимается примерно вдвое.

**Это расчёт, а не замер.** Фактические цифры лежат в `calls.cost_total` на Mac mini;
сверку надо сделать до начала работ. Запасной вариант при неприемлемой марже —
`gpt-realtime-2.1-mini` (audio in $10 / out $20), втрое дешевле.

## 6. Откат

`VOICE_ENGINE=pipeline` возвращает TwiML к `<Connect><Stream>` и весь голосовой тракт —
к `stealth-translator.ts`. Переключение переменной окружения, без передеплоя кода.
Воркер `translator-agent` при этом просто не получает джобов.

## 7. Известная неаккуратность в данных

`TranslatorDefaults.translation_mode` типизирован как `'bidirectional' | 'unidirectional'`,
но `routes/webhooks/twilio.ts` сравнивает его со строкой `'stealth'`. Поле перегружено
двумя смыслами. В рамках этой работы **не чиним** — но развилка voice/stealth в новом
коде должна читать его так же, как читает текущий код, иначе stealth сломается.

## 8. Вне рамок

- Перенос stealth, sandbox-тренажёра и dialer на LiveKit.
- Админка промптов с версиями из `aidispatch`.
- Ночная оценка качества (`eval/nightly`) из `aidispatch`.
- Исходящие звонки через LiveKit SIP.
