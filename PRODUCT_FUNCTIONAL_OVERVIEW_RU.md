# Функциональное описание продукта: AI Phone Agent MCP Platform

## Что это за продукт
Это платформа настраиваемых AI phone agents для бизнеса. Внутри нее есть одна основная voice system с настраиваемым `conversation ownership`.

В зависимости от настроек разговор может вести:

- внутренний AI-агент платформы
- внешний AI-агент, подключенный через MCP и realtime handoff interfaces

Это не просто обертка над Twilio и не просто dashboard для анализа звонков. Это полноценная система для создания умных голосовых агентов, которые могут говорить как представитель компании, использовать знания бизнеса, помнить предыдущих звонящих, следовать инструкциям и выполнять реальные бизнес-задачи по телефону.

## Для кого этот продукт
Основная аудитория - SMB и растущие service-бизнесы, которым нужен умный AI-оператор для телефонных процессов. Примеры:

- компании по ремонту бытовой техники
- локальные сервисные компании
- support teams
- бизнесы с записью на визиты или услуги
- операционные команды, которым нужен AI-assisted или AI-handled calling
- команды, уже использующие ChatGPT, Claude или других агентов и желающие дать им возможность звонить через MCP

## Ключевая идея продукта
Каждый бизнес настраивает AI phone system с помощью:

- company profile
- prompt packs
- skill packs
- knowledge bases
- memory
- connected business data
- voice и provider settings
- escalation rules
- conversation ownership settings

Это позволяет обучить AI нужному поведению без захардкоженной логики в приложении.

Например, бизнес может создать агента для Appliance Repair, загрузить troubleshooting и pricing документы, подключить skills для записи клиентов, определить escalation rules и выбрать, кто будет вести live dialogue: внутренний агент платформы или внешний agent runtime.

## Как продукт работает end-to-end

### Общий сценарий
1. Администратор создает workspace и входит в dashboard.
2. Администратор подключает Twilio и AI-провайдеров, таких как OpenAI, xAI/Grok и ElevenLabs.
3. Администратор создает один или несколько agent profiles.
4. Администратор добавляет prompts, skills, knowledge base и настройки memory.
5. Администратор выбирает, кто по умолчанию владеет live conversation.
6. Администратор при необходимости включает inbound handoff на внешнего агента.
7. Внешние агенты могут подключаться через MCP и инициировать исходящие звонки.
8. Каждый звонок сохраняется как telephony event и как AI session.
9. После звонка платформа сохраняет записи, транскрипты, summary, analytics и обновленную memory.
10. Операторы могут просматривать звонки, слушать записи, читать транскрипты и улучшать поведение системы со временем.

## Режимы conversation ownership

### 1. Internal Platform Agent
Это режим по умолчанию и основной рекомендуемый вариант.

В этом режиме live dialogue полностью ведет внутренний агент платформы. Он использует:

- выбранный agent profile
- prompt packs
- skill packs
- knowledge retrieval
- memory
- internal tool policies

Если внешний MCP-агент запускает исходящий звонок в этом режиме, он передает:

- задачу
- цель
- контекст
- optional constraints

Далее платформа сама проводит звонок и после завершения возвращает структурированный результат.

### 2. External Calling Agent
В этом режиме логикой live dialogue управляет внешний агент.

Платформа при этом по-прежнему предоставляет:

- telephony
- dialing
- STT
- TTS
- recordings
- transcripts
- call events
- call control
- хранение артефактов

Внешний агент отвечает за:

- reasoning
- dialogue decisions
- движение к цели
- ответы
- optional structured actions

В v1 этот режим особенно важен для исходящих звонков и опционально для inbound handoff.

## Основные runtime-сценарии

### Исходящий звонок, internal ownership
Внешний MCP-capable агент просит платформу позвонить кому-то и передает цель. Внутренний phone agent платформы сам ведет разговор и потом возвращает результат.

### Исходящий звонок, external ownership
Внешний MCP-capable агент использует платформу в основном как voice и telephony infrastructure, а логикой диалога управляет собственный runtime.

