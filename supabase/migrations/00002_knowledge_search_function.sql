-- Vector similarity search function for knowledge retrieval (RAG)
create or replace function search_knowledge(
  query_embedding vector(1536),
  match_workspace_id uuid,
  match_count int default 5
)
returns table (
  chunk_text text,
  similarity float,
  document_title text,
  document_id uuid
)
language plpgsql
as $$
begin
  return query
    select
      ke.chunk_text,
      1 - (ke.embedding <=> query_embedding) as similarity,
      kd.title as document_title,
      kd.id as document_id
    from knowledge_embeddings ke
    join knowledge_documents kd on kd.id = ke.document_id
    where ke.workspace_id = match_workspace_id
    order by ke.embedding <=> query_embedding
    limit match_count;
end;
$$;
