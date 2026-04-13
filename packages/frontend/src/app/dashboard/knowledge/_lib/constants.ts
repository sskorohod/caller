export const DOC_TYPE_VALUES = ['document', 'faq', 'policy', 'pricing', 'troubleshooting'] as const;

export type DocEditorSection = 'content' | 'metadata';

export const DOC_SECTIONS: DocEditorSection[] = ['content', 'metadata'];

export const DOC_SECTION_KEYS: Record<DocEditorSection, string> = {
  content: 'knowledge.sec.content',
  metadata: 'knowledge.sec.metadata',
};

export const DOC_SECTION_ICONS: Record<DocEditorSection, string> = {
  content: 'edit_note',
  metadata: 'info',
};

export interface DocForm {
  title: string;
  content: string;
  doc_type: string;
  source_url: string;
}

export const EMPTY_DOC_FORM: DocForm = {
  title: '',
  content: '',
  doc_type: 'document',
  source_url: '',
};
