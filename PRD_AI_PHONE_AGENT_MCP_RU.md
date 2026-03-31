# PRD: SaaS-платформа AI Phone Agent с MCP

## Видение продукта
Создать мультиарендную B2B SaaS-платформу, которая предоставляет возможность звонков через MCP для любых совместимых агентов, а также дает настраиваемую систему AI phone agent для входящих и исходящих бизнес-звонков. Это не просто телеком-инструмент. Это платформа конфигурируемых голосовых агентов, где каждый workspace может задавать идентичность компании, промпты, скиллы, базы знаний, память, подключенные источники данных, владельца разговора и поведение звонков без захардкоженной бизнес-логики.

## Краткое описание продукта
У платформы есть одна основная голосовая система с настраиваемым `conversation ownership`.

Администратор выбирает, кто именно владеет живым разговором:

- `Internal Platform Agent`: разговор полностью ведет внутренний AI-агент платформы
- `External Calling Agent`: разговор ведет внешний агент, а платформа дает телефонию, STT/TTS, транскрипцию, записи и runtime-события

Рекомендуемые дефолты для v1:

- conversation owner по умолчанию: `internal`
- исходящие звонки: поддерживают и `internal`, и `external`
- входящие звонки: по умолчанию `internal`
- optional inbound external handoff: доступен по явной настройке в админ-панели, через `webhook + WebSocket`, с fallback на внутреннего агента

Платформа ориентирована на SMB-сегмент сервисных бизнесов, включая Appliance Repair, но остается доменно-независимой за счет конфигурации через prompts, skills, memory и knowledge base.

## Основное обещание продукта
Администратор workspace может настроить AI phone system, которая:

- говорит от имени компании
- совершает и принимает звонки
- следует настраиваемым инструкциям и бизнес-правилам
- использует базы знаний и подключенные бизнес-данные
- помнит предыдущих звонящих и прошлые вопросы
- выполняет структурированные действия через tools
- может передавать live dialogue внутреннему или внешнему агенту
- эскалирует разговор человеку при необходимости
- сохраняет записи, транскрипты, результаты и аналитику

## Основные сценарии использования
- Внешний MCP-совместимый агент просит платформу позвонить клиенту для напоминания, квалификации, follow-up, поддержки, оплаты, intake или записи.
- Бизнес включает AI-ответчик для входящих звонков и задает, как именно AI должен вести себя в рамках этого бизнеса.
- Workspace загружает знания, определяет prompt rules и подключает skill packs, чтобы агент мог работать, например, в Appliance Repair без изменений в коде.
- AI распознает повторных звонящих, помнит предыдущие проблемы и продолжает разговор с учетом истории.
- Платформа может передать входящий или исходящий звонок внешнему агенту, если это задано настройками.
- Платформа анализирует прошлые звонки и помогает постепенно улучшать качество работы агента.

## Определение продукта

### Ключевой сдвиг в концепции
Главная сущность продукта - это не просто звонок. Это `Agent Profile` плюс `Behavior Stack` плюс `Conversation Ownership`.

Behavior stack:

- идентичность и persona компании
- инструкции и system prompts
- скиллы и tool policies
- база знаний
- память и история звонящего
- подключенные источники данных
- настройки голоса и провайдеров
- правила эскалации и compliance

Conversation ownership:

- `internal`: live dialogue ведет внутренний агент платформы
- `external`: live dialogue ведет внешний агент

Каждый звонок выполняется на базе одного выбранного behavior stack и одного выбранного conversation owner.

### Без захардкоженной бизнес-логики
Вся специализация под конкретный бизнес должна выражаться через конфигурационные слои, а не через отдельные ветки логики в коде.

Используется многослойная модель поведения:

- базовые runtime rules платформы
- правила workspace
- выбранный conversation owner
- правила agent profile
- prompt pack для конкретного use case
- skill pack
- knowledge retrieval
- runtime override цели звонка

Appliance Repair должен быть готовым конфигурационным примером, а не отдельной захардкоженной фичей.

