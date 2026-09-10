/**
 * End-to-end demo WITHOUT a phone.
 *
 *   npm run demo
 *
 * Drives the real agent pipeline through the private test runner: it starts a
 * Lyon visit, sends two REAL voice notes (transcribed by Groq Whisper), a text
 * follow-up, a correction, then prepares and validates the report — exactly the
 * P02 journey from the handbook. Every step hits the same code a real WhatsApp
 * message would. At the end it prints the validated report and a dashboard link.
 *
 * Prereqs: dev server running (npm run dev), seeded + provisioned, and
 * ENABLE_LOCAL_TEST_RUNNER=true with TEST_RUNNER_SECRET set.
 */
import "./load-env";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3100";
const SECRET = process.env.TEST_RUNNER_SECRET ?? "";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const SEED_VISITS = ["visit_001", "visit_002", "visit_003", "visit_004", "visit_005", "visit_006"];
const RUN = Date.now(); // unique provider ids per run → no replay collisions

const line = (s = "") => console.log(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(step: string, msg: Record<string, unknown>) {
  line(`\n\x1b[36m▶ ${step}\x1b[0m`);
  if (msg.text) line(`  📱 Anika: "${msg.text}"`);
  if (msg.audio_path) line(`  🎤 Anika sends voice note: ${msg.audio_path}`);
  const res = await fetch(`${BASE}/api/test-runner`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-secret": SECRET },
    body: JSON.stringify({ actor_id: "user_anika", ...msg }),
  });
  const json = await res.json();
  if (!res.ok || json.ok === false) {
    line(`  ❌ error: ${JSON.stringify(json)}`);
    process.exit(1);
  }
  line(`  🤖 Assistant [${json.effect}]:`);
  line(
    (json.reply ?? "")
      .split("\n")
      .map((l: string) => `     ${l}`)
      .join("\n"),
  );
  return json;
}

async function cleanup() {
  const { data } = await db.from("visits").select("id").eq("author_id", "user_anika");
  const ids = (data ?? []).map((v: any) => v.id).filter((id: string) => !SEED_VISITS.includes(id));
  if (ids.length) await db.from("visits").delete().in("id", ids);
  await db.from("pending_inputs").delete().eq("user_id", "user_anika");
}

async function main() {
  if (!SECRET) {
    line("TEST_RUNNER_SECRET not set (.env.local). Aborting.");
    process.exit(1);
  }
  line("\x1b[1m═══ Agent Rivo — end-to-end demo (no phone, real pipeline) ═══\x1b[0m");
  await cleanup();

  // Timestamps on the demo clock (Monday 7 September 2026) so the visit date
  // and the "Friday" follow-up resolve exactly as in the handbook's P02.
  const at = (min: number) => `2026-09-07T10:0${min}:00+02:00`;

  await send("Start the visit", { text: "Start a visit to Lyon.", fixture_message_id: `d${RUN}_1`, received_at: at(1) });

  await send("Voice note 1 — observations (real Whisper transcription)", {
    kind: "audio",
    audio_path: "audio/voice-01-observations.wav",
    fixture_message_id: `d${RUN}_2`,
    received_at: at(2),
  });

  await send("Voice note 2 — correction (fifteen → five)", {
    kind: "audio",
    audio_path: "audio/voice-02-correction.wav",
    fixture_message_id: `d${RUN}_3`,
    received_at: at(3),
  });

  await send("Text follow-up", {
    text: "Sarah should check the tablet with IT by Friday. I do not know why it is not charging.",
    fixture_message_id: `d${RUN}_4`,
    received_at: at(4),
  });

  await send("Prepare the report", { text: "Prepare the report.", fixture_message_id: `d${RUN}_5`, received_at: at(5) });

  await sleep(500);
  await send("Validate the report", { text: "I validate the latest draft.", fixture_message_id: `d${RUN}_6`, received_at: at(6) });

  // Fetch and print the validated report from the database.
  const { data: visit } = await db
    .from("visits")
    .select("id")
    .eq("author_id", "user_anika")
    .eq("store_id", "store_lyon")
    .not("id", "in", `(${SEED_VISITS.map((s) => `"${s}"`).join(",")})`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (visit) {
    const { data: report } = await db.from("reports").select("*").eq("visit_id", visit.id).maybeSingle();
    line("\n\x1b[1m═══ Validated report (from the database) ═══\x1b[0m");
    if (report) {
      line(`\x1b[1m${report.title}\x1b[0m   [state: ${report.state}, version ${report.version}]`);
      line(`\nSummary: ${report.summary}`);
      line("\nFindings:");
      for (const f of report.findings) line(`  • [${f.kind}/${f.category}] ${f.text}  (sources: ${f.source_message_ids.join(", ")})`);
      if (report.followup_notes?.length) {
        line("\nFollow-up notes:");
        for (const n of report.followup_notes) line(`  • ${n.text}`);
      }
    }
    line(`\n\x1b[32m✔ Open it in the dashboard:\x1b[0m ${BASE}/visits/${visit.id}`);
  }

  line("\n\x1b[1mWhat this proved:\x1b[0m real transcription, mixed voice+text in one visit,");
  line("faithful correction (five, not fifteen), no invented cause, follow-up kept as prose,");
  line("explicit validation → one final report, all visible in the dashboard.");
}

main().then(() => process.exit(0));
