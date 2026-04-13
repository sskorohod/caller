export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  document_count: number;
  created_at: string;
}

export interface KBDocument {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const DOC_TYPES = [
  { value: 'document', labelEn: 'Document', labelRu: 'Документ', icon: 'description', color: '#6366f1' },
  { value: 'faq', labelEn: 'FAQ', labelRu: 'FAQ', icon: 'help', color: '#10b981' },
  { value: 'policy', labelEn: 'Policy', labelRu: 'Политика', icon: 'policy', color: '#f59e0b' },
  { value: 'pricing', labelEn: 'Pricing', labelRu: 'Цены', icon: 'payments', color: '#8b5cf6' },
  { value: 'troubleshooting', labelEn: 'Troubleshooting', labelRu: 'Решение проблем', icon: 'build', color: '#ef4444' },
] as const;

export function getDocType(type: string) {
  return DOC_TYPES.find(d => d.value === type) ?? DOC_TYPES[0];
}