### Память как отдельная подсистема
AI должен уметь узнавать предыдущих звонящих и помнить их вопросы.

Нужны три уровня памяти:

- Caller memory: нормализованный номер телефона, идентичность, отношение к компании, прошлые intents, незакрытые вопросы, последние результаты
- Conversation memory: транскрипты, summary, извлеченные факты, данные обещания, следующие шаги, sentiment flags
- Business memory: постоянные workspace-правила, FAQ, терминология, границы услуг, операционные предпочтения

Память должна читаться при старте звонка и обновляться после его завершения вне зависимости от того, кто вел разговор.

### Скиллы как отдельная подсистема
Скилл - это переиспользуемый behavioral package, который включает:

- область применения и назначение
- правила разговора
- разрешенные tools
- упорядоченные tool sequences
- условия эскалации
- обязательные данные для сбора
- критерии завершения
- правила обработки прерываний

Примеры:

- intake для appliance repair
- перенос уже существующей записи
- invoice reminder
- напоминание об оплате
- lead qualification
- bilingual front desk

В internal mode skills напрямую влияют на разговор. В external mode они могут использоваться как policy hints или callable actions, но не владеют диалоговым циклом.

### Подключенные бизнес-данные
AI должен иметь возможность использовать источники данных workspace, если это разрешено.

Поддерживаемые типы источников:

- внутренние CRM-сущности внутри платформы
- внешние API через connectors
- загруженные документы и knowledge bases
- структурированные записи и search indices
- история звонков и прошлые взаимодействия

AI должен получать доступ к этим данным через управляемые tools и retrieval-механизмы, а не через прямой доступ к базе данных.

## Публичные интерфейсы и ключевые сущности

### MCP Surface
Основные MCP tools для runtime:

- `start_call`
- `get_call_status`
- `get_call_artifacts`
- `list_recent_calls`

Управляющие MCP tools могут появиться позже при необходимости:

- `list_agent_profiles`
- `get_agent_profile`
- `get_knowledge_sources`

Администрирование и настройка в v1 остаются внутри dashboard.

### Основные SaaS-объекты
- Workspace
- User
- Role
- Workspace API Key
- Provider Credential
- Telephony Connection
- Agent Profile
- Prompt Pack
- Skill Pack
- Knowledge Base
- Knowledge Document
- Memory Profile
- Data Connector
- Tool Policy
- Call
- AI Call Session
- Call Event
- Recording Artifact
- Transcript Artifact
- Analytics Report
- QA Criterion
- QA Evaluation
- Webhook Endpoint
- Audit Log Entry
- Retention Policy

### Новые runtime fields
Нужно добавить first-class поля:

- `conversation_owner_default`
- `allow_inbound_external_handoff`
- `external_inbound_webhook_url`
- `external_inbound_auth_secret`
- `external_ready_timeout_ms`
- `inbound_fallback_mode`

На каждом call/session сохранять:

- `conversation_owner_requested`
- `conversation_owner_actual`
- `external_bootstrap_status`
- `external_runtime_connected_at`
- `fallback_reason`
- `goal_source`
- `goal_payload`
- `selected_agent_profile_id`
- `external_runtime_metadata`

### Контракт Agent Profile
`Agent Profile` должен включать:

- отображаемое имя агента
- идентичность компании
- поддерживаемые языки
- голос и провайдеров
- ссылки на prompt packs
- ссылки на skill packs
- ссылки на knowledge bases
- настройки памяти
- права на использование tools
- правила эскалации
- поддерживаемые цели звонков
- бизнес-теги и business mode

## Архитектура системы

### Модель conversation ownership
Для каждого звонка runtime должен определить, кто владеет live dialogue.

#### Internal ownership
Внутренний агент платформы управляет:

- live conversation loop
- turn taking
- interruption handling
- prompt stack
- skill execution
- knowledge retrieval
- memory loading and updating
- tool use
- escalation
- логикой завершения звонка

Внешний MCP-агент в этом режиме передает цель, задачу, контекст и желаемый outcome.

