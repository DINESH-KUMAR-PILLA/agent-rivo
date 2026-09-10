/**
 * Seed the development database from the candidate-kit fixtures.
 *
 *   npm run seed          # idempotent import (upsert; safe to run repeatedly)
 *   npm run seed:reset    # clear app-created visit/report/message data, then reimport
 *
 * Seeding validated history does NOT trigger report generation or WhatsApp
 * notifications — the snapshots are imported verbatim so history is identical
 * across candidates. Running twice does not duplicate the six historical
 * reports (everything is keyed on stable fixture ids).
 *
 * This script targets the dedicated dev project identified by
 * NEXT_PUBLIC_SUPABASE_URL. It never touches unrelated data.
 */
import "./load-env";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const ROOT = resolve(process.cwd(), "..");
const readJson = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

const RESET = process.argv.includes("--reset");

async function ensureAudioBucket() {
  // Create the private bucket via the Storage API (more reliable than the SQL
  // insert, which can be blocked depending on project setup). Idempotent.
  const { error } = await db.storage.createBucket("visit-audio", { public: false });
  if (error && !/already exists/i.test(error.message)) {
    console.error("  ✖ could not create visit-audio bucket:", error.message);
  } else {
    console.log("  • storage bucket 'visit-audio' ready (private)");
  }
}

async function main() {
  console.log(`▶ Seeding ${url}${RESET ? " (reset mode)" : ""}`);
  await ensureAudioBucket();

  if (RESET) {
    console.log("  clearing app-created visit/report/message data…");
    // FK-safe order. app_users, stores, memberships and the RAG corpus are kept.
    for (const table of ["messages", "pending_inputs", "processed_events"]) {
      await db.from(table).delete().neq("id", "___none___");
    }
    // reports.visit_id / visits.report_id are circular — null the link first.
    await db.from("visits").update({ report_id: null }).neq("id", "___none___");
    await db.from("reports").delete().neq("id", "___none___");
    await db.from("visits").delete().neq("id", "___none___");
  }

  // ── Stores ──
  const stores = readJson("data/stores.json");
  await upsert("stores", stores);

  // ── Users (preserve any existing auth_user_id / whatsapp_sender_id bindings) ──
  const users = readJson("data/users.json").map((u: any) => ({
    id: u.id,
    display_name: u.display_name,
    role: u.role,
    test_email: u.test_email,
  }));
  await upsert("app_users", users);

  // ── Memberships ──
  const memberships = readJson("data/users.json").flatMap((u: any) =>
    u.store_ids.map((store_id: string) => ({ user_id: u.id, store_id })),
  );
  await upsert("store_memberships", memberships, "user_id,store_id");

  // ── Visits (report_id linked after reports exist) ──
  const visits = readJson("data/visits.json");
  await upsert(
    "visits",
    visits.map((v: any) => ({
      id: v.id,
      store_id: v.store_id,
      author_id: v.author_id,
      state: v.state,
      started_at: v.started_at,
      validated_at: v.validated_at,
      report_id: null,
      latest_draft_version: v.latest_draft_version ?? 1,
      last_shown_version: v.latest_draft_version ?? 1,
    })),
  );

  // ── Reports (imported verbatim; state already validated) ──
  const reports = readJson("data/reports.json");
  await upsert(
    "reports",
    reports.map((r: any) => ({
      id: r.id,
      visit_id: r.visit_id,
      store_id: r.store_id,
      author_id: r.author_id,
      state: r.state,
      version: r.version ?? 1,
      title: r.title,
      summary: r.summary,
      findings: r.findings.map((f: any) => ({
        category: f.category,
        kind: f.kind,
        text: f.text,
        source_message_ids: f.source_message_ids,
      })),
      followup_notes: r.followup_notes ?? [],
      validated_by: r.validated_by,
      validated_at: r.validated_at,
      validation_message_id: r.validation_message_id,
    })),
  );

  // Link visits → reports.
  for (const v of visits) {
    if (v.report_id) await db.from("visits").update({ report_id: v.report_id }).eq("id", v.id);
  }

  // ── Historical messages (all text; no transcription needed) ──
  const messages = readJson("data/messages.json");
  await upsert(
    "messages",
    messages.map((m: any) => ({
      id: m.id,
      visit_id: m.visit_id,
      actor_id: m.actor_id,
      direction: "inbound",
      kind: m.kind,
      received_at: m.received_at,
      text: m.text,
      transcription_status: "not_applicable",
      raw: { intent: m.text?.toLowerCase().includes("validate") ? "validation" : "add_note" },
    })),
  );

  console.log("✔ Business data seeded.");
  console.log("  Next: `npm run embed` (index procedures) and `npm run provision` (bind auth users).");
}

async function upsert(table: string, rows: any[], onConflict = "id") {
  if (rows.length === 0) return;
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`  ✖ upsert ${table} failed:`, error.message);
    process.exit(1);
  }
  console.log(`  • ${table}: ${rows.length} rows`);
}

main().then(() => process.exit(0));
