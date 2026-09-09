import { getServerEnv } from "@/lib/env";

/**
 * Minimal Unipile REST wrapper for WhatsApp: send a reply into the same chat
 * and retrieve an attachment's bytes server-side. Provider secrets never leave
 * the server and are never placed in a browser URL.
 *
 * Unipile's exact routes evolve — see https://developer.unipile.com/. The
 * paths below follow the current messaging API; adjust if your DSN differs.
 */

function baseUrl(): string {
  const { unipileDsn } = getServerEnv();
  const dsn = unipileDsn.replace(/^https?:\/\//, "");
  return `https://${dsn}/api/v1`;
}

function headers(): HeadersInit {
  return {
    "X-API-KEY": getServerEnv().unipileApiKey,
    accept: "application/json",
  };
}

/** Send a text reply into an existing WhatsApp chat. */
export async function sendWhatsappText(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    // Do not throw hard: log and continue so a reply failure never loses an
    // already-persisted visit note. The message is stored either way.
    console.error("[unipile] sendWhatsappText failed", res.status, await safeText(res));
  }
}

/**
 * Retrieve an attachment's raw bytes for an inbound audio message. We pass the
 * actual bytes to transcription; we do not assume a public media URL.
 */
export async function fetchAttachmentBytes(
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const url = `${baseUrl()}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(
    attachmentId,
  )}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Unipile attachment fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