#### External ownership
Внешний агент управляет:

- reasoning
- dialogue decisions
- progression toward goal
- response logic
- completion decisions

Платформа при этом управляет:

- telephony
- audio transport
- STT
- TTS
- transcript stream
- recording
- call state
- event model
- observability
- persistence артефактов

### Behavior Stack Resolution
Для каждого звонка поведение определяется в таком порядке:

- global platform runtime rules
- workspace defaults
- выбранный conversation owner
- выбранный agent profile
- подключенные prompt packs
- подключенные skills
- подключенные knowledge sources
- caller memory
- runtime objective и overrides

Это позволяет сделать поведение гибким, но при этом детерминированным.

### Runtime Architecture
Нужно переиспользовать и обобщить лучшие идеи из `FixarCRM`:

- разделение на control plane и runtime plane
- хранение telephony records отдельно от AI session records
- поддержка per-call session state во время разговора
- сохранение структурированных tool calls, summary и принятых решений
- enforcement правильной последовательности действий и правил завершения звонка
- эскалация человеку
- проверка принадлежности media stream перед voice bridge

Основные runtime-компоненты:

- telephony ingress
- media bridge
- turn manager
- retrieval layer
- skill and policy engine
- tool execution engine
- session memory loader
- post-call memory updater
- analytics и QA workers
- external-agent session bridge

### External-Agent Inbound Handoff
Inbound external handoff - это отдельный runtime path.

#### Trigger model
Когда приходит входящий звонок и `allow_inbound_external_handoff` включен:

1. Платформа создает telephony и AI session records.
2. Платформа отправляет bootstrap webhook во внешний orchestrator.
3. Webhook содержит:
   - `event_type = inbound_call_requested`
   - `call_id`
   - `session_id`
   - `workspace_id`
   - `called_number`
   - `caller_number`
   - `received_at`
   - `routing_context`
   - одноразовый `session_token`
   - `ws_url`
   - `reply_deadline`
4. Внешний orchestrator запускает или выбирает agent runtime.
5. Этот runtime подключается обратно к платформе по WebSocket с использованием session token.

#### Realtime protocol
Используется `webhook + bidirectional WebSocket`.

От платформы к внешнему агенту:

- call lifecycle events
- caller metadata
- transcript deltas
- speaker turn boundaries
- partial и final STT
- silence/interruption markers
- optional memory/context snapshot

От внешнего агента к платформе:

- `agent_ready`
- `reply_text`
- optional `action`
- optional `control`
- heartbeat

#### Reply contract
В v1 внешний агент возвращает:

- text
- optional structured actions
- optional control commands

Платформа выполняет TTS и проигрывает синтезированный голос в звонок. Генерация аудио внешним агентом в v1 не требуется.

#### Fallback behavior
Если внешний агент не становится ready в течение `external_ready_timeout_ms`, платформа переключает обработку на внутреннего агента.

Важное правило:

- В v1 fallback должен происходить до начала внешнего live dialogue.
- После начала разговора под одним owner активный owner не должен меняться, если позже не будет введена отдельная failover policy.

### Архитектура памяти
При старте звонка:

- нормализуется идентичность звонящего
- выполняется поиск по номеру и связанным данным клиента
- загружаются недавние summary и незакрытые задачи
- загружаются релевантные memory snippets
- в runtime передается только минимально необходимый контекст

После завершения звонка:

- сохраняется transcript и summary
- извлекаются структурированные факты
- обновляется профиль звонящего и история его проблем
- записываются follow-up tasks и unresolved intents
- фиксируются обещания и следующие шаги

Запись в память должна быть структурированной и версионируемой.

### Архитектура знаний и retrieval
Knowledge sources должны поддерживать:

- загруженные документы
- ручные заметки
- FAQ
- policy pages
- service catalogs
- troubleshooting guides
- pricing references

Retrieval должен быть ограничен workspace и, при необходимости, agent-profile scope.

Во время разговора runtime выбирает один из подходов:

