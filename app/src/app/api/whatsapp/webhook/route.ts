import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getUserByWhatsappSender } from "@/lib/access";
import { fetchAttachmentBytes, sendWhatsappText } from "@/lib/unipile";
import { handleInbound, type InboundInput } from "@/lib/agent/orchestrator";
import { serviceClient } from "@/lib/supabase/service";
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

  // Log the exact provider identifiers so an operator can bind the sender to a
  // fixture user. Visible in Vercel → Logs. No message content is logged.
  console.log(
    `[webhook] inbound sender="${evt.senderId}" account="${evt.accountId}" type=${evt.type} chat="${evt.chatId}"`,
  );

  const user = await getUserByWhatsappSender(evt.senderId);
  if (!user) {
    console.log(`[webhook] UNKNOWN sender "${evt.senderId}" — bind it to a user with WHATSAPP_SENDER_ANIKA + npm run provision`);
    // Record the unrecognised sender so an operator can read the exact id from
    // the database and bind it (no need to scrape server logs). Best-effort.
    try {
      await serviceClient()
        .from("messages")
        .upsert(
          {
            actor_id: null,
            direction: "inbound",
            kind: "system",
            received_at: now().toISOString(),
            text: `UNKNOWN_WHATSAPP_SENDER=${evt.senderId} chat=${evt.chatId ?? ""}`,
            provider_account_id: evt.accountId,
            provider_message_id: evt.messageId,
          },
          { onConflict: "provider_account_id,provider_message_id" },
        );
    } catch (e) {
      console.error("[webhook] failed to record unknown sender", e);
    }
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

  if (evt.type === "audio" && (evt.attachmentId || evt.attachmentUrl)) {
    try {
      const bytes = await fetchAttachmentBytes(evt.messageId, evt.attachmentId ?? "", evt.attachmentUrl);
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
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
}

/**
 * Extract a Unipile "message_received" event. Field names follow the current
 * Unipile webhook payload (top-level account_id, message_id, chat_id, message;
 * sender.attendee_provider_id; attachments[] with id/type/mimetype/url), with
 * a few fallbacks in case a DSN nests them under `data`.
 */
function extractEvent(body: unknown): ParsedEvent | null {
  const b = body as Record<string, any>;
  const d = (b.data ?? b) as Record<string, any>; // some DSNs nest under data
  const eventType = String(b.event ?? d.event ?? b.type ?? "");
  // Only handle inbound new-message events; ignore reactions, reads, receipts,
  // account-status, etc. (If a DSN omits the event field, we fall through and
  // rely on message_id + sender presence below.)
  if (eventType && !/message_received|message\.received|new_message/i.test(eventType)) {
    return null;
  }

  const accountId = String(d.account_id ?? b.account_id ?? "");
  const messageId = String(d.message_id ?? d.id ?? b.message_id ?? "");
  const senderId = String(
    d.sender?.attendee_provider_id ?? b.sender?.attendee_provider_id ?? d.attendee_provider_id ?? "",
  );
  const chatId = d.chat_id ?? b.chat_id ?? d.chat?.id ?? null;
  if (!messageId || !senderId) return null;

  // Unipile puts the text in `message`.
  const text =
    typeof d.message === "string"
      ? d.message
      : typeof d.text === "string"
        ? d.text
        : (d.body ?? null);

  const attachments = d.attachments ?? b.attachments ?? [];
  const audio = attachments.find((a: any) =>
    /audio|voice|ptt|ogg|opus/i.test(`${a.type ?? ""} ${a.mimetype ?? ""}`),
  );
  const isAudio = Boolean(audio) || /audio|voice|ptt/i.test(d.message_type ?? d.type ?? "");

  return {
    accountId,
    messageId,
    senderId,
    chatId: chatId ? String(chatId) : null,
    type: isAudio ? "audio" : "text",
    text,
    receivedAt: d.timestamp ?? d.date ?? null,
    attachmentId: audio ? String(audio.id ?? audio.attachment_id ?? "") : null,
    attachmentUrl: audio ? (audio.url ?? null) : null,
    attachmentName: audio ? (audio.name ?? audio.filename ?? null) : null,
    attachmentMime: audio ? (audio.mimetype ?? audio.mime ?? null) : null,
  };
}
