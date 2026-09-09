import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getServerEnv } from "@/lib/env";
import { getUserById } from "@/lib/access";
import { handleInbound, type InboundInput } from "@/lib/agent/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Private local event runner. Injects normalised scenario inputs directly into
 * the agent — used for the second user's access tests, scenario replay and the
 * public walkthroughs, WITHOUT needing extra phone numbers. Because it can
 * select identity, it MUST be disabled/inaccessible on any public tunnel:
 * gated behind ENABLE_LOCAL_TEST_RUNNER + a secret.
 *
 * Body: {
 *   actor_id: "user_anika" | "user_noah",
 *   kind: "text" | "audio",
 *   text?: string,
 *   audio_path?: "audio/voice-01-observations.wav",   // relative to repo root
 *   fixture_message_id?: string,   // used as the provider message id for dedup/replay
 *   received_at?: string
 * }
 */
export async function POST(req: NextRequest) {
  const env = getServerEnv();
  if (!env.enableTestRunner) {
    return NextResponse.json({ ok: false, error: "test runner disabled" }, { status: 404 });
  }
  const secret = req.headers.get("x-test-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (env.testRunnerSecret && secret !== env.testRunnerSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    actor_id?: string;
    kind?: "text" | "audio";
    text?: string;
    audio_path?: string;
    fixture_message_id?: string;
    received_at?: string;
  };

  if (!body.actor_id) return NextResponse.json({ ok: false, error: "actor_id required" }, { status: 400 });
  const user = await getUserById(body.actor_id);
  if (!user) return NextResponse.json({ ok: false, error: "unknown actor" }, { status: 404 });

  const input: InboundInput = {
    kind: body.kind ?? "text",
    text: body.text ?? null,
    receivedAt: body.received_at ?? new Date().toISOString(),
    // Fixture id doubles as the provider message id so replaying the same
    // fixture id is correctly deduplicated (P10).
    providerAccountId: "test-runner",
    providerMessageId: body.fixture_message_id ?? null,
  };

  if ((body.kind ?? "text") === "audio") {
    if (!body.audio_path) return NextResponse.json({ ok: false, error: "audio_path required" }, { status: 400 });
    try {
      // Repo root is one level above the Next.js app directory.
      const abs = path.resolve(process.cwd(), "..", body.audio_path);
      const bytes = await readFile(abs);
      input.audioBytes = new Uint8Array(bytes);
      input.audioFilename = path.basename(body.audio_path);
      input.audioMime = body.audio_path.endsWith(".ogg") ? "audio/ogg" : "audio/wav";
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `could not read audio fixture: ${(err as Error).message}` },
        { status: 400 },
      );
    }
  }

  const result = await handleInbound(user, input);
  return NextResponse.json({ ok: true, actor: user.display_name, ...result });
}