- прямой ответ из prompt context
- ответ через skill logic
- retrieval из knowledge base
- lookup из memory
- tool call к подключенным бизнес-данным

### Система skills
Skill pack должен определять:

- когда он может активироваться
- какой intent он обслуживает
- какая последовательность действий разрешена
- какие данные обязательны для завершения
- какие tools можно использовать
- какие notes или structured outputs должны быть записаны
- когда требуется эскалация
- как корректно завершать звонок

Skill packs должны быть привязываемыми к agent profiles и иметь versioning.

## Возможности dashboard и админки

### v1 Operations Dashboard
- Workspace settings
- подключение Twilio по модели BYO
- настройки OpenAI gateway
- настройки xAI/Grok
- настройки ElevenLabs
- управление API keys
- управление agent profiles
- редактор prompt packs
- редактор skill packs
- менеджер knowledge base
- настройки memory и lookup по звонящему
- настройки data connectors
- список звонков
- список AI sessions
- карточка звонка с recording, transcript, tool log, memory events, QA и summary
- настройки webhooks
- настройки retention
- usage и provider health
- audit log

### Conversation Ownership Settings
В админ-панели должен быть центральный runtime switch:

- `Default Conversation Owner`
  - `Internal Platform Agent`
  - `External Calling Agent`

И дополнительные inbound settings:

- `Allow Inbound Calls To External Agent`
- `Inbound External Agent Webhook URL`
- `Inbound External Agent Auth Secret`
- `External Agent Ready Timeout`
- `Inbound External Fallback Mode`

Пояснение для пользователя:

- Internal: собственный AI платформы ведет разговор, используя prompts, skills, memory и knowledge.
- External: live dialogue ведет внешний агент, а платформа дает calling, speech synthesis, transcript streaming, recording и runtime support.

### UX настройки агента
Dashboard должен позволять администраторам настраивать:

- кто такой AI
- как он говорит
- что он знает
- что ему разрешено делать
- что он должен помнить
- как он эскалирует диалог
- по каким use cases он должен отвечать
- кто владеет live conversation по умолчанию
- можно ли передавать inbound calls внешнему agent runtime

## Требования к качеству SaaS

### Tenancy и auth
- строгая изоляция workspace для всех артефактов, памяти, промптов, skills и call data
- RBAC для admin, operator, analyst и support
- workspace API keys для MCP clients
- шифрование provider credentials
- хранение API keys в hashed виде с prefix lookup и usage tracking
- signed inbound bootstrap webhooks
- one-time session tokens для external WebSocket handoff

### Reliability
- idempotent обработка webhooks
- append-only event log для lifecycle звонка
- async retries и dead-letter path
- классификация provider failures
- timeout rules и graceful fallback behavior

### Safety и governance
- tool policies на уровне agent profile
- отсутствие прямого доступа runtime к базе данных
- retrieval и действия только через управляемые интерфейсы
- audit logs для всех изменений поведения
- versioning prompt и skill изменений
- human escalation controls
- запись ownership mode на каждом звонке

### Analytics
- хранение recording и transcript
- post-call summary
- извлечение action items
- quality flags
- caller history timeline
- QA evaluations и trend reporting
- memory extraction metrics
- usage и cost instrumentation по провайдерам
- классификация звонков по ownership mode

## Этапы реализации

### Phase 0: Product Spec Freeze
- Подготовить полный PRD вокруг configurable AI phone agent с conversation ownership.
- Зафиксировать canonical entities: Agent Profile, Prompt Pack, Skill Pack, Knowledge Base, Memory, AI Call Session, Conversation Ownership.
- Описать internal/external ownership model и inbound handoff behavior.

### Phase 1: SaaS Foundation
- Workspaces, auth, RBAC, audit logs, API keys, provider credentials
- telephony connection model
- базовая модель agent profile
- tenant isolation на уровне схем и запросов
- ownership settings model

### Phase 2: Telephony and Call Runtime
- inbound и outbound lifecycle через Twilio
- call records плюс AI session records
- secure media bridge
- orchestration разговора в реальном времени
- базовый MCP-контракт `start_call`
- ownership routing при старте звонка