### Входящий звонок, internal ownership
Входящий звонок сразу обрабатывается внутренним AI phone agent платформы.

### Входящий звонок, external handoff
Если это включено в admin settings, платформа принимает входящий звонок, запускает bootstrap webhook на внешний orchestrator и затем передает live dialogue внешнему agent runtime, если тот успевает стать ready.

## Как клиент подключает Twilio
В dashboard есть раздел telephony settings, где администратор workspace подключает свой аккаунт Twilio.

Первая версия строится по модели BYO Twilio, то есть каждый клиент использует собственный аккаунт Twilio. В настройках администратор:

- вводит Twilio credentials
- проверяет подключение
- настраивает номера телефонов
- настраивает webhook URLs
- определяет правила для входящих и исходящих звонков
- выбирает, включен ли AI-answering для конкретных номеров или маршрутов

После подключения платформа использует Twilio для обработки входящих звонков, запуска исходящих звонков и аудиостриминга.

## Как клиент подключает AI-провайдеров
В dashboard есть раздел provider settings, где клиент подключает:

- OpenAI, который используется как основной AI gateway для orchestration, reasoning, summary, QA и analytics
- xAI/Grok как дополнительный LLM provider
- ElevenLabs как voice и TTS provider

Клиент может настраивать:

- API credentials
- provider defaults
- модели по умолчанию
- голоса по умолчанию
- provider-specific overrides на уровне agent profile

Это позволяет каждому бизнесу управлять тем, как звучит AI и какие провайдеры используются в его работе.

## Как пользователь создает AI-агента
В dashboard пользователь создает `Agent Profile`.

Agent profile определяет:

- имя AI
- компанию, которую он представляет
- tone of voice и идентичность
- поддерживаемые языки
- голосовые настройки
- подключенные prompt packs
- подключенные skill packs
- доступные knowledge bases
- поведение памяти
- доступные tools
- правила эскалации

Это главный behavior object в internal mode и важная конфигурационная сущность даже тогда, когда live dialogue передается external runtime.

## Как работают prompts, skills, knowledge base и memory

### Prompt packs
Prompt packs задают общие инструкции и conversational behavior для агента.

Примеры:

- стиль представления компании
- манера приветствия
- language rules
- escalation instructions
- правила завершения звонка
- compliance instructions

Prompt packs определяют, как AI говорит и как принимает решения.

### Skill packs
Skill packs описывают, как AI обрабатывает конкретные задачи.

Примеры:

- intake для appliance repair
- перенос существующей записи
- обработка quote request
- follow-up после сервиса
- overdue payment reminder

Каждый skill pack может включать:

- какую задачу он обрабатывает
- какие данные обязательны для сбора
- последовательность tool usage
- business rules
- условия эскалации
- критерии успешного завершения

В internal mode skills напрямую влияют на live dialogue. В external mode они могут использоваться как policy references или structured guidance, но live reasoning loop принадлежит внешнему агенту.

### Knowledge base
Knowledge base содержит загруженную или управляемую информацию, которую AI может использовать во время звонков.

Примеры:

- прайс-листы
- FAQ
- warranty rules
- repair troubleshooting guides
- company policies
- информация о service area

AI может извлекать релевантную информацию из этих источников в процессе разговора.

### Memory
Memory позволяет системе помнить предыдущих звонящих и прошлые взаимодействия.

Примеры memory:

- кто звонил раньше
- по какой проблеме звонили
- была ли уже запись на визит
- обещал ли кто-то перезвонить
- прошлые summaries звонков
- незакрытые вопросы

Благодаря этому платформа ведет себя как умная voice system, а не как одноразовый бот.

## Как работает память по повторным звонящим
Когда начинается звонок, платформа проверяет личность звонящего по нормализованному номеру телефона и связанной истории. Если человек уже обращался ранее, система может загрузить:

- личность звонящего
- summaries последних звонков
- недавние проблемы
- незавершенные action items
- контекст предыдущих appointments
- релевантные memory facts

После завершения звонка система обновляет память, сохраняя:

- transcript
- summary
- структурированные факты
- данные обещания
- следующие шаги
- незакрытые вопросы

