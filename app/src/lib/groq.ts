import Groq from "groq-sdk";
import { getServerEnv } from "@/lib/env";

let cached: Groq | null = null;
function client(): Groq {
  if (!cached) cached = new Groq({ apiKey: getServerEnv().groqApiKey });
  return cached;
}

/** Chat completion returning parsed JSON. Throws on malformed output so the
 *  caller can fall back to a safe retry/clarification path rather than saving
 *  invalid business state. */
export async function chatJSON<T>(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  const env = getServerEnv();
  const res = await client().chat.completions.create({
    model: env.groqChatModel,
    temperature: opts.temperature ?? 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Model returned non-JSON output: ${raw.slice(0, 200)}`);
  }
}

/**
 * Transcribe real audio bytes with Groq Whisper. We pass the actual bytes
 * retrieved from the provider — never the fixture script — so this exercises
 * genuine speech recognition. Returns the transcript exactly as returned.
 */
export async function transcribeAudio(
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  const env = getServerEnv();
  const file = new File([bytes as unknown as BlobPart], filename, { type: guessMime(filename) });
  const res = await client().audio.transcriptions.create({
    file,
    model: env.groqSttModel,
    language: "en",
    response_format: "json",
  });
  return (res as { text: string }).text.trim();
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  switch (ext) {
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}