### Phase 3: Prompt, Skill, and Policy Engine
- система prompt packs
- система skill packs
- enforcement tool policies
- conversation flow engine
- governance для escalation и end-call
- ownership-aware runtime branching

### Phase 4: Knowledge and Memory
- ingestion и retrieval для knowledge base
- caller memory и conversation memory
- structured memory extraction и write-back
- загрузка контекста для returning callers

### Phase 5: External-Agent Runtime Bridge
- inbound bootstrap webhook
- WebSocket protocol для external runtime
- text + optional actions reply model
- timeout и fallback на внутреннего агента
- observability и security для handoff

### Phase 6: Analytics, QA, and Beta
- summaries, transcripts, action items, quality flags
- configurable QA subsystem
- trend reporting и improvement actions
- ownership-aware review UX
- пилот с реальными SMB service businesses

## План тестирования

### Основные сценарии поведения
- внешний MCP-агент может запустить исходящий звонок с internal ownership
- внешний MCP-агент может запустить исходящий звонок с external ownership
- входящий звонок обрабатывается внутренним агентом, если external handoff выключен
- входящий звонок инициирует webhook bootstrap и WebSocket handoff, если external handoff включен
- профиль appliance repair корректно работает через prompts, skills и knowledge в internal mode
- повторный звонящий распознается, и исторический контекст корректно используется
- внешний runtime получает transcript deltas и возвращает text replies, которые платформа озвучивает через TTS
- AI обновляет memory после звонка в обоих ownership modes

### Негативные и guardrail-сценарии
- отсутствует knowledge source
- неполная идентичность звонящего
- задержка или outage у провайдера
- противоречивые memory facts по одному и тому же звонящему
- попытка нарушить tool sequence
- звонящий оборвал разговор в середине процесса
- invalid stream ownership
- отозванный API key
- ошибка bootstrap webhook
- invalid или expired external session token
- внешний runtime не отправил `agent_ready`
- внешний runtime не успел до timeout и звонок перешел на внутреннего агента
- попытка доступа к memory или knowledge другого workspace

### Сценарии качества
- изменение prompt pack version не ломает активные звонки
- обновления skill packs audit-логируются
- retrieval из memory всегда остается в пределах workspace
- QA jobs корректно классифицируют internal и external ownership sessions
- usage и cost metrics совпадают с provider events
- карточка звонка явно показывает requested owner, actual owner и fallback reason

## Модель монетизации и ценообразование

### Стратегия
Freemium + Usage-based pricing с подписочными тирами.

### Структура расходов на один звонок
| Компонент | Стоимость за минуту |
|-----------|-------------------|
| Twilio (voice) | ~$0.013 |
| STT (Deepgram Nova-2) | ~$0.0043 |
| LLM (Claude Sonnet / GPT-4o-mini) | ~$0.01-0.03 |
| TTS (ElevenLabs) | ~$0.02-0.04 |
| TTS (OpenAI, fallback) | ~$0.005 |
| Инфраструктура | ~$0.005 |
| **Итого (себестоимость)** | **~$0.05-0.09/мин** |

### Тарифные планы
| План | Цена | Включено минут | Сверх лимита |
|------|------|---------------|-------------|
| Free | $0 | 50 мин/мес | не доступно |
| Starter | $49/мес | 500 мин | $0.15/мин |
| Growth | $149/мес | 2000 мин | $0.12/мин |
| Business | $399/мес | 6000 мин | $0.10/мин |
| Enterprise | Custom | Custom | Custom |

### Premium features (доступны с Growth)
- Advanced analytics и QA scorecards
- External agent handoff (inbound WebSocket)
- Custom data connectors
- Priority support

### Маржинальность
Target gross margin: 60-70% на usage-based компоненте.

## Latency Budget

### Критичность
В телефонном разговоре пауза > 1.5 секунды воспринимается как "зависание". Latency — главный UX-фактор для voice AI.