Это работает вне зависимости от того, кто вел разговор: внутренний или внешний агент.

## Как продукт подключается к MCP
Платформа предоставляет MCP server, который может использоваться совместимыми внешними агентами.

Внешний AI-агент аутентифицируется через workspace API key и далее вызывает tools платформы. В первой версии MCP ориентирован в первую очередь на runtime-использование, а не на полное администрирование.

Основной MCP flow:

1. Внешний агент подключается к MCP server.
2. Он аутентифицируется через workspace API key.
3. Он вызывает основной high-level tool для запуска звонка.
4. Платформа определяет, какой conversation ownership mode должен быть использован.
5. Внешний агент затем может проверять статус звонка и получать артефакты.

## MCP-функции
В первой версии MCP должен оставаться небольшим и понятным.

Основные функции:

- `start_call`
- `get_call_status`
- `get_call_artifacts`
- `list_recent_calls`

Эти функции позволяют внешнему агенту:

- запустить звонок
- указать номер телефона
- при необходимости выбрать agent profile
- задать objective или instructions
- понимать, какой ownership mode был использован
- отслеживать выполнение
- получать recording, transcript, summary и analytics после завершения звонка

## Как работают входящие звонки
Платформа поддерживает два варианта обработки входящих звонков.

### Стандартная inbound-обработка
Если AI-answering включен, входящие звонки может обрабатывать внутренний AI phone agent.

Внутренний агент при этом:

- знает, от имени какой компании он говорит
- загружает нужный agent profile
- использует правильный голос
- применяет нужные prompts и skills
- проверяет, знаком ли ему звонящий
- загружает memory и релевантные knowledge sources
- ведет диалог
- выполняет разрешенные действия
- при необходимости эскалирует вызов человеку

### Inbound handoff на внешнего агента
Если администратор включает `Allow Inbound Calls To External Agent`, inbound flow меняется:

1. Платформа получает входящий звонок.
2. Платформа отправляет bootstrap webhook во внешний orchestrator.
3. В webhook передаются call metadata и одноразовый session token.
4. Внешний orchestrator запускает или выбирает external agent runtime.
5. External runtime подключается к платформе по WebSocket.
6. Платформа стримит в реальном времени transcript и call events.
7. Внешний агент возвращает текстовые ответы и optional structured actions.
8. Платформа превращает текст в речь и проигрывает его в звонок.

Если внешний агент не становится ready до timeout, платформа переключает звонок на внутреннего AI phone agent.

## Как работают исходящие звонки
Исходящие звонки могут запускаться несколькими способами:

- внешним MCP-совместимым агентом
- вручную из dashboard
- из workflow или очереди
- в будущем из automation rules

При исходящем звонке платформа:

- выбирает правильную идентичность и номер компании
- загружает выбранный agent profile
- применяет цель звонка
- инициирует звонок через Twilio
- определяет, кто владеет live dialogue
- сохраняет все артефакты и аналитику после завершения

В internal mode разговор полностью ведет сама платформа.

В external mode внешний агент получает transcript и event data и возвращает ответы, а платформа управляет телефонией и speech synthesis.

## Realtime protocol для external ownership
Когда включен external ownership, платформа становится telephony и voice runtime.

От платформы к внешнему runtime:

- call lifecycle events
- caller metadata
- transcript deltas
- final transcript segments
- speaker turn changes
- silence and interruption markers
- optional memory context

От внешнего runtime к платформе:

- readiness signal
- reply text
- optional structured actions
- optional control commands, например hangup или transfer
- heartbeat

В v1 TTS остается ответственностью платформы. Внешний агент возвращает текст, а не raw audio.

## Что пользователь может делать в dashboard

### Workspace settings
Здесь находятся общие настройки workspace: имя, бренд, дефолты и глобальные политики.

### Telephony settings
Здесь подключается и управляется Twilio, настраиваются номера телефонов, а также логика входящих и исходящих звонков.

### Conversation ownership settings
Это один из ключевых runtime-разделов.

Администратор может настраивать:

