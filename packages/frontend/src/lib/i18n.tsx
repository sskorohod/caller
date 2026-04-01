'use client';
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// ─── Dictionaries ────────────────────────────────────────────────────────────

const en: Record<string, string> = {
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.retry': 'Retry',
  'common.back': 'Back',
  'common.search': 'Search...',
  'common.noResults': 'No results',
  'common.confirm': 'Confirm',
  'common.yes': 'Yes',
  'common.no': 'No',

  // Nav
  'nav.overview': 'Overview',
  'nav.calls': 'Calls',
  'nav.agents': 'Agents',
  'nav.knowledge': 'Knowledge',
  'nav.prompts': 'Prompts',
  'nav.skills': 'Skills',
  'nav.connectors': 'Connectors',
  'nav.settings': 'Settings',

  // Dashboard
  'dashboard.greeting': 'Good {{timeOfDay}}, {{name}}',
  'dashboard.subtitle': "Here's what's happening with your AI phone agents.",
  'dashboard.totalCalls': 'Total Calls',
  'dashboard.activeNow': 'Active Now',
  'dashboard.minutesUsed': 'Minutes Used',
  'dashboard.agents': 'Agents',
  'dashboard.recentCalls': 'Recent Calls',
  'dashboard.viewAll': 'View all',
  'dashboard.noCalls': 'No calls yet',
  'dashboard.noCallsDesc': 'Connect Twilio and create an agent to start making AI-powered calls.',
  'dashboard.callsThisWeek': 'Calls This Week',
  'dashboard.allTime': 'All time',
  'dashboard.inProgress': 'In progress',
  'dashboard.thisSession': 'This session',
  'dashboard.configureBelow': 'Configure below',
  'dashboard.phoneNumber': 'Phone Number',
  'dashboard.direction': 'Direction',
  'dashboard.status': 'Status',
  'dashboard.duration': 'Duration',
  'dashboard.date': 'Date',

  // Time of day
  'time.morning': 'morning',
  'time.afternoon': 'afternoon',
  'time.evening': 'evening',

  // Agents
  'agents.title': 'AI Agents',
  'agents.subtitle': 'Configure your AI phone agents',
  'agents.newAgent': 'New Agent',
  'agents.noAgents': 'No agents yet',
  'agents.noAgentsDesc': 'Create your first AI phone agent',
  'agents.createAgent': 'Create Agent',
  'agents.editAgent': 'Edit Agent',
  'agents.newAIAgent': 'New AI Agent',
  'agents.deleteAgent': 'Delete agent',
  'agents.deleteConfirm': 'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
  'agents.agentName': 'Agent Name',
  'agents.llmProvider': 'LLM Provider',
  'agents.voiceProvider': 'Voice Provider',
  'agents.voice': 'Voice',
  'agents.model': 'Model',
  'agents.systemPrompt': 'System Prompt',
  'agents.firstMessage': 'First Message',
  'agents.saveChanges': 'Save Changes',
  'agents.saving': 'Saving...',

  // Calls
  'calls.title': 'Calls',
  'calls.subtitle': 'Call history and transcripts',
  'calls.phone': 'Phone Number',
  'calls.direction': 'Direction',
  'calls.status': 'Status',
  'calls.duration': 'Duration',
  'calls.date': 'Date',
  'calls.inbound': 'In',
  'calls.outbound': 'Out',
  'calls.loadMore': 'Load More',
  'calls.remaining': 'remaining',
  'calls.callDetail': 'Call Details',
  'calls.summary': 'AI Summary',
  'calls.actionItems': 'Action Items',
  'calls.recording': 'Recording',
  'calls.transcript': 'Transcript',
  'calls.noTranscript': 'No transcript available',
  'calls.noCalls': 'No calls found',
  'calls.noCallsHint': 'Try adjusting your filters',
  'calls.allCalls': 'All calls',
  'calls.inboundFilter': 'Inbound',
  'calls.outboundFilter': 'Outbound',
  'calls.completedFilter': 'Completed',
  'calls.failedFilter': 'Failed',
  'calls.results': 'results',
  'calls.totalCalls': '{{count}} total calls',
  'calls.callsLoaded': '{{count}} calls loaded',
  'calls.details': 'Details',
  'calls.loadingDetails': 'Loading details...',
  'calls.searchPhone': 'Search by phone number...',

  // Knowledge
  'knowledge.title': 'Knowledge Bases',
  'knowledge.subtitle': 'RAG-powered knowledge for your AI agents',
  'knowledge.newKB': 'New Knowledge Base',
  'knowledge.addDoc': 'Add Document',
  'knowledge.documents': 'Documents',
  'knowledge.docTitle': 'Title',
  'knowledge.docContent': 'Content',
  'knowledge.docType': 'Type',
  'knowledge.noBases': 'No knowledge bases yet',
  'knowledge.noBasesDesc': 'Upload documents and FAQs for your agents',
  'knowledge.createKB': 'Create Knowledge Base',
  'knowledge.name': 'Name',
  'knowledge.description': 'Description',
  'knowledge.creating': 'Creating...',
  'knowledge.noDocs': 'No documents yet',
  'knowledge.noDocsDesc': 'Add documents to this knowledge base',
  'knowledge.adding': 'Adding...',
  'knowledge.created': 'Created',
  'knowledge.docs': 'docs',

  // Prompts
  'prompts.title': 'Prompt Packs',
  'prompts.subtitle': 'Reusable prompt templates for your agents',
  'prompts.newPack': 'New Prompt Pack',
  'prompts.noPacks': 'No prompt packs yet',
  'prompts.noPacksDesc': 'Create reusable prompt templates',
  'prompts.createPack': 'Create Prompt Pack',
  'prompts.editPack': 'Edit Prompt Pack',
  'prompts.deletePack': 'Delete prompt pack',
  'prompts.deleteConfirm': 'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
  'prompts.name': 'Name',
  'prompts.description': 'Description',
  'prompts.category': 'Category',
  'prompts.noCategory': 'No category',
  'prompts.content': 'Content',
  'prompts.saving': 'Saving...',
  'prompts.saveChanges': 'Save Changes',

  // Skills
  'skills.title': 'Skill Packs',
  'skills.subtitle': 'Define skills and conversation flows for agents',
  'skills.newPack': 'New Skill Pack',
  'skills.noPacks': 'No skill packs yet',
  'skills.noPacksDesc': 'Define conversation skills for your agents',
  'skills.createPack': 'Create Skill Pack',
  'skills.editPack': 'Edit Skill Pack',
  'skills.deletePack': 'Delete skill pack',
  'skills.deleteConfirm': 'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
  'skills.name': 'Name',
  'skills.description': 'Description',
  'skills.intent': 'Intent',
  'skills.conversationRules': 'Conversation Rules',
  'skills.advancedJSON': 'Advanced Fields (JSON)',
  'skills.saving': 'Saving...',
  'skills.saveChanges': 'Save Changes',

  // Connectors
  'connectors.title': 'Data Connectors',
  'connectors.subtitle': 'Connect external APIs and CRM systems',
  'connectors.newConnector': 'New Connector',
  'connectors.noConnectors': 'No connectors yet',
  'connectors.noConnectorsDesc': 'Connect your CRM, APIs and external data sources',
  'connectors.createConnector': 'Create Connector',
  'connectors.editConnector': 'Edit Connector',
  'connectors.deleteConnector': 'Delete connector',
  'connectors.deleteConfirm': 'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
  'connectors.name': 'Name',
  'connectors.type': 'Type',
  'connectors.baseUrl': 'Base URL',
  'connectors.authType': 'Auth Type',
  'connectors.authValue': 'Auth Value',
  'connectors.headerName': 'Header Name',
  'connectors.testConnection': 'Test Connection',
  'connectors.testing': 'Testing...',
  'connectors.active': 'Active',
  'connectors.inactive': 'Inactive',
  'connectors.lastSynced': 'Last synced',
  'connectors.noUrl': 'No URL configured',
  'connectors.saving': 'Saving...',
  'connectors.saveChanges': 'Save Changes',

  // Settings
  'settings.title': 'Settings',
  'settings.general': 'General',
  'settings.providers': 'Providers',
  'settings.apiKeys': 'API Keys',
  'settings.oauth': 'OAuth Apps',
  'settings.compliance': 'Compliance',
  'settings.language': 'Language',
  'settings.workspaceSettings': 'Workspace Settings',
  'settings.workspaceName': 'Workspace Name',
  'settings.industry': 'Industry',
  'settings.selectIndustry': 'Select industry...',
  'settings.timezone': 'Timezone',
  'settings.selectTimezone': 'Select timezone...',
  'settings.defaultConversationOwner': 'Default Conversation Owner',
  'settings.convOwnerHint': 'Controls who manages conversations by default. External mode requires an MCP agent to be connected.',
  'settings.internalAgent': 'Internal Platform Agent',
  'settings.externalAgent': 'External Calling Agent (MCP)',
  'settings.saveChanges': 'Save Changes',
  'settings.saving': 'Saving...',
  'settings.saved': 'Saved',
  'settings.notConfigured': 'Not configured',
  'settings.connected': 'Connected',
  'settings.update': 'Update',
  'settings.saveConnect': 'Save & Connect',
  'settings.removing': 'Removing...',
  'settings.confirm': 'Confirm',
  'settings.enterCredential': 'Enter at least one credential field.',
  'settings.providerCredentials': 'Provider Credentials',
  'settings.twilioPhones': 'Twilio Phone Numbers',
  'settings.phonesHint': 'Available phone numbers from your Twilio account. Enable inbound/outbound for each.',
  'settings.loadPhones': 'Load Numbers',
  'settings.loadingPhones': 'Loading...',
  'settings.noPhones': 'No phone numbers found in your Twilio account.',
  'settings.connectTwilioFirst': 'Connect Twilio credentials above to manage phone numbers.',
  'settings.inbound': 'Inbound',
  'settings.outbound': 'Outbound',
  'settings.complianceSettings': 'Compliance & Safety',
  'settings.callRecordingDisclosure': 'Call Recording Disclosure',
  'settings.callRecordingHint': 'Agent will inform callers that calls are recorded.',
  'settings.aiDisclosure': 'AI Disclosure',
  'settings.aiDisclosureHint': 'Agent will disclose that the caller is speaking with an AI.',
  'settings.allowInboundHandoff': 'Allow Inbound External Handoff',
  'settings.allowInboundHandoffHint': 'Allow external MCP agents to handle inbound calls.',
  'settings.createApiKey': 'Create API Key',
  'settings.newApiKey': 'New API Key',
  'settings.keyName': 'Key Name',
  'settings.keyNamePlaceholder': 'Production key',
  'settings.generate': 'Generate',
  'settings.generating': 'Generating...',
  'settings.copyWarning': 'Copy this key now. You will not be able to see it again.',
  'settings.copied': 'Copied!',
  'settings.noApiKeys': 'No API keys yet. Create one to authenticate external services.',
  'settings.revoked': 'Revoked',
  'settings.revoke': 'Revoke',
  'settings.created': 'Created',
  'settings.lastUsed': 'Last used',
  'settings.never': 'Never',
  'settings.createOAuth': 'Create OAuth App',
  'settings.newOAuthApp': 'New OAuth App',
  'settings.appName': 'App Name',
  'settings.appNamePlaceholder': 'My Integration',
  'settings.redirectUri': 'Redirect URI',
  'settings.redirectUriPlaceholder': 'https://myapp.com/callback',
  'settings.creating': 'Creating...',
  'settings.noOAuthApps': 'No OAuth apps yet. Create one for third-party integrations.',
  'settings.clientId': 'Client ID',
  'settings.clientSecret': 'Client Secret',
  'settings.redirectUris': 'Redirect URIs',

  // Login
  'login.signIn': 'Sign In',
  'login.createAccount': 'Create Account',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.workspaceName': 'Workspace Name',
  'login.pleaseWait': 'Please wait...',
  'login.signOut': 'Sign out',
  'login.copyright': 'AI Phone Agent Platform',

  // Error pages
  'error.title': 'Something went wrong',
  'error.fallback': 'An unexpected error occurred. Please try again.',
  'error.tryAgain': 'Try again',
  'notFound.code': '404',
  'notFound.title': 'Page not found',
  'notFound.description': 'The page you are looking for does not exist or has been moved.',
  'notFound.backToDashboard': 'Back to Dashboard',

  // OAuth consent
  'oauth.authError': 'Authorization Error',
  'oauth.invalidRequest': 'Invalid authorization request -- missing required parameters.',
  'oauth.wantsToConnect': 'wants to connect to',
  'oauth.yourWorkspace': 'your workspace',
  'oauth.thisAppWillBeAbleTo': 'This app will be able to',
  'oauth.perm.calls': 'Start and manage phone calls',
  'oauth.perm.history': 'Read call history and transcripts',
  'oauth.perm.agents': 'Access your AI agents',
  'oauth.perm.memory': 'Read caller memory and profiles',
  'oauth.deny': 'Deny',
  'oauth.allowAccess': 'Allow Access',
  'oauth.authorizing': 'Authorizing...',
  'oauth.consentNotice': 'By clicking Allow Access, you grant {{appName}} permission to access your Caller workspace on your behalf.',
  'oauth.authFailed': 'Authorization failed',
};