### Target Latency Budget (один turn)
| Компонент | Target | Max допустимый |
|-----------|--------|---------------|
| STT (streaming, final) | 200ms | 400ms |
| LLM reasoning (first token) | 300ms | 800ms |
| TTS (streaming, first chunk) | 200ms | 400ms |
| Network + platform overhead | 100ms | 200ms |
| **Total (voice-to-voice)** | **800ms** | **1800ms** |

### Стратегия оптимизации latency
- **Streaming STT**: использовать Deepgram Nova-2 или OpenAI Realtime вместо batch transcription
- **Streaming TTS**: начинать проигрывание первого аудио-чанка до завершения полной генерации текста
- **LLM streaming**: стримить ответ LLM в TTS по мере генерации токенов
- **Filler phrases**: если latency превышает 1.5s, автоматически вставлять фразу-заполнитель ("Одну секунду...", "Let me check...")
- **Interruption detection**: определять, когда собеседник начал говорить, и немедленно останавливать TTS playback
- **Connection pre-warming**: держать persistent connections к STT/LLM/TTS провайдерам
- **Альтернативный pipeline**: рассмотреть OpenAI Realtime API как voice-to-voice альтернативу с меньшим latency

### Мониторинг
- P50, P95, P99 latency по каждому компоненту pipeline
- Алертинг при P95 > 1500ms
- Dashboard с breakdown по компонентам

## Голосовой стек (Voice Stack)

### STT (Speech-to-Text)
| Провайдер | Модель | Streaming | Latency | Цена |
|-----------|--------|-----------|---------|------|
| **Deepgram** (primary) | Nova-2 | Да | ~200ms | $0.0043/мин |
| OpenAI (fallback) | Whisper | Да (Realtime API) | ~300ms | $0.006/мин |

### LLM (Reasoning)
| Провайдер | Модель | Streaming | Latency (TTFT) | Цена (input/output) |
|-----------|--------|-----------|----------------|---------------------|
| **Anthropic** (primary) | Claude Sonnet 4.5 | Да | ~300ms | $3/$15 per 1M tokens |
| OpenAI | GPT-4o-mini | Да | ~200ms | $0.15/$0.60 per 1M tokens |
| xAI | Grok | Да | ~250ms | TBD |

### TTS (Text-to-Speech)
| Провайдер | Качество | Streaming | Latency | Цена |
|-----------|----------|-----------|---------|------|
| **ElevenLabs** (primary) | Отличное | Да | ~200ms | $0.30/1K chars |
| OpenAI TTS (fallback) | Хорошее | Да | ~250ms | $0.015/1K chars |

### Voice-to-Voice альтернатива
| Провайдер | Модель | Latency | Цена |
|-----------|--------|---------|------|
| OpenAI | Realtime API | ~500ms e2e | ~$0.06/мин |

### Архитектурные принципы
- Провайдеры выбираются на уровне Agent Profile
- Каждый компонент (STT, LLM, TTS) имеет primary и fallback провайдера
- Автоматический failover при недоступности primary
- LLM-agnostic архитектура: абстрактный интерфейс, смена провайдера через config
- Для post-call задач (summary, QA, analytics) можно использовать более дешевую модель

## Конкурентный анализ

### Прямые конкуренты
| Продукт | Тип | Сильные стороны | Слабые стороны |
|---------|-----|-----------------|----------------|
| **Vapi.ai** | Voice AI API | Хороший latency, developer-friendly API | Нет MCP, нет memory, нет skill system, нет configurable behavior stack |
| **Bland.ai** | Enterprise voice AI | Масштаб, enterprise features | Закрытый, дорогой, нет MCP, нет domain-agnostic config |
| **Retell.ai** | Low-latency voice agents | Отличный latency, хороший developer UX | Нет configurable behavior stack, нет memory system |
| **Air.ai** | Autonomous phone agent | Полностью автономные звонки | Нет external agent integration, нет MCP |
| **Synthflow** | No-code voice AI | Простота, no-code подход | Ограниченная кастомизация, нет MCP, нет memory |