- `Default Conversation Owner`
- `Allow Inbound Calls To External Agent`
- inbound external webhook URL
- inbound external auth secret
- external readiness timeout
- fallback behavior

### AI provider settings
Здесь подключаются OpenAI, xAI/Grok и ElevenLabs, задаются дефолтные модели и выполняется проверка соединения.

### Agent profiles
Здесь создаются и редактируются AI phone agents для разных задач.

Примеры:

- front desk agent
- appliance repair intake agent
- support follow-up agent
- billing reminder agent

### Prompt packs
Здесь задается, как AI должен говорить и вести себя в разных сценариях.

### Skill packs
Здесь задается task-specific behavior для бизнес-процессов.

### Knowledge base
Здесь загружаются и управляются документы и reference content, которые AI может использовать во время звонков.

### Memory settings
Здесь настраивается, как работает memory звонящих и разговоров, как долго она хранится и какие данные извлекаются из звонков.

### Data connectors
Здесь подключаются внутренние и внешние источники данных, к которым AI получает доступ через управляемые tools.

### API keys
Здесь создаются и отзываются MCP keys для внешних агентов и систем.

### Calls and analytics
Здесь просматривается история звонков, прослушиваются записи, читаются транскрипты, summaries и аналитика, а также видно, какой ownership mode использовался.

### Retention and webhooks
Здесь задаются правила хранения данных и отправки событий во внешние системы.

### Audit logs
Здесь можно смотреть важные изменения настроек, credentials, API keys и behavior definitions.

## Как работает review звонков
Операторы могут открыть список звонков и фильтровать его по:

- дате
- статусу
- направлению
- звонящему
- номеру телефона
- agent profile
- conversation ownership mode
- результату

Открыв карточку звонка, пользователь может:

- прослушать запись
- прочитать transcript
- прочитать generated summary
- увидеть extracted action items
- просмотреть важные события звонка
- посмотреть tool calls, сделанные во время разговора
- увидеть escalation events
- изучить QA и analytics
- посмотреть предыдущие взаимодействия с этим же звонящим
- увидеть, кто вел разговор: internal или external runtime
- увидеть fallback reason, если inbound external handoff не состоялся

Это дает полноценный операционный обзор того, как был обработан звонок.

## Как используются записи и транскрипты
Каждый завершенный звонок может породить:

- ссылку на запись
- transcript
- summary
- извлеченные факты
- QA-анализ
- обновления memory

Пользователь должен иметь возможность:

- проиграть запись прямо из dashboard
- просмотреть transcript построчно
- искать ключевые слова
- сравнивать недавние звонки одного и того же клиента
- использовать analytics для улучшения prompts и skills
- понимать, какой агент вел звонок: внутренний или внешний

## Типовые пользовательские сценарии

### 1. Новый workspace
Пользователь создает workspace, входит в систему и открывает dashboard.

### 2. Подключение телефонии и провайдеров
Пользователь подключает Twilio, затем добавляет OpenAI, xAI/Grok при необходимости и ElevenLabs.

### 3. Создание первого agent profile
Пользователь создает AI phone agent, задает имя, идентичность компании, голос и языковые настройки.

### 4. Добавление prompts, skills и knowledge
Пользователь загружает документы, задает операционные инструкции и подключает skill packs, например Appliance Repair Intake или Rescheduling.

### 5. Выбор conversation ownership
Пользователь выбирает, кто по умолчанию будет вести live calls: внутренний агент платформы или внешний calling agent.

### 6. Включение inbound external handoff при необходимости
Пользователь при желании включает inbound external handoff и задает webhook, auth, timeout и fallback settings.

### 7. Запуск исходящего звонка через MCP
Пользователь просит ChatGPT или другого MCP-capable агента позвонить клиенту через платформу.

### 8. Review завершенного звонка
Пользователь открывает карточку звонка, слушает запись, читает transcript, summary и analytics.

### 9. Улучшение системы
Если качество звонка было низким, пользователь обновляет prompt packs, skill packs, knowledge sources, escalation rules или ownership settings и пробует снова.

