export interface PromptPack {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface PromptPackForm {
  name: string;
  description: string;
  content: string;
  category: string;
  is_active: boolean;
}

export interface PromptCategory {
  id: string;
  labelEn: string;
  labelRu: string;
  icon: string;
  color: string;
  gradient: string;
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  { id: 'greeting', labelEn: 'Greeting', labelRu: 'Приветствие', icon: 'waving_hand', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
  { id: 'objection', labelEn: 'Objection', labelRu: 'Возражение', icon: 'shield', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
  { id: 'closing', labelEn: 'Closing', labelRu: 'Закрытие', icon: 'handshake', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
  { id: 'qualification', labelEn: 'Qualification', labelRu: 'Квалификация', icon: 'checklist', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
  { id: 'follow-up', labelEn: 'Follow-up', labelRu: 'Фоллоу-ап', icon: 'replay', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
  { id: 'general', labelEn: 'General', labelRu: 'Общий', icon: 'article', color: '#64748b', gradient: 'linear-gradient(135deg, #64748b, #94a3b8)' },
];

export function getCategory(id: string | null): PromptCategory {
  return PROMPT_CATEGORIES.find(c => c.id === id) ?? PROMPT_CATEGORIES[PROMPT_CATEGORIES.length - 1];
}