### Уникальные преимущества Caller (competitive moats)
1. **MCP-first** — единственная платформа, дающая Claude/ChatGPT/любому MCP-агенту возможность звонить по телефону
2. **Conversation Ownership** — гибкость internal/external agent, уникальная архитектурная модель
3. **Memory System** — три уровня памяти, распознавание повторных звонящих, контекст из прошлых звонков
4. **Configurable Behavior Stack** — domain-agnostic через prompt/skill/knowledge packs без хардкода
5. **FixarCRM синергия** — готовый connector к CRM, готовые templates для appliance repair vertical
6. **Post-call intelligence** — analytics, QA, improvement loop встроены в платформу

### Позиционирование
Caller = "Twilio Voice + AI reasoning + MCP + configurable business behavior + memory" в одном SaaS продукте.
Не просто voice bot builder (как Synthflow), не просто voice API (как Vapi), а полноценная configurable AI phone system с MCP-интеграцией.

## Инфраструктура и технологический стек

### Backend
- **Runtime**: Node.js (TypeScript) — тесная интеграция с Twilio SDK, отличная WebSocket поддержка, streaming
- **Framework**: Fastify (production-ready, быстрее Express)
- **MCP Server**: официальный @modelcontextprotocol/sdk

### Frontend (Dashboard)
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **State**: Zustand или React Query

### Database и Storage
- **Primary DB**: PostgreSQL 16 (Supabase)
- **Vector Search**: pgvector extension (для knowledge base RAG)
- **Cache/Queue**: Redis + BullMQ (async jobs: post-call processing, analytics, memory extraction)
- **File Storage**: S3-compatible (Supabase Storage или Cloudflare R2) для recordings

### Auth и Security
- **Auth**: Supabase Auth (email + password, OAuth)
- **API Keys**: hashed storage с prefix lookup (mcp_xxxx...)
- **Secrets**: encrypted provider credentials в DB

### Realtime
- **WebSocket**: ws library (для external agent handoff)
- **Twilio MediaStream**: WebSocket-based audio streaming

### Hosting (v1)
- **Backend**: Railway или Fly.io (WebSocket support, auto-scaling)
- **Frontend**: Vercel
- **Database**: Supabase (managed PostgreSQL)
- **Monitoring**: Sentry + Axiom (logs)
- **CI/CD**: GitHub Actions

### Архитектурная диаграмма (высокий уровень)
```
External Agent (Claude/ChatGPT)
        │
        ▼
   MCP Server (Node.js)
        │
        ▼
┌──────────────────────────┐
│    Platform Core          │
│  ┌──────────────────┐    │
│  │  Call Orchestrator │    │
│  │  (Turn Manager)   │    │
│  └──────┬───────────┘    │
│         │                 │
│  ┌──────┴───────────┐    │
│  │  Behavior Stack   │    │
│  │  Resolution       │    │
│  └──────┬───────────┘    │
│         │                 │
│  ┌──────┴───────────┐    │
│  │  STT │ LLM │ TTS  │    │
│  │  Pipeline          │    │
│  └──────┬───────────┘    │
│         │                 │
│  ┌──────┴───────────┐    │
│  │  Memory │ Knowledge│    │
│  │  │ Skills │ Tools  │    │
│  └──────────────────┘    │
└────────────┬─────────────┘
             │
             ▼
        Twilio (PSTN)
             │
             ▼
         End User
```

## Onboarding Flow

### Target
Time-to-value: < 15 минут от регистрации до первого тестового звонка.

### Wizard (5 шагов)

#### Шаг 1: Workspace
- Имя компании
- Индустрия (Appliance Repair, General Service, Support, Custom)
- Часовой пояс
- Языки (EN, RU, оба)

#### Шаг 2: Телефония (Twilio)
- Guided setup: "У вас уже есть Twilio аккаунт?" → Да/Нет
- Если нет: пошаговая инструкция с скриншотами
- Ввод Account SID + Auth Token
- Проверка подключения
- Выбор или покупка номера телефона

