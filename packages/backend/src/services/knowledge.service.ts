import { eq, and, desc, sql } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../config/db.js';
import {
  knowledgeBases,
  knowledgeDocuments,
  knowledgeEmbeddings,
  providerCredentials,
} from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { decrypt } from '../lib/crypto.js';
import type { KnowledgeBase, KnowledgeDocument } from '../models/types.js';

const logger = pino({ name: 'knowledge-service' });

// ============================================================
// Knowledge Base CRUD
// ============================================================

export async function createKnowledgeBase(
  workspaceId: string,
  params: { name: string; description?: string },
): Promise<KnowledgeBase> {
  const [created] = await db
    .insert(knowledgeBases)
    .values({ ...params, workspace_id: workspaceId })
    .returning();

  if (!created) throw new Error('Failed to create KB');
  return created as unknown as KnowledgeBase;
}

export async function listKnowledgeBases(workspaceId: string) {
  const rows = await db.execute(sql`
    SELECT kb.*, COUNT(kd.id)::int AS document_count
    FROM knowledge_bases kb
    LEFT JOIN knowledge_documents kd ON kd.knowledge_base_id = kb.id
    WHERE kb.workspace_id = ${workspaceId}
    GROUP BY kb.id
    ORDER BY kb.created_at DESC
  `);

  return (rows.rows ?? []) as unknown as Array<KnowledgeBase & { document_count: number }>;
}

export async function deleteKnowledgeBase(workspaceId: string, kbId: string): Promise<void> {
  await db
    .delete(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.id, kbId),
        eq(knowledgeBases.workspace_id, workspaceId),
      ),
    );
}

// ============================================================
// Document CRUD
// ============================================================

export async function addDocument(params: {
  knowledgeBaseId: string;
  workspaceId: string;
  title: string;
  content: string;
  docType?: string;
  metadata?: Record<string, unknown>;
}): Promise<KnowledgeDocument> {
  const [created] = await db
    .insert(knowledgeDocuments)
    .values({
      knowledge_base_id: params.knowledgeBaseId,
      workspace_id: params.workspaceId,
      title: params.title,
      content: params.content,
      doc_type: params.docType ?? 'document',
      metadata: params.metadata ?? {},
    })
    .returning();

  if (!created) throw new Error('Failed to add document');

  // Trigger embedding generation asynchronously
  await generateEmbeddings(created.id, params.workspaceId, params.content);

  return created as unknown as KnowledgeDocument;
}

export async function listDocuments(
  workspaceId: string,
  knowledgeBaseId: string,
): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select()
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.workspace_id, workspaceId),
        eq(knowledgeDocuments.knowledge_base_id, knowledgeBaseId),
      ),
    )
    .orderBy(desc(knowledgeDocuments.created_at));

  return rows as unknown as KnowledgeDocument[];
}

export async function getDocument(workspaceId: string, documentId: string): Promise<KnowledgeDocument> {
  const [doc] = await db
    .select()
    .from(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.workspace_id, workspaceId),
      ),
    );

  if (!doc) throw new NotFoundError('Document not found');
  return doc as unknown as KnowledgeDocument;
}

export async function updateDocument(
  workspaceId: string,
  documentId: string,
  updates: { title?: string; content?: string; doc_type?: string },
): Promise<KnowledgeDocument> {
  const [updated] = await db
    .update(knowledgeDocuments)
    .set({ ...updates, updated_at: new Date() })
    .where(
      and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.workspace_id, workspaceId),
      ),
    )
    .returning();

  if (!updated) throw new NotFoundError('Document not found');

  // Re-generate embeddings if content changed
  if (updates.content) {
    await db
      .delete(knowledgeEmbeddings)
      .where(eq(knowledgeEmbeddings.document_id, documentId));
    await generateEmbeddings(documentId, workspaceId, updates.content);
  }

  return updated as unknown as KnowledgeDocument;
}

export async function deleteDocument(workspaceId: string, documentId: string): Promise<void> {
  await db
    .delete(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.workspace_id, workspaceId),
      ),
    );
}

// ============================================================
// AI Content Enhancement
// ============================================================