## Пример: Appliance Repair
Компания по ремонту бытовой техники может настроить систему так, чтобы AI:

- отвечал как receptionist компании
- узнавал существующих клиентов по прошлым звонкам
- спрашивал, какая техника сломалась
- спрашивал, в чем проблема
- использовал pricing и diagnostic fee policies
- обращался к knowledge base по типовым неисправностям
- записывал клиента или делал follow-up, если это разрешено
- эскалировал billing complaints или сложные ситуации живому сотруднику

Та же компания может выбрать:

- internal ownership для полностью platform-run receptionist
- external ownership для кастомного ChatGPT- или Claude-powered dialogue runtime
- inbound external handoff для продвинутой realtime integration

Такое поведение должно задаваться через конфигурацию, а не через кастомный код под одну вертикаль.

## Аналитика и QA
Платформа нужна не только для живых разговоров. Она также анализирует звонки после завершения.

Система должна поддерживать:

- summary generation
- action item extraction
- sentiment или quality flags
- QA scorecards
- trend reporting
- review workflows для операторов
- insights для улучшения prompts, skills и knowledge
- видимость качества internal и external ownership modes

Это позволяет командам постоянно повышать качество работы AI phone system.

## Безопасность и SaaS-модель
Продукт проектируется как мультиарендный SaaS.

Ключевые свойства:

- каждый workspace изолирован от других
- provider credentials хранятся безопасно
- MCP API keys управляются на уровне workspace
- доступ к данным контролируется ролями
- call artifacts остаются внутри границ workspace
- audit logs фиксируют важные изменения
- external inbound handoff использует signed webhook requests и one-time session tokens

## Что делает продукт особенным
- Он работает и как MCP capability, и как автономный AI phone operator.
- Он поддерживает настраиваемый conversation ownership между internal и external agents.
- Он умеет передавать входящие звонки внешнему агенту в реальном времени через webhook и WebSocket.
- Он настраивается через prompts, skills, knowledge и memory, а не через захардкоженные сценарии.
- Он умеет помнить предыдущих звонящих и продолжать контекст.
- Он подходит для реальных бизнес-процессов, а не только для voice demo.
- Он дает операторам полноценный цикл review и постоянного улучшения.

## Модель ценообразования

### Для кого бесплатно
Бесплатный план дает 50 минут звонков в месяц. Этого достаточно для тестирования и настройки. Бесплатный план не включает advanced analytics, QA и external agent handoff.

### Платные планы
| План | Цена | Минуты | Для кого |
|------|------|--------|----------|
| Free | $0/мес | 50 | Тестирование, настройка |
| Starter | $49/мес | 500 | Малый бизнес, 1-2 агента |
| Growth | $149/мес | 2000 | Растущий бизнес, analytics, QA |
| Business | $399/мес | 6000 | Масштабный бизнес, external handoff |

Сверх включенных минут — дополнительная оплата за минуту ($0.10-0.15 в зависимости от плана).

### Что входит в стоимость минуты
Платформа берет на себя все расходы на провайдеров (Twilio, STT, LLM, TTS) и включает их в стоимость тарифа. Клиент при этом подключает свои API ключи провайдеров (BYO keys). В будущем возможен вариант managed keys с markup.

## Как работает голосовой pipeline

### Общий flow одного turn
1. Собеседник говорит в телефон
2. Twilio стримит аудио на платформу через WebSocket (MediaStream)
3. Платформа передает аудио в STT-провайдер (streaming)
4. STT возвращает распознанный текст (partial → final)
5. Финальный текст отправляется в LLM вместе с контекстом (behavior stack, memory, history)
6. LLM генерирует ответ (streaming)
7. Текст ответа передается в TTS-провайдер (streaming)
8. TTS возвращает аудио-чанки
9. Платформа проигрывает аудио обратно в звонок через Twilio

### Target latency
Весь цикл от момента, когда собеседник закончил фразу, до начала ответа AI должен занимать менее 1 секунды (target) и не более 1.8 секунды (max).

Если ответ задерживается более 1.5 секунд, платформа автоматически вставляет filler phrase ("Одну секунду...", "Let me check...").

