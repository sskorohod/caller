import type { PromptPackForm } from './types';

// ─── Editor Sections ──────────────────────────────────────────────────────

export type PromptEditorSection = 'general' | 'content';

export const SECTIONS: PromptEditorSection[] = ['general', 'content'];

export const SECTION_KEYS: Record<PromptEditorSection, string> = {
  general: 'prompts.sec.general',
  content: 'prompts.sec.content',
};

export const SECTION_ICONS: Record<PromptEditorSection, string> = {
  general: 'info',
  content: 'edit_note',
};

// ─── Empty form ───────────────────────────────────────────────────────────

export const EMPTY_FORM: PromptPackForm = {
  name: '',
  description: '',
  content: '',
  category: 'general',
  is_active: true,
};

// ─── Category values ──────────────────────────────────────────────────────

export const CATEGORY_VALUES = ['greeting', 'objection', 'closing', 'qualification', 'follow-up', 'general'] as const;
