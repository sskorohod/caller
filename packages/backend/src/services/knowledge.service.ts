import { eq, and, desc, sql } from 'drizzle-orm';
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

export async function listKnowledgeBases(workspaceId: string): Promise<KnowledgeBase[]> {
  const rows = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.workspace_id, workspaceId))
    .orderBy(desc(knowledgeBases.created_at));

  return rows as unknown as KnowledgeBase[];
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
    console.error('Failed to generate embeddings:', err);
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