### Провайдеры
- **STT**: Deepgram Nova-2 (primary), OpenAI Whisper (fallback)
- **LLM**: Claude Sonnet (primary), GPT-4o-mini (economy), xAI Grok (optional)
- **TTS**: ElevenLabs (premium quality), OpenAI TTS (economy fallback)

Провайдеры выбираются на уровне Agent Profile. Каждый компонент имеет primary и fallback.

### Interruption handling
Если собеседник начинает говорить во время ответа AI, платформа:
1. Немедленно останавливает TTS playback
2. Начинает слушать нового говорящего
3. Обрабатывает новую фразу как следующий turn

## Как работает onboarding нового клиента

### Цель
Менее 15 минут от регистрации до первого тестового звонка.

### Шаги
1. **Создание workspace** — имя компании, индустрия, языки
2. **Подключение Twilio** — guided setup с пошаговой инструкцией
3. **Подключение AI провайдера** — ввод API ключа OpenAI, проверка
4. **Создание первого агента** — шаблон по индустрии или с нуля
5. **Тестовый звонок** — платформа звонит пользователю, он разговаривает с AI, видит transcript и summary

### Шаблоны по индустриям
При выборе индустрии на первом шаге платформа предлагает готовый набор:
- предзаполненный prompt pack
- подходящие skill packs
- базовую knowledge base template
- рекомендуемые настройки голоса

Например, для Appliance Repair: prompt pack с стилем receptionist, skill для intake заявки, knowledge base с типовыми неисправностями.

## Интеграция с FixarCRM

### Что дает интеграция
Caller может подключаться к FixarCRM как data connector и использовать его данные во время звонков.

AI во время разговора может:
- найти клиента по номеру телефона
- посмотреть историю визитов и эстимейтов
- создать новый визит или обновить существующий
- добавить заметку в timeline
- проверить статус оплаты

### Готовые Appliance Repair templates
- **Prompt Pack** "Appliance Repair Front Desk" — стиль receptionist
- **Skill Pack** "Intake" — сбор данных о поломке
- **Skill Pack** "Scheduling" — запись на визит
- **Skill Pack** "Follow-Up" — звонок после визита
- **Skill Pack** "Payment Reminder" — напоминание об оплате
- **Knowledge Base** — типовые неисправности, pricing, service area

## Compliance и юридические аспекты

### Запись звонков
В зависимости от штата/страны могут требоваться разные уровни consent для записи. Платформа поддерживает:
- configurable disclosure prompt в начале звонка
- включение/выключение записи на уровне workspace
- дефолт: уведомление о записи включено

### AI Disclosure
AI должен представляться как AI-assistant компании. Платформа не позволяет AI выдавать себя за человека.

### Data Retention
- Configurable retention policies
- Дефолт: recordings 90 дней, transcripts 1 год
- Возможность удаления данных по запросу (GDPR-ready)

## Scope и ограничения v1
Первая версия фокусируется на:

- B2B SaaS
- SMB service businesses
- входящих и исходящих звонках
- BYO Twilio
- OpenAI как primary AI gateway
- xAI/Grok как optional LLM
- ElevenLabs для voice
- English и Russian
- настройке через dashboard
- MCP runtime usage для внешних агентов
- workspace-level conversation ownership settings
- webhook + WebSocket external inbound handoff

Скорее всего будут отложены или упрощены:

- глубокие CRM integrations beyond webhooks
- enterprise SSO
- требования для жестко регулируемых индустрий
- large-scale campaign management
- широкая мультиязычность beyond initial focus
- mid-call ownership switching после фактического начала разговора

## Итог
Это configurable AI phone-agent platform, которая позволяет бизнесам и внешним AI-агентам использовать телефон как умную, memory-backed, knowledge-driven capability. Она объединяет телефонию, MCP-доступ, prompts, skills, knowledge, memory, conversation ownership controls, analytics и operator tooling в одном SaaS-продукте, чтобы компании могли создавать действительно умных голосовых агентов без захардкоженной бизнес-логики.
