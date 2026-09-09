/**
 * Index the five approved procedures for RAG.
 *
 *   npm run embed
 *
 * Reads procedures/*.md, splits each into section-level passages, generates
 * local Supabase/gte-small embeddings (Transformers.js — no embedding API
 * bill), and stores them in document_chunks via pgvector. Document id, title,
 * section and version are preserved so a citation identifies a real passage.
 * Idempotent: existing chunks are replaced.
 */
import "./load-env";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@huggingface/transformers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const ROOT = resolve(process.cwd(), "..");

interface Chunk {
  document_id: string;
  section: string;
  ordinal: number;
  content: string;
}

/** Split a procedure markdown file into ## section passages. */
function splitProcedure(docId: string, md: string): Chunk[] {
  // Drop YAML frontmatter.
  const body = md.replace(/^---[\s\S]*?---\n/, "");
  const lines = body.split("\n");
  const chunks: Chunk[] = [];
  let section = "Overview";
  let buffer: string[] = [];
  let ordinal = 0;

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content.length > 0) {
      chunks.push({ document_id: docId, section, ordinal: ordinal++, content });
    }
    buffer = [];
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h2) {
      flush();
      section = h2[1].trim();
    } else if (h1) {
      // Document title line — keep as context but don't start a chunk.
      continue;
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

async function main() {
  console.log(`▶ Indexing procedures into ${url}`);
  const docs = JSON.parse(readFileSync(resolve(ROOT, "data/documents.json"), "utf8"));

  // Upsert document metadata.
  const { error: docErr } = await db.from("documents").upsert(
    docs.map((d: any) => ({
      id: d.id,
      title: d.title,
      version: d.version,
      effective_from: d.effective_from,
      network_id: d.network_id,
      path: d.path,
    })),
  );
  if (docErr) {
    console.error("  ✖ documents upsert failed:", docErr.message);
    process.exit(1);
  }

  // Build chunks.
  const allChunks: Chunk[] = [];
  for (const d of docs) {
    const md = readFileSync(resolve(ROOT, d.path), "utf8");
    allChunks.push(...splitProcedure(d.id, md));
  }
  console.log(`  • ${allChunks.length} passages across ${docs.length} documents`);

  // Load the embedding model once.
  console.log("  • loading Supabase/gte-small (first run downloads ~30 MB)…");
  const extractor = await pipeline("feature-extraction", "Supabase/gte-small");

  // Replace existing chunks for a clean, idempotent index.
  await db.from("document_chunks").delete().neq("id", "___none___");

  for (const c of allChunks) {
    const output = await extractor(c.content, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    const { error } = await db.from("document_chunks").insert({
      document_id: c.document_id,
      section: c.section,
      ordinal: c.ordinal,
      content: c.content,
      embedding,
    });
    if (error) {
      console.error(`  ✖ insert chunk ${c.document_id}#${c.ordinal} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log("✔ Procedures indexed. RAG retrieval is ready.");
}

main().then(() => process.exit(0));
