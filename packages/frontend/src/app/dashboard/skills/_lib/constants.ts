import type { SkillCategory, SkillPackForm, SkillSection, RequiredDataItem, ToolStep, EscalationCondition } from './types';

// ─── Sections ──────────────────────────────────────────────────────────────

export const SECTIONS: SkillSection[] = ['general', 'activation', 'dataTools', 'escalation', 'completion', 'json'];

export const SECTION_KEYS: Record<SkillSection, string> = {
  general: 'skills.sec.general',
  activation: 'skills.sec.activation',
  dataTools: 'skills.sec.dataTools',
  escalation: 'skills.sec.escalation',
  completion: 'skills.sec.completion',
  json: 'skills.sec.json',
};

export const SECTION_ICONS: Record<SkillSection, string> = {
  general: 'info',
  activation: 'play_circle',
  dataTools: 'build',
  escalation: 'warning',
  completion: 'check_circle',
  json: 'code',
};

// ─── Categories ────────────────────────────────────────────────────────────

export const SKILL_CATEGORIES: SkillCategory[] = [
  { id: 'service', labelEn: 'Service', labelRu: 'Обслуживание', icon: 'support_agent', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
  { id: 'sales', labelEn: 'Sales', labelRu: 'Продажи', icon: 'trending_up', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
  { id: 'data', labelEn: 'Data Collection', labelRu: 'Сбор данных', icon: 'assignment', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
  { id: 'escalation', labelEn: 'Escalation', labelRu: 'Эскалация', icon: 'priority_high', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #f87171)' },
  { id: 'scheduling', labelEn: 'Scheduling', labelRu: 'Планирование', icon: 'calendar_month', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
  { id: 'custom', labelEn: 'Custom', labelRu: 'Другое', icon: 'bolt', color: '#64748b', gradient: 'linear-gradient(135deg, #64748b, #94a3b8)' },
];

// Map intent keywords to category IDs
const INTENT_CATEGORY_MAP: Record<string, string> = {
  schedule: 'scheduling', appointment: 'scheduling', booking: 'scheduling', calendar: 'scheduling', reschedule: 'scheduling',
  collect: 'data', gather: 'data', survey: 'data', form: 'data', qualify: 'data', qualification: 'data',
  complaint: 'service', support: 'service', help: 'service', faq: 'service', troubleshoot: 'service', resolve: 'service',
  sell: 'sales', upsell: 'sales', offer: 'sales', pitch: 'sales', lead: 'sales', close: 'sales', deal: 'sales',
  escalate: 'escalation', transfer: 'escalation', urgent: 'escalation', callback: 'escalation',
};

export function getCategoryForIntent(intent: string): SkillCategory {
  const lower = intent.toLowerCase();
  for (const [keyword, catId] of Object.entries(INTENT_CATEGORY_MAP)) {
    if (lower.includes(keyword)) {
      return SKILL_CATEGORIES.find(c => c.id === catId) || SKILL_CATEGORIES[SKILL_CATEGORIES.length - 1];
    }
  }
  return SKILL_CATEGORIES[SKILL_CATEGORIES.length - 1]; // custom
}

// ─── Templates ─────────────────────────────────────────────────────────────

export interface SkillTemplate {
  id: string;
  nameEn: string;
  nameRu: string;
  descEn: string;
  descRu: string;
  icon: string;
  color: string;
  form: Partial<SkillPackForm>;
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: 'appointment',
    nameEn: 'Appointment Scheduling',
    nameRu: 'Запись на приём',
    descEn: 'Schedule, reschedule, and cancel appointments',
    descRu: 'Запись, перенос и отмена встреч',
    icon: 'calendar_month',
    color: '#8b5cf6',
    form: {
      name: '',
      intent: 'schedule_appointment',
      conversation_rules: `1. Greet the caller and ask how you can help with scheduling.\n2. Ask for preferred date and time.\n3. Check availability and confirm the slot.\n4. Collect the caller's name, phone, and email.\n5. Confirm all details and provide a summary.\n6. If rescheduling, ask for the existing appointment reference first.`,
      activation_rules: { keywords: ['appointment', 'schedule', 'book', 'reschedule', 'cancel appointment'] },
      required_data: [
        { name: 'full_name', type: 'text', required: true, description: 'Full name of the caller' },
        { name: 'phone', type: 'phone', required: true, description: 'Contact phone number' },
        { name: 'email', type: 'email', required: false, description: 'Email for confirmation' },
        { name: 'preferred_date', type: 'date', required: true, description: 'Preferred appointment date' },
      ] as RequiredDataItem[],
      completion_criteria: { all_data_collected: true, confirmation_required: true, success_message: 'Your appointment has been scheduled successfully.' },
    },
  },
  {
    id: 'faq',
    nameEn: 'FAQ Handler',
    nameRu: 'Обработка FAQ',
    descEn: 'Answer frequently asked questions from knowledge base',
    descRu: 'Ответы на частые вопросы из базы знаний',
    icon: 'help_center',
    color: '#6366f1',
    form: {
      name: '',
      intent: 'handle_faq',
      conversation_rules: `1. Listen to the caller's question carefully.\n2. Search the knowledge base for relevant answers.\n3. Provide a clear and concise answer.\n4. Ask if the caller has any follow-up questions.\n5. If no answer found, offer to transfer to a human agent.`,
      activation_rules: { keywords: ['question', 'how', 'what', 'when', 'where', 'why', 'help'] },
      escalation_conditions: [
        { type: 'no_answer_found', threshold: '2', action: 'transfer_human', message: 'Let me connect you with a specialist who can help.' },
      ] as EscalationCondition[],
      completion_criteria: { question_answered: true, success_message: 'Is there anything else I can help you with?' },
    },
  },
  {
    id: 'data_collection',
    nameEn: 'Data Collection',
    nameRu: 'Сбор данных',
    descEn: 'Collect structured information from callers',
    descRu: 'Сбор структурированной информации у звонящих',
    icon: 'assignment',
    color: '#f59e0b',
    form: {
      name: '',
      intent: 'collect_data',
      conversation_rules: `1. Introduce yourself and explain why you need the information.\n2. Ask questions one at a time, in order.\n3. Validate each answer before proceeding.\n4. If the caller is unsure, offer to skip and come back.\n5. Summarize all collected data at the end.\n6. Ask for confirmation before submitting.`,
      activation_rules: { keywords: ['register', 'sign up', 'form', 'application', 'apply'] },
      required_data: [
        { name: 'full_name', type: 'text', required: true, description: 'Full legal name' },
        { name: 'email', type: 'email', required: true, description: 'Email address' },
        { name: 'phone', type: 'phone', required: true, description: 'Phone number' },
        { name: 'company', type: 'text', required: false, description: 'Company name' },
      ] as RequiredDataItem[],
      completion_criteria: { all_data_collected: true, confirmation_required: true },
    },
  },
  {
    id: 'complaint',
    nameEn: 'Complaint Resolution',
    nameRu: 'Обработка жалоб',
    descEn: 'Handle and resolve customer complaints',
    descRu: 'Приём и решение жалоб клиентов',
    icon: 'sentiment_dissatisfied',
    color: '#ef4444',
    form: {
      name: '',
      intent: 'handle_complaint',
      conversation_rules: `1. Listen empathetically. Let the caller express their frustration.\n2. Acknowledge the issue and apologize sincerely.\n3. Ask clarifying questions to understand the problem.\n4. Offer a solution or next steps.\n5. If unable to resolve, escalate to a supervisor.\n6. Confirm the resolution and follow-up plan.`,
      activation_rules: { keywords: ['complaint', 'problem', 'issue', 'unhappy', 'dissatisfied', 'terrible'] },
      escalation_conditions: [
        { type: 'negative_sentiment', threshold: '0.3', action: 'transfer_human', message: 'I understand this is frustrating. Let me connect you with a supervisor.' },
        { type: 'user_request', threshold: '1', action: 'transfer_human', message: 'Of course, I will transfer you right away.' },
      ] as EscalationCondition[],
      interruption_rules: { allow_interruption: true, pause_on_interrupt: true },
      completion_criteria: { issue_resolved: true, success_message: 'Thank you for your patience. Is there anything else I can help with?' },
    },
  },
  {
    id: 'callback',
    nameEn: 'Callback Request',
    nameRu: 'Обратный звонок',
    descEn: 'Schedule callback requests for the team',
    descRu: 'Оформление заявки на обратный звонок',
    icon: 'phone_callback',
    color: '#10b981',
    form: {
      name: '',
      intent: 'request_callback',
      conversation_rules: `1. Ask for the caller's name and phone number.\n2. Ask for the preferred callback time.\n3. Ask briefly what the callback is about.\n4. Confirm all details.\n5. Let them know someone will call them back.`,
      activation_rules: { keywords: ['callback', 'call back', 'call me', 'return call'] },
      required_data: [
        { name: 'full_name', type: 'text', required: true, description: 'Name' },
        { name: 'phone', type: 'phone', required: true, description: 'Callback number' },
        { name: 'preferred_time', type: 'text', required: false, description: 'Preferred callback time' },
        { name: 'reason', type: 'text', required: true, description: 'Reason for callback' },
      ] as RequiredDataItem[],
      completion_criteria: { all_data_collected: true, success_message: 'Got it! Someone will call you back shortly.' },
    },
  },
  {
    id: 'qualify_lead',
    nameEn: 'Lead Qualification',
    nameRu: 'Квалификация лида',
    descEn: 'Qualify incoming leads with structured questions',
    descRu: 'Квалификация входящих лидов',
    icon: 'person_search',
    color: '#10b981',
    form: {
      name: '',
      intent: 'qualify_lead',
      conversation_rules: `1. Introduce yourself and the company.\n2. Ask about the caller's needs and pain points.\n3. Ask about their budget and timeline.\n4. Determine the decision-making process.\n5. Rate the lead (hot/warm/cold).\n6. If hot lead, offer to schedule a demo.`,
      activation_rules: { keywords: ['interested', 'pricing', 'demo', 'information', 'learn more'] },
      required_data: [
        { name: 'company_name', type: 'text', required: true, description: 'Company name' },
        { name: 'contact_name', type: 'text', required: true, description: 'Contact person name' },
        { name: 'email', type: 'email', required: true, description: 'Business email' },
        { name: 'budget_range', type: 'text', required: false, description: 'Budget range' },
        { name: 'timeline', type: 'text', required: false, description: 'Implementation timeline' },
      ] as RequiredDataItem[],
      tool_sequence: [
        { tool: 'crm_lookup', action: 'Check if contact exists in CRM', parameters: {} },
        { tool: 'crm_create', action: 'Create lead in CRM', parameters: {} },
      ] as ToolStep[],
      completion_criteria: { all_data_collected: true, lead_qualified: true },
    },
  },
];

// ─── Empty form ────────────────────────────────────────────────────────────

export const EMPTY_FORM: SkillPackForm = {
  name: '',
  description: '',
  intent: '',
  conversation_rules: '',
  is_active: true,
  activation_rules: {},
  required_data: [],
  tool_sequence: [],
  allowed_tools: [],
  escalation_conditions: [],
  completion_criteria: {},
  interruption_rules: {},
};

// ─── Intent Suggestions ────────────────────────────────────────────────────

export const INTENT_SUGGESTIONS = [
  'schedule_appointment',
  'handle_faq',
  'collect_data',
  'handle_complaint',
  'request_callback',
  'qualify_lead',
  'process_payment',
  'verify_identity',
  'update_account',
  'cancel_service',
  'technical_support',
  'order_status',
];

// ─── Field Types ───────────────────────────────────────────────────────────

export const DATA_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes/No' },
];

export const ESCALATION_TYPES = [
  { value: 'negative_sentiment', label: 'Negative Sentiment' },
  { value: 'max_retries', label: 'Max Retries' },
  { value: 'user_request', label: 'User Request' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'no_answer_found', label: 'No Answer Found' },
  { value: 'custom', label: 'Custom' },
];

export const ESCALATION_ACTIONS = [
  { value: 'transfer_human', label: 'Transfer to Human' },
  { value: 'transfer_supervisor', label: 'Transfer to Supervisor' },
  { value: 'end_call', label: 'End Call' },
  { value: 'retry', label: 'Retry' },
];