#### Шаг 3: AI провайдер
- Ввод OpenAI API key (минимум для v1)
- Optional: ElevenLabs API key (для premium voice)
- Проверка подключения
- Выбор голоса из демо-списка

#### Шаг 4: Первый агент
- Если выбрана индустрия → предзаполненный шаблон (prompt pack + skill pack + knowledge)
- Имя агента
- Предпросмотр: "Вот как ваш агент будет представляться"
- Возможность отредактировать приветствие

#### Шаг 5: Тестовый звонок
- "Введите ваш номер телефона — мы позвоним вам прямо сейчас"
- Платформа делает тестовый исходящий звонок
- Пользователь разговаривает с только что настроенным AI
- После звонка: показать transcript и summary
- "Поздравляем! Ваш AI phone agent готов к работе."

### Post-onboarding
- Чеклист: "Что дальше?"
  - [ ] Загрузить knowledge base
  - [ ] Настроить skill packs
  - [ ] Включить входящие звонки
  - [ ] Подключить MCP к вашему агенту
  - [ ] Пригласить команду

## Стратегия FixarCRM синергии

### Интеграция
- **Built-in Data Connector**: FixarCRM MCP server как первый data connector в платформе
- Caller может читать клиентов, визиты, эстимейты, заметки из FixarCRM
- Caller может создавать визиты, обновлять лиды, добавлять заметки в FixarCRM

### Готовые templates для Appliance Repair
- **Prompt Pack**: "Appliance Repair Front Desk" — стиль receptionist, знание терминологии
- **Skill Pack**: "Appliance Repair Intake" — сбор данных о поломке, бренд, модель, симптомы
- **Skill Pack**: "Appointment Scheduling" — запись на визит через FixarCRM
- **Skill Pack**: "Follow-Up Call" — звонок после визита, feedback collection
- **Skill Pack**: "Payment Reminder" — напоминание об оплате
- **Knowledge Base Template**: типовые неисправности, pricing, service area, warranty rules

### Go-to-market
- Первые beta-клиенты — пользователи FixarCRM
- Cross-sell bundle: FixarCRM + Caller по специальной цене
- Case study из реальных данных appliance repair бизнесов

## Compliance и юридические требования

### Call Recording Laws
- **Two-party consent states** (CA, FL, IL, etc.): AI должен сообщать о записи в начале звонка
- **One-party consent states**: запись разрешена без уведомления, но рекомендуется уведомлять
- Configurable disclosure prompt: включается/выключается на уровне workspace
- Дефолт: уведомление включено ("This call may be recorded for quality purposes")

### AI Disclosure
- FTC требует раскрытия, что звонящий общается с AI
- Configurable: AI представляется как AI-assistant компании
- Нельзя делать вид, что AI — это человек

### Data Retention
- Configurable retention policies на уровне workspace
- Дефолт: recordings 90 дней, transcripts 1 год, memory бессрочно
- GDPR-ready: возможность удаления данных по запросу

## Базовые допущения
- v1 - это configurable AI phone agent SaaS, а не только raw calling API
- Default conversation owner - `internal`
- исходящие звонки поддерживают и `internal`, и `external`
- входящие звонки по умолчанию `internal`
- inbound external handoff опционален и должен включаться явно
- inbound external handoff использует `webhook + WebSocket`
- внешний агент возвращает `text + optional actions`; TTS в v1 выполняет платформа
- fallback для inbound external handoff - `internal`
- бизнес-специализация задается через prompts, skills, knowledge и memory
- Appliance Repair - это флагманский конфигурационный пример, а не захардкоженная логика

## Примечания из текущего исследования
Архитектура должна сохранить лучшие идеи, уже найденные в `FixarCRM`:

- stateful AI session handling во время звонка
- структурированное выполнение tools с правильной последовательностью действий
- configurable prompt и policy layers
- workspace-scoped knowledge base и QA subsystem
- разделение call logs и AI session logs
- строгая tenant isolation
- безопасная аутентификация MCP API key
- безопасная валидация Twilio media stream перед голосовым bridge
