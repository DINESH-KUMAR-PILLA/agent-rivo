import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getUserByWhatsappSender } from "@/lib/access";
import { fetchAttachmentBytes, sendWhatsappText } from "@/lib/unipile";
import { handleInbound, type InboundInput } from "@/lib/agent/orchestrator";
import { now } from "@/lib/clock";

// Webhooks must run on the Node runtime (Buffer, transformers, etc.).
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Unipile WhatsApp webhook. Verifies a shared secret, binds the verified
 * provider sender to a known regional manager (a user-written name is NOT
 * authentication), retrieves audio server-side, runs the agent and replies in
 * the same chat. Unknown senders get a setup response and no network data.
 *
 * Unipile's payload shape can vary by DSN/version; we parse defensively. See
 * https://developer.unipile.com/. Adjust extractEvent() to match your events.
 */
export async function POST(req: NextRequest) {
  const env = getServerEnv();

  // Shared-secret check (header or query). Reject silently-ish.
  const provided =
    req.headers.get("x-webhook-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (env.unipileWebhookSecret && provided !== env.unipileWebhookSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const evt = extractEvent(body);
  if (!evt) {
    // Not a message event we handle (delivery receipt, status, etc.).
    return NextResponse.json({ ok: true, ignored: true });
  }

  const user = await getUserByWhatsappSender(evt.senderId);
  if (!user) {
    if (evt.chatId) {
      await sendWhatsappText(
        evt.chatId,
        "This number isn't set up for Agent Rivo. Please ask your administrator to register it. I can't share any network data until then.",
      );
    }
    return NextResponse.json({ ok: true, unknown_sender: true });
  }

  // Build the agent input, retrieving audio bytes server-side when needed.
  let input: InboundInput = {
    kind: evt.type,
    text: evt.text,
    receivedAt: evt.receivedAt ?? now().toISOString(),
    providerAccountId: evt.accountId,
    providerMessageId: evt.messageId,
  };

  if (evt.type === "audio" && evt.attachmentId) {
    try {
      const bytes = await fetchAttachmentBytes(evt.messageId, evt.attachmentId);
      input = {
        ...input,
        audioBytes: bytes,
        audioFilename: evt.attachmentName ?? `${evt.messageId}.ogg`,
        audioMime: evt.attachmentMime ?? "audio/ogg",
      };
    } catch (err) {
      console.error("[webhook] attachment fetch failed", err);
      if (evt.chatId)
        await sendWhatsappText(evt.chatId, "I couldn't download that voice note. Please resend it.");
      return NextResponse.json({ ok: true, attachment_error: true });
    }
  }

  try {
    const result = await handleInbound(user, input);
    if (result.reply && evt.chatId) await sendWhatsappText(evt.chatId, result.reply);
    return NextResponse.json({ ok: true, effect: result.effect, duplicate: result.duplicate ?? false });
  } catch (err) {
    console.error("[webhook] handler error", err);
    if (evt.chatId)
      await sendWhatsappText(
        evt.chatId,
        "Something went wrong on my side, but your accepted notes are safe. Please try that again.",
      );
    return NextResponse.json({ ok: false, error: "handler_error" }, { status: 200 });
  }
}

interface ParsedEvent {
  accountId: string;
  messageId: string;
  senderId: string;
  chatId: string | null;
  type: "text" | "audio";
  text: string | null;
  receivedAt: string | null;
  attachmentId: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
}

/** Best-effort extraction of a Unipile "message received" event. */
function extractEvent(body: unknown): ParsedEvent | null {
  const b = body as Record<string, any>;
  // Unipile commonly wraps the message; support a few shapes.
  const msg = b.message ?? b.data ?? b;
  const eventType = b.event ?? b.type ?? msg?.event;
  if (eventType && !/message/i.test(String(eventType))) return null;

  const accountId = String(msg.account_id ?? b.account_id ?? "");
  const messageId = String(msg.id ?? msg.message_id ?? b.message_id ?? "");
  const senderId = String(
    msg.sender?.attendee_provider_id ?? msg.from ?? msg.sender_id ?? msg.attendee_provider_id ?? "",
  );
  const chatId = msg.chat_id ?? msg.chat?.id ?? b.chat_id ?? null;
  if (!messageId || !senderId) return null;

  const attachments = msg.attachments ?? [];
  const audio = attachments.find((a: any) => /audio|voice|ptt/i.test(a.type ?? a.mimetype ?? ""));
  const isAudio = Boolean(audio) || /audio|voice|ptt/i.test(msg.message_type ?? msg.type ?? "");

  return {
    accountId,
    messageId,
    senderId,
    chatId: chatId ? String(chatId) : null,
    type: isAudio ? "audio" : "text",
    text: typeof msg.text === "string" ? msg.text : (msg.body ?? null),
    receivedAt: msg.timestamp ?? msg.date ?? null,
    attachmentId: audio ? String(audio.id ?? audio.attachment_id ?? "") : null,
    attachmentName: audio ? (audio.name ?? audio.filename ?? null) : null,
    attachmentMime: audio ? (audio.mimetype ?? audio.mime ?? null) : null,
  };
}
