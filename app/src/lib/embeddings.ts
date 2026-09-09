import { pipeline } from "@huggingface/transformers";

/**
 * Local sentence embeddings via Transformers.js using Supabase/gte-small
 * (384-dim). No embedding API bill. The same model encodes both the procedure
 * chunks (at seed time) and the live query (at retrieval time), which is
 * required for the vectors to be comparable.
 */
const MODEL = "Supabase/gte-small";
// `any` avoids Transformers.js's very large pipeline union type.
let extractor: Promise<any> | null = null;

function getExtractor(): Promise<any> {
  if (!extractor) extractor = pipeline("feature-extraction", MODEL);
  return extractor;
}

export async function embed(text: string): Promise<number[]> {
  const pipe = await getExtractor();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) out.push(await embed(t)); // small corpus; sequential is fine
  return out;
}

export const EMBEDDING_DIM = 384;
