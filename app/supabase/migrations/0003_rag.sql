-- ═══════════════════════════════════════════════════════════════════════════
-- RAG retrieval helper
-- Cosine-distance nearest-neighbour search over procedure chunks. Runs as the
-- service role from the backend; the corpus is non-sensitive and shared.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function match_document_chunks(
  query_embedding vector(384),
  match_count int default 4
)
returns table (
  id          text,
  document_id text,
  section     text,
  ordinal     int,
  content     text,
  similarity  float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.section,
    c.ordinal,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Optional ANN index. IVFFlat needs data present before it is effective; the
-- corpus is tiny (5 documents) so an exact scan is already instant. Kept for
-- completeness / larger corpora.
-- create index if not exists chunks_embedding_idx
--   on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 10);
