'use client';
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import SkillEditor from '../_components/SkillEditor';
import SkillTemplatesPicker from '../_components/SkillTemplatesPicker';
import { EMPTY_FORM, type SkillTemplate } from '../_lib/constants';
import type { SkillPackForm, RequiredDataItem, ToolStep, EscalationCondition } from '../_lib/types';

export default function NewSkillPage() {
  const lang = useLang();
  const [initialForm, setInitialForm] = useState<SkillPackForm | null>(null);
  const [showPicker, setShowPicker] = useState(true);

  function handleTemplate(tpl: SkillTemplate) {
    const form: SkillPackForm = {
      ...EMPTY_FORM,
      name: lang === 'ru' ? tpl.nameRu : tpl.nameEn,
      description: lang === 'ru' ? tpl.descRu : tpl.descEn,
      ...tpl.form,
      intent: tpl.form.intent ?? '',
      conversation_rules: tpl.form.conversation_rules ?? '',
      is_active: true,
      activation_rules: (tpl.form.activation_rules ?? {}) as Record<string, unknown>,
      required_data: (tpl.form.required_data ?? []) as RequiredDataItem[],
      tool_sequence: (tpl.form.tool_sequence ?? []) as ToolStep[],
      allowed_tools: tpl.form.allowed_tools ?? [],
      escalation_conditions: (tpl.form.escalation_conditions ?? []) as EscalationCondition[],
      completion_criteria: (tpl.form.completion_criteria ?? {}) as Record<string, unknown>,
      interruption_rules: (tpl.form.interruption_rules ?? {}) as Record<string, unknown>,
    };
    setInitialForm(form);
    setShowPicker(false);
  }

  function handleScratch() {
    setInitialForm({ ...EMPTY_FORM });
    setShowPicker(false);
  }

  if (showPicker) {
    return <SkillTemplatesPicker onSelect={handleTemplate} onScratch={handleScratch} />;
  }

  return <SkillEditor initialForm={initialForm ?? EMPTY_FORM} />;
}