export async function enhanceContent(
  workspaceId: string,
  content: string,
  docType?: string,
): Promise<{ enhanced_content: string; suggestions: string[] }> {
  // Try Anthropic first, fall back to OpenAI
  let apiKey: string;
  let provider: 'anthropic' | 'openai' = 'anthropic';

  try {
    const [row] = await db
      .select({ credential_data: providerCredentials.credential_data })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.workspace_id, workspaceId),
          eq(providerCredentials.provider, 'anthropic'),
        ),
      );
    if (!row) throw new Error('no anthropic');
    apiKey = JSON.parse(decrypt(row.credential_data)).api_key;
  } catch {
    const [row] = await db
      .select({ credential_data: providerCredentials.credential_data })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.workspace_id, workspaceId),
          eq(providerCredentials.provider, 'openai'),
        ),
      );
    if (!row) throw new Error('No LLM credentials configured. Add Anthropic or OpenAI API key in Settings.');
    apiKey = JSON.parse(decrypt(row.credential_data)).api_key;
    provider = 'openai';
  }

  const typeHint = docType ? `Тип документа: ${docType}.` : '';
  const systemPrompt = `Ты — ассистент для форматирования баз знаний AI-голосовых агентов. Пользователь введёт сырой текст для базы знаний. Твоя задача:

1. Структурировать текст — разбить на логичные секции с понятными заголовками
2. Исправить грамматические и стилистические ошибки
3. Убрать дублирование информации
4. Сделать текст понятным для AI-агента, который будет его использовать при телефонных звонках

ВАЖНО: НЕ используй markdown-разметку (заголовки с #, жирный текст с **, блоки кода и т.д.). Пиши ЧИСТЫМ ТЕКСТОМ. Для заголовков секций используй ЗАГЛАВНЫЕ БУКВЫ или формат "Секция:". Для списков используй "- " или нумерацию "1. ". Текст должен быть удобочитаемым в plain text без рендеринга.

${typeHint}

Ответь СТРОГО в формате JSON (без markdown code-блоков):
{"enhanced_content": "отформатированный текст", "suggestions": ["вопрос 1", "вопрос 2"]}

suggestions — список данных/вопросов, которые стоит добавить в документ. Если всё полно, suggestions должен быть пустым массивом.`;

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error({ status: res.status, err }, 'Anthropic enhance failed');
      throw new Error('AI enhancement failed');
    }

    const result = await res.json() as any;
    const text = result.content?.[0]?.text ?? '';
    return parseEnhanceResponse(text);
  }

  // OpenAI fallback
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error({ status: res.status, err }, 'OpenAI enhance failed');
    throw new Error('AI enhancement failed');
  }

  const result = await res.json() as any;
  const text = result.choices?.[0]?.message?.content ?? '';
  return parseEnhanceResponse(text);
}

function parseEnhanceResponse(text: string): { enhanced_content: string; suggestions: string[] } {
  try {
    const parsed = JSON.parse(text);
    return {
      enhanced_content: parsed.enhanced_content ?? text,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return { enhanced_content: text, suggestions: [] };
  }
}

// ============================================================
// Embedding Generation
// ============================================================

const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 50;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }

  return chunks;
}

async function getOpenAIKey(workspaceId: string): Promise<string> {
  const [row] = await db
    .select({ credential_data: providerCredentials.credential_data })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.workspace_id, workspaceId),
        eq(providerCredentials.provider, 'openai'),
      ),
    );

  if (!row) throw new Error('OpenAI credentials required for embeddings');
  const creds = JSON.parse(decrypt(row.credential_data));
  return creds.api_key;
}

async function generateEmbeddings(documentId: string, workspaceId: string, content: string): Promise<void> {
  try {
    const apiKey = await getOpenAIKey(workspaceId);
    const chunks = chunkText(content);

    for (let i = 0; i < chunks.length; i++) {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunks[i],
        }),
      });

      if (!res.ok) continue;

      const result = await res.json() as any;
      const embedding = result.data?.[0]?.embedding;

      if (embedding) {
        const embeddingStr = JSON.stringify(embedding);
        await db
          .insert(knowledgeEmbeddings)
          .values({
            document_id: documentId,
            workspace_id: workspaceId,
            chunk_index: i,
            chunk_text: chunks[i],
            embedding: sql`${embeddingStr}::vector`,
          });
      }
    }
  } catch (err) {
    // Log but don't fail document creation
    logger.error({ err }, 'Failed to generate embeddings');
  }
}

// ============================================================
// RAG Retrieval
// ============================================================

export async function searchKnowledge(
  workspaceId: string,
  query: string,
  limit = 5,
): Promise<Array<{ chunk_text: string; similarity: number; document_title: string }>> {
  try {
    const apiKey = await getOpenAIKey(workspaceId);

    // Generate query embedding
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!res.ok) return [];

    const result = await res.json() as any;
    const queryEmbedding = result.data?.[0]?.embedding;

    if (!queryEmbedding) return [];

    const embeddingStr = JSON.stringify(queryEmbedding);

    // Vector similarity search using pgvector
    const rows = await db.execute(sql`
      SELECT
        ke.chunk_text,
        1 - (ke.embedding <=> ${embeddingStr}::vector) AS similarity,
        kd.title AS document_title
      FROM knowledge_embeddings ke
      JOIN knowledge_documents kd ON kd.id = ke.document_id
      WHERE ke.workspace_id = ${workspaceId}
      ORDER BY ke.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return (rows.rows ?? []) as Array<{ chunk_text: string; similarity: number; document_title: string }>;
  } catch {
    return [];
  }
}

export async function searchKnowledgeForAgent(
  workspaceId: string,
  agentProfileId: string,
  query: string,
  limit = 3,
): Promise<Array<{ chunk_text: string; similarity: number; document_title: string }>> {
  try {
    const apiKey = await getOpenAIKey(workspaceId);

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!res.ok) return [];

    const result = await res.json() as any;
    const queryEmbedding = result.data?.[0]?.embedding;
    if (!queryEmbedding) return [];

    const embeddingStr = JSON.stringify(queryEmbedding);

    const rows = await db.execute(sql`
      SELECT
        ke.chunk_text,
        1 - (ke.embedding <=> ${embeddingStr}::vector) AS similarity,
        kd.title AS document_title
      FROM knowledge_embeddings ke
      JOIN knowledge_documents kd ON kd.id = ke.document_id
      JOIN agent_knowledge_bases akb ON akb.knowledge_base_id = kd.knowledge_base_id
      WHERE ke.workspace_id = ${workspaceId}
        AND akb.agent_profile_id = ${agentProfileId}
      ORDER BY ke.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return (rows.rows ?? []) as Array<{ chunk_text: string; similarity: number; document_title: string }>;
  } catch {
    return [];
  }
}