const ru: Record<string, string> = {
  // Common
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.delete': 'Удалить',
  'common.edit': 'Редактировать',
  'common.create': 'Создать',
  'common.loading': 'Загрузка...',
  'common.error': 'Ошибка',
  'common.retry': 'Повторить',
  'common.back': 'Назад',
  'common.search': 'Поиск...',
  'common.noResults': 'Ничего не найдено',
  'common.confirm': 'Подтвердить',
  'common.yes': 'Да',
  'common.no': 'Нет',

  // Nav
  'nav.overview': 'Обзор',
  'nav.calls': 'Звонки',
  'nav.agents': 'Агенты',
  'nav.knowledge': 'Знания',
  'nav.prompts': 'Промпты',
  'nav.skills': 'Навыки',
  'nav.connectors': 'Коннекторы',
  'nav.settings': 'Настройки',

  // Dashboard
  'dashboard.greeting': 'Добрый {{timeOfDay}}, {{name}}',
  'dashboard.subtitle': 'Вот что происходит с вашими ИИ-агентами.',
  'dashboard.totalCalls': 'Всего звонков',
  'dashboard.activeNow': 'Активных сейчас',
  'dashboard.minutesUsed': 'Минут использовано',
  'dashboard.agents': 'Агентов',
  'dashboard.recentCalls': 'Последние звонки',
  'dashboard.viewAll': 'Все звонки',
  'dashboard.noCalls': 'Звонков пока нет',
  'dashboard.noCallsDesc': 'Подключите Twilio и создайте агента для начала работы.',
  'dashboard.callsThisWeek': 'Звонки за неделю',
  'dashboard.allTime': 'За всё время',
  'dashboard.inProgress': 'В процессе',
  'dashboard.thisSession': 'Эта сессия',
  'dashboard.configureBelow': 'Настроить ниже',
  'dashboard.phoneNumber': 'Номер телефона',
  'dashboard.direction': 'Направление',
  'dashboard.status': 'Статус',
  'dashboard.duration': 'Длительность',
  'dashboard.date': 'Дата',

  // Time of day
  'time.morning': 'день',
  'time.afternoon': 'день',
  'time.evening': 'вечер',

  // Agents
  'agents.title': 'ИИ Агенты',
  'agents.subtitle': 'Настройка телефонных агентов',
  'agents.newAgent': 'Новый агент',
  'agents.noAgents': 'Агентов пока нет',
  'agents.noAgentsDesc': 'Создайте вашего первого ИИ-агента',
  'agents.createAgent': 'Создать агента',
  'agents.editAgent': 'Редактировать агента',
  'agents.newAIAgent': 'Новый ИИ-агент',
  'agents.deleteAgent': 'Удалить агента',
  'agents.deleteConfirm': 'Вы уверены, что хотите удалить "{{name}}"? Это действие нельзя отменить.',
  'agents.agentName': 'Имя агента',
  'agents.llmProvider': 'ИИ Провайдер',
  'agents.voiceProvider': 'Провайдер голоса',
  'agents.voice': 'Голос',
  'agents.model': 'Модель',
  'agents.systemPrompt': 'Системный промпт',
  'agents.firstMessage': 'Первое сообщение',
  'agents.saveChanges': 'Сохранить изменения',
  'agents.saving': 'Сохранение...',

  // Calls
  'calls.title': 'Звонки',
  'calls.subtitle': 'История звонков и транскрипты',
  'calls.phone': 'Номер телефона',
  'calls.direction': 'Направление',
  'calls.status': 'Статус',
  'calls.duration': 'Длительность',
  'calls.date': 'Дата',
  'calls.inbound': 'Вх',
  'calls.outbound': 'Исх',
  'calls.loadMore': 'Загрузить ещё',
  'calls.remaining': 'осталось',
  'calls.callDetail': 'Детали звонка',
  'calls.summary': 'Итог ИИ',
  'calls.actionItems': 'Задачи',
  'calls.recording': 'Запись',
  'calls.transcript': 'Транскрипт',
  'calls.noTranscript': 'Транскрипт недоступен',
  'calls.noCalls': 'Звонков не найдено',
  'calls.noCallsHint': 'Попробуйте изменить фильтры',
  'calls.allCalls': 'Все звонки',
  'calls.inboundFilter': 'Входящие',
  'calls.outboundFilter': 'Исходящие',
  'calls.completedFilter': 'Завершённые',
  'calls.failedFilter': 'Неудачные',
  'calls.results': 'результатов',
  'calls.totalCalls': '{{count}} звонков всего',
  'calls.callsLoaded': '{{count}} звонков загружено',
  'calls.details': 'Детали',
  'calls.loadingDetails': 'Загрузка деталей...',
  'calls.searchPhone': 'Поиск по номеру телефона...',

  // Knowledge
  'knowledge.title': 'Базы знаний',
  'knowledge.subtitle': 'RAG-знания для ваших ИИ-агентов',
  'knowledge.newKB': 'Новая база знаний',
  'knowledge.addDoc': 'Добавить документ',
  'knowledge.documents': 'Документы',
  'knowledge.docTitle': 'Заголовок',
  'knowledge.docContent': 'Содержание',
  'knowledge.docType': 'Тип',
  'knowledge.noBases': 'Баз знаний пока нет',
  'knowledge.noBasesDesc': 'Загрузите документы и FAQ для агентов',
  'knowledge.createKB': 'Создать базу знаний',
  'knowledge.name': 'Название',
  'knowledge.description': 'Описание',
  'knowledge.creating': 'Создание...',
  'knowledge.noDocs': 'Документов пока нет',
  'knowledge.noDocsDesc': 'Добавьте документы в базу знаний',
  'knowledge.adding': 'Добавление...',
  'knowledge.created': 'Создано',
  'knowledge.docs': 'док.',

  // Prompts
  'prompts.title': 'Промпт-паки',
  'prompts.subtitle': 'Переиспользуемые шаблоны промптов',
  'prompts.newPack': 'Новый промпт-пак',
  'prompts.noPacks': 'Промпт-паков пока нет',
  'prompts.noPacksDesc': 'Создайте переиспользуемые шаблоны',
  'prompts.createPack': 'Создать промпт-пак',
  'prompts.editPack': 'Редактировать промпт-пак',
  'prompts.deletePack': 'Удалить промпт-пак',
  'prompts.deleteConfirm': 'Вы уверены, что хотите удалить "{{name}}"? Это действие нельзя отменить.',
  'prompts.name': 'Название',
  'prompts.description': 'Описание',
  'prompts.category': 'Категория',
  'prompts.noCategory': 'Без категории',
  'prompts.content': 'Содержание',
  'prompts.saving': 'Сохранение...',
  'prompts.saveChanges': 'Сохранить изменения',

  // Skills
  'skills.title': 'Навыки',
  'skills.subtitle': 'Навыки и сценарии разговоров для агентов',
  'skills.newPack': 'Новый навык',
  'skills.noPacks': 'Навыков пока нет',
  'skills.noPacksDesc': 'Определите навыки для ваших агентов',
  'skills.createPack': 'Создать навык',
  'skills.editPack': 'Редактировать навык',
  'skills.deletePack': 'Удалить навык',
  'skills.deleteConfirm': 'Вы уверены, что хотите удалить "{{name}}"? Это действие нельзя отменить.',
  'skills.name': 'Название',
  'skills.description': 'Описание',
  'skills.intent': 'Интент',
  'skills.conversationRules': 'Правила разговора',
  'skills.advancedJSON': 'Расширенные поля (JSON)',
  'skills.saving': 'Сохранение...',
  'skills.saveChanges': 'Сохранить изменения',

  // Connectors
  'connectors.title': 'Коннекторы данных',
  'connectors.subtitle': 'Подключение внешних API и CRM-систем',
  'connectors.newConnector': 'Новый коннектор',
  'connectors.noConnectors': 'Коннекторов пока нет',
  'connectors.noConnectorsDesc': 'Подключите вашу CRM, API и внешние источники данных',
  'connectors.createConnector': 'Создать коннектор',
  'connectors.editConnector': 'Редактировать коннектор',
  'connectors.deleteConnector': 'Удалить коннектор',
  'connectors.deleteConfirm': 'Вы уверены, что хотите удалить "{{name}}"? Это действие нельзя отменить.',
  'connectors.name': 'Название',
  'connectors.type': 'Тип',
  'connectors.baseUrl': 'Базовый URL',
  'connectors.authType': 'Тип авторизации',
  'connectors.authValue': 'Значение авторизации',
  'connectors.headerName': 'Имя заголовка',
  'connectors.testConnection': 'Проверить соединение',
  'connectors.testing': 'Проверка...',
  'connectors.active': 'Активен',
  'connectors.inactive': 'Неактивен',
  'connectors.lastSynced': 'Последняя синхронизация',
  'connectors.noUrl': 'URL не настроен',
  'connectors.saving': 'Сохранение...',
  'connectors.saveChanges': 'Сохранить изменения',

  // Settings
  'settings.title': 'Настройки',
  'settings.general': 'Основные',
  'settings.providers': 'Провайдеры',
  'settings.apiKeys': 'API Ключи',
  'settings.oauth': 'OAuth',
  'settings.compliance': 'Безопасность',
  'settings.language': 'Язык',
  'settings.workspaceSettings': 'Настройки рабочего пространства',
  'settings.workspaceName': 'Название',
  'settings.industry': 'Отрасль',
  'settings.selectIndustry': 'Выберите отрасль...',
  'settings.timezone': 'Часовой пояс',
  'settings.selectTimezone': 'Выберите часовой пояс...',
  'settings.defaultConversationOwner': 'Владелец разговора по умолчанию',
  'settings.convOwnerHint': 'Определяет, кто управляет разговорами по умолчанию. Внешний режим требует подключённого MCP-агента.',
  'settings.internalAgent': 'Внутренний агент платформы',
  'settings.externalAgent': 'Внешний агент (MCP)',
  'settings.saveChanges': 'Сохранить изменения',
  'settings.saving': 'Сохранение...',
  'settings.saved': 'Сохранено',
  'settings.notConfigured': 'Не настроен',
  'settings.connected': 'Подключён',
  'settings.update': 'Обновить',
  'settings.saveConnect': 'Сохранить и подключить',
  'settings.removing': 'Удаление...',
  'settings.confirm': 'Подтвердить',
  'settings.enterCredential': 'Введите хотя бы одно поле учётных данных.',
  'settings.providerCredentials': 'Учётные данные провайдеров',
  'settings.twilioPhones': 'Телефонные номера Twilio',
  'settings.phonesHint': 'Доступные номера из вашего аккаунта Twilio. Включите входящие/исходящие для каждого.',
  'settings.loadPhones': 'Загрузить номера',
  'settings.loadingPhones': 'Загрузка...',
  'settings.noPhones': 'Телефонные номера не найдены в вашем аккаунте Twilio.',
  'settings.connectTwilioFirst': 'Подключите учётные данные Twilio выше для управления номерами.',
  'settings.inbound': 'Входящие',
  'settings.outbound': 'Исходящие',
  'settings.complianceSettings': 'Безопасность и соответствие',
  'settings.callRecordingDisclosure': 'Уведомление о записи звонков',
  'settings.callRecordingHint': 'Агент будет уведомлять звонящих о записи разговора.',
  'settings.aiDisclosure': 'Раскрытие ИИ',
  'settings.aiDisclosureHint': 'Агент будет уведомлять, что звонящий говорит с ИИ.',
  'settings.allowInboundHandoff': 'Разрешить внешнюю передачу входящих',
  'settings.allowInboundHandoffHint': 'Разрешить внешним MCP-агентам обрабатывать входящие звонки.',
  'settings.createApiKey': 'Создать API ключ',
  'settings.newApiKey': 'Новый API ключ',
  'settings.keyName': 'Название ключа',
  'settings.keyNamePlaceholder': 'Продакшн ключ',
  'settings.generate': 'Сгенерировать',
  'settings.generating': 'Генерация...',
  'settings.copyWarning': 'Скопируйте ключ сейчас. Вы не сможете увидеть его снова.',
  'settings.copied': 'Скопировано!',
  'settings.noApiKeys': 'API ключей пока нет. Создайте для аутентификации внешних сервисов.',
  'settings.revoked': 'Отозван',
  'settings.revoke': 'Отозвать',
  'settings.created': 'Создан',
  'settings.lastUsed': 'Использован',
  'settings.never': 'Никогда',
  'settings.createOAuth': 'Создать OAuth приложение',
  'settings.newOAuthApp': 'Новое OAuth приложение',
  'settings.appName': 'Название приложения',
  'settings.appNamePlaceholder': 'Моя интеграция',
  'settings.redirectUri': 'Redirect URI',
  'settings.redirectUriPlaceholder': 'https://myapp.com/callback',
  'settings.creating': 'Создание...',
  'settings.noOAuthApps': 'OAuth приложений пока нет. Создайте для сторонних интеграций.',
  'settings.clientId': 'Client ID',
  'settings.clientSecret': 'Client Secret',
  'settings.redirectUris': 'Redirect URIs',

  // Login
  'login.signIn': 'Войти',
  'login.createAccount': 'Регистрация',
  'login.email': 'Email',
  'login.password': 'Пароль',
  'login.workspaceName': 'Название компании',
  'login.pleaseWait': 'Подождите...',
  'login.signOut': 'Выйти',
  'login.copyright': 'Платформа ИИ телефонных агентов',

  // Error pages
  'error.title': 'Что-то пошло не так',
  'error.fallback': 'Произошла неожиданная ошибка. Пожалуйста, попробуйте снова.',
  'error.tryAgain': 'Попробовать снова',
  'notFound.code': '404',
  'notFound.title': 'Страница не найдена',
  'notFound.description': 'Страница, которую вы ищете, не существует или была перемещена.',
  'notFound.backToDashboard': 'Вернуться на главную',

  // OAuth consent
  'oauth.authError': 'Ошибка авторизации',
  'oauth.invalidRequest': 'Некорректный запрос авторизации -- отсутствуют обязательные параметры.',
  'oauth.wantsToConnect': 'хочет подключиться к',
  'oauth.yourWorkspace': 'вашему рабочему пространству',
  'oauth.thisAppWillBeAbleTo': 'Это приложение сможет',
  'oauth.perm.calls': 'Начинать и управлять телефонными звонками',
  'oauth.perm.history': 'Читать историю звонков и транскрипты',
  'oauth.perm.agents': 'Получить доступ к вашим ИИ-агентам',
  'oauth.perm.memory': 'Читать память звонящих и профили',
  'oauth.deny': 'Отклонить',
  'oauth.allowAccess': 'Разрешить доступ',
  'oauth.authorizing': 'Авторизация...',
  'oauth.consentNotice': 'Нажимая "Разрешить доступ", вы предоставляете {{appName}} доступ к вашему рабочему пространству Caller от вашего имени.',
  'oauth.authFailed': 'Ошибка авторизации',
};

// ─── Dictionaries map ────────────────────────────────────────────────────────

const dictionaries: Record<string, Record<string, string>> = { en, ru };

export type Lang = 'en' | 'ru';

// ─── Context ─────────────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getBrowserLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('caller_lang');
  if (stored === 'en' || stored === 'ru') return stored;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  return nav === 'ru' ? 'ru' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(getBrowserLang());
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('caller_lang', newLang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>): string => {
      let value = dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        }
      }
      return value;
    },
    [lang],
  );

  // Avoid hydration mismatch: render with 'en' on server, update on mount
  const contextValue: I18nContextValue = { lang: mounted ? lang : 'en', setLang, t: mounted ? t : (key, vars) => {
    let value = dictionaries.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      }
    }
    return value;
  }};

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx.t;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
