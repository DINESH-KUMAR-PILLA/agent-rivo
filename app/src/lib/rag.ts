import { serviceClient } from "@/lib/supabase/service";
import { embed } from "@/lib/embeddings";
import type { RetrievedChunk } from "@/lib/types";

/**
 * Retrieve the most relevant procedure passages for a question via pgvector.
 * A small fixed number of passages is enough — we never stuff the whole corpus
 * into a prompt and call that retrieval.
 */
export async function retrieveProcedureChunks(
  question: string,
  matchCount = 4,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embed(question);
  const { data, error } = await serviceClient().rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

/** Human-readable citation, e.g. "SOP-03 · Information to collect". */
export function citationLabel(chunk: RetrievedChunk): string {
  return chunk.section ? `${chunk.document_id} · ${chunk.section}` : chunk.document_id;
}
