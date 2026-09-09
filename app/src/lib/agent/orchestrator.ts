import type { AppUser, Message, Store, Visit } from "@/lib/types";
import { now } from "@/lib/clock";
import { transcribeAudio } from "@/lib/groq";
import { uploadAudio } from "@/lib/storage";
import { classifyIntent, type Intent } from "@/lib/agent/intent";
import { generateReport } from "@/lib/agent/report";
import { answerProcedureQuestion } from "@/lib/agent/procedure";
import { detectAmbiguity } from "@/lib/agent/correction";
import { renderDraftForWhatsapp } from "@/lib/agent/reply";
import { storeIdsForUser } from "@/lib/access";
import * as repo from "@/lib/agent/repo";

/**
 * The conversation brain. Deterministic state machine over an LLM intent
 * classifier. All persistence happens here; the model never writes state.
 */

export interface InboundInput {
  kind: "text" | "audio";
  text?: string | null;
  audioBytes?: Uint8Array | null;
  audioFilename?: string | null;
  audioMime?: string | null;
  receivedAt: string; // ISO
  providerAccountId?: string | null;
  providerMessageId?: string | null;
}

export interface AgentResult {
  reply: string;
  effect: string;
  duplicate?: boolean;
}

const SOURCE_INTENTS = new Set(["start_visit", "add_note", "correction"]);
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB per handbook limit

export async function handleInbound(user: AppUser, input: InboundInput): Promise<AgentResult> {
  const acct = input.providerAccountId ?? null;
  const pmid = input.providerMessageId ?? null;

  // ── Replay safety: one effect per provider event ──────────────────────────
  if (acct && pmid && (await repo.alreadyProcessed(acct, pmid))) {
    return { reply: "", effect: "duplicate_ignored", duplicate: true };
  }

  const active = await repo.getActiveVisit(user.id);

  // ── Ingest: transcribe audio, persist the inbound message ─────────────────
  let effectiveText = input.text ?? "";
  let audioPath: string | null = null;
  let transcript: string | null = null;
  let transcriptionStatus: Message["transcription_status"] = "not_applicable";
  let transcriptionError: string | null = null;

  if (input.kind === "audio") {
    if (!input.audioBytes) {
      return { reply: "That voice note could not be retrieved. Please resend it or type your note.", effect: "audio_missing" };
    }
    if (input.audioBytes.byteLength > MAX_AUDIO_BYTES) {
      return {
        reply: "That voice note is larger than 10 MB. Please send a shorter recording (up to ~2 minutes) or type your note.",
        effect: "audio_too_large",
      };
    }
    const ext = (input.audioFilename?.split(".").pop() ?? "wav").toLowerCase();
    const mime = input.audioMime ?? "audio/wav";
    audioPath = await uploadAudio(user.id, input.audioBytes, ext, mime);
    transcriptionStatus = "pending";
    try {
      transcript = await transcribeAudio(input.audioBytes, input.audioFilename ?? "note.wav");
      if (!transcript || transcript.trim().length === 0) throw new Error("empty transcript");
      transcriptionStatus = "done";
      effectiveText = transcript;
    } catch (err) {
      transcriptionStatus = "failed";
      transcriptionError = err instanceof Error ? err.message : "transcription failed";
    }
  }

  // Classify only when we have text to reason about.
  let intent: Intent | null = null;
  if (transcriptionStatus !== "failed" && effectiveText.trim().length > 0) {
    intent = await classifyIntent(effectiveText);
  }

  // Persist the inbound message. Attach to the active visit when one exists and
  // this is not a store-switch/procedure question (handled below).
  const attachVisitId =
    active && intent && intent.intent !== "store_switch" ? active.id : null;

  const message = await repo.insertMessage({
    visit_id: attachVisitId,
    actor_id: user.id,
    direction: "inbound",
    kind: input.kind,
    received_at: input.receivedAt,
    text: input.kind === "audio" ? null : input.text ?? null,
    audio_path: audioPath,
    audio_mime: input.audioMime ?? null,
    transcript,
    original_transcript: transcript, // preserved verbatim; corrections never overwrite it
    transcription_status: transcriptionStatus,
    transcription_error: transcriptionError,
    provider_account_id: acct,
    provider_message_id: pmid,
    raw: intent ? { intent: intent.intent, confidence: intent.confidence } : {},
  });

  // Failed transcription: keep the note visible, offer retry. Never fabricate.
  if (transcriptionStatus === "failed") {
    if (acct && pmid) await repo.markProcessed(acct, pmid, "audio_failed");
    return {
      reply:
        "⚠️ I couldn't transcribe that voice note (it may be silent or corrupted). Your earlier notes are safe. Please resend the voice note or type the observation instead.",
      effect: "transcription_failed",
    };
  }

  if (!intent) {
    if (acct && pmid) await repo.markProcessed(acct, pmid, "empty");
    return { reply: "I didn't catch that. Could you send your observation as text or a voice note?", effect: "empty" };
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const ctx: Ctx = { user, active, intent, message, effectiveText };
  let result: AgentResult;
  switch (intent.intent) {
    case "start_visit":
      result = await onStartVisit(ctx);
      break;
    case "add_note":
      result = await onAddNote(ctx);
      break;
    case "correction":
      result = await onCorrection(ctx);
      break;
    case "request_draft":
      result = await onRequestDraft(ctx);
      break;
    case "validate":
      result = await onValidate(ctx);
      break;
    case "procedure_question":
      result = await onProcedureQuestion(ctx);
      break;
    case "historical_query":
      result = await onHistoricalQuery(ctx);
      break;
    case "store_switch":
      result = await onStoreSwitch(ctx);
      break;
    case "cancel":
      result = await onCancel(ctx);
      break;
    default:
      result = await onOther(ctx);
  }

  if (acct && pmid) await repo.markProcessed(acct, pmid, result.effect);
  // Persist the assistant reply so the conversation is fully inspectable.
  if (result.reply) {
    await repo.insertMessage({
      visit_id: (await repo.getActiveVisit(user.id))?.id ?? attachVisitId,
      actor_id: null,
      direction: "outbound",
      kind: "system",
      received_at: now().toISOString(),
      text: result.reply,
    });
  }
  return result;
}

interface Ctx {
  user: AppUser;
  active: Visit | null;
  intent: Intent;
  message: Message;
  effectiveText: string;
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function onStartVisit(ctx: Ctx): Promise<AgentResult> {
  const { user, active, intent, message } = ctx;

  if (active) {
    // Already visiting. If they named a different store, that's a switch.
    if (intent.store_name) {
      const target = await repo.findStoreForUser(user.id, intent.store_name);
      const current = await repo.getVisit(active.id);
      if (target && current && target.id !== current.store_id) {
        return onStoreSwitch(ctx);
      }
    }
    // Otherwise treat any observations as notes on the active visit.
    return onAddNote(ctx);
  }

  if (!intent.store_name) {
    // Hold observations as pending; ask which authorised store.
    if (intent.observations) {
      await repo.updateMessage(message.id, { visit_id: null });
      await repo.addPendingInput({
        userId: user.id,
        kind: "text",
        receivedAt: message.received_at,
        text: intent.observations,
      });
    }
    return { reply: await askWhichStore(user.id), effect: "await_store" };
  }

  const store = await repo.findStoreForUser(user.id, intent.store_name);
  if (!store) {
    if (intent.observations) {
      await repo.updateMessage(message.id, { visit_id: null });
      await repo.addPendingInput({
        userId: user.id,
        kind: "text",
        receivedAt: message.received_at,
        text: intent.observations,
      });
    }
    return {
      reply: `I couldn't find an authorised store called “${intent.store_name}”. ${await askWhichStore(user.id)}`,
      effect: "store_not_authorised",
    };
  }

  // Start the visit and attach this message + any pending inputs.
  const visit = await repo.createVisit(user.id, store.id, message.received_at);
  await repo.updateMessage(message.id, { visit_id: visit.id });
  await attachPending(user.id, visit.id);

  const ack = intent.observations
    ? `✅ Started a visit to *${store.name}*. I've noted: ${intent.observations}\n\nSend more observations (text or voice), or say “prepare the report”.`
    : `✅ Started a visit to *${store.name}*. Send your observations as text or voice notes. Say “prepare the report” when you're ready.`;
  return { reply: ack, effect: "visit_started" };
}

async function onAddNote(ctx: Ctx): Promise<AgentResult> {
  const { user, active, intent, message } = ctx;
  if (!active) {
    // Observation before any store chosen — hold it, ask for the store.
    await repo.updateMessage(message.id, { visit_id: null });
    await repo.addPendingInput({
      userId: user.id,
      kind: message.kind,
      receivedAt: message.received_at,
      text: message.kind === "audio" ? null : ctx.effectiveText,
      audioPath: message.audio_path,
      audioMime: message.audio_mime,
      transcript: message.transcript,
      transcriptionStatus: message.transcription_status,
    });
    return { reply: await askWhichStore(user.id), effect: "await_store" };
  }

  // If a draft already exists, new information changes it → regenerate & show.
  if (active.state === "ready_for_review") {
    return regenerateAndPresent(active.id, "Noted. Here's the updated draft:");
  }
  const what = intent.observations ?? ctx.effectiveText;
  return { reply: `Noted for this visit: ${trim(what)}. Send more, or say “prepare the report”.`, effect: "note_added" };
}

async function onCorrection(ctx: Ctx): Promise<AgentResult> {
  const { user, active, intent, message } = ctx;
  if (!active) {
    await repo.updateMessage(message.id, { visit_id: null });
    return { reply: "There's no active visit to correct. Start a visit first.", effect: "no_visit" };
  }
  const instruction = intent.correction_instruction ?? ctx.effectiveText;

  // Gather current statements to check for ambiguity.
  const report = await repo.getReportByVisit(active.id);
  const statements = report
    ? report.findings.map((f) => f.text)
    : (await sourceMessages(active.id)).map((m) => sourceText(m));

  const { ambiguous, candidates } = await detectAmbiguity(statements, instruction);
  if (ambiguous) {
    await repo.setPendingAction(active.id, {
      type: "disambiguate_correction",
      instruction,
      candidates,
    });
    const list = candidates.map((c, i) => `${i + 1}. ${c}`).join("\n");
    return {
      reply: `Which one do you mean?\n${list}\n\nReply with the exact statement to change or remove.`,
      effect: "correction_ambiguous",
    };
  }

  // Unambiguous: the correction message is kept in the timeline (originals stay
  // intact) and the report is regenerated to reflect it.
  await repo.setPendingAction(active.id, null);
  if (report) {
    return regenerateAndPresent(active.id, "Updated. Here's the amended draft:");
  }
  return { reply: `Noted your correction: “${trim(instruction)}”. It will be reflected in the report.`, effect: "correction_noted" };
}

async function onRequestDraft(ctx: Ctx): Promise<AgentResult> {
  const { user, active } = ctx;
  if (!active) return { reply: await askWhichStore(user.id, "You have no active visit. "), effect: "no_visit" };

  const gate = await transcriptionGate(active.id);
  if (gate) return gate;

  return regenerateAndPresent(active.id, "");
}

async function onValidate(ctx: Ctx): Promise<AgentResult> {
  const { user, active, intent, message } = ctx;
  if (!active) return { reply: "There's no draft to validate. Start a visit and prepare a report first.", effect: "no_visit" };

  const gate = await transcriptionGate(active.id);
  if (gate) return gate;

  let report = await repo.getReportByVisit(active.id);
  const visit = await repo.getVisit(active.id);
  if (!report || !visit) {
    // No draft yet — prepare one instead of finalising nothing.
    return regenerateAndPresent(active.id, "Here's your draft. Review it, then reply “I validate this draft”.");
  }

  // Idempotent replay of the same validation message.
  if (report.state === "validated" && report.validation_message_id === message.id) {
    return { reply: `Already validated. Report reference: ${report.id}.`, effect: "validate_noop" };
  }

  // Version-aware: never finalise a version the user hasn't reviewed.
  if (intent.validate_version != null && intent.validate_version !== report.version) {
    await repo.updateVisit(active.id, { last_shown_version: report.version });
    return {
      reply:
        `Draft ${intent.validate_version} is no longer current — the latest is draft ${report.version}. Please review it below and validate that version.\n\n` +
        renderDraftForWhatsapp({
          storeName: (await storeName(report.store_id)) ?? report.store_id,
          version: report.version,
          summary: report.summary,
          findings: report.findings,
          followups: report.followup_notes,
        }),
      effect: "validate_stale_version",
    };
  }
  if (visit.last_shown_version !== report.version) {
    await repo.updateVisit(active.id, { last_shown_version: report.version });
    return {
      reply:
        `The draft changed since you last saw it. Please review draft ${report.version} and validate again:\n\n` +
        renderDraftForWhatsapp({
          storeName: (await storeName(report.store_id)) ?? report.store_id,
          version: report.version,
          summary: report.summary,
          findings: report.findings,
          followups: report.followup_notes,
        }),
      effect: "validate_needs_review",
    };
  }

  await repo.validateReport({
    reportId: report.id,
    visitId: active.id,
    userId: user.id,
    validatedAt: now().toISOString(),
    validationMessageId: message.id,
  });
  await repo.updateMessage(message.id, { raw: { intent: "validation" } });
  return {
    reply: `✅ Draft ${report.version} validated. Your report for *${await storeName(report.store_id)}* is final.\nReport reference: ${report.id}. You can start a new visit any time.`,
    effect: "validated",
  };
}

async function onProcedureQuestion(ctx: Ctx): Promise<AgentResult> {
  const { intent, message } = ctx;
  // A procedure question must not become a visit observation or change the store.
  await repo.updateMessage(message.id, { raw: { intent: "procedure_question" } });
  const question = intent.question ?? ctx.effectiveText;
  const ans = await answerProcedureQuestion(question);
  const cite = ans.citations.length ? `\n\n📎 Source: ${ans.citations.join("; ")}` : "";
  return { reply: `${ans.text}${cite}`, effect: "procedure_answered" };
}

async function onHistoricalQuery(ctx: Ctx): Promise<AgentResult> {
  const { user, intent } = ctx;
  const name = intent.store_name;
  if (!name) return { reply: "Which store's history would you like — and which date or “latest”?", effect: "history_need_store" };
  const store = await repo.findStoreForUser(user.id, name);
  if (!store) return { reply: `You don't have access to a store called “${name}”.`, effect: "history_denied" };

  const report = await latestValidatedReport(store.id);
  if (!report) return { reply: `No validated reports found for ${store.name}.`, effect: "history_empty" };
  return {
    reply: `Your latest validated ${store.name} report (${report.validated_at?.slice(0, 10)}), reference ${report.id}:\n\n${report.summary}`,
    effect: "history_answered",
  };
}

async function onStoreSwitch(ctx: Ctx): Promise<AgentResult> {
  const { user, active, intent, message } = ctx;
  if (!active) return onStartVisit(ctx); // no active visit → just start it
  const target = intent.store_name ? await repo.findStoreForUser(user.id, intent.store_name) : null;

  // Do NOT attach this message's observation to the current store. Hold it.
  await repo.updateMessage(message.id, { visit_id: null });
  if (intent.observations) {
    await repo.addPendingInput({
      userId: user.id,
      kind: "text",
      receivedAt: message.received_at,
      text: intent.observations,
    });
  }
  const curStore = await storeName((await repo.getVisit(active.id))!.store_id);
  await repo.setPendingAction(active.id, {
    type: "confirm_store_switch",
    target_store_id: target?.id ?? "",
    pending_note: intent.observations ?? undefined,
  });
  return {
    reply: `You have an active visit at *${curStore}*. Please finish it (say “prepare the report” then validate) or cancel it (“cancel this visit”) before starting ${target ? `*${target.name}*` : "another store"}. I've kept your new note aside.`,
    effect: "await_switch_decision",
  };
}

async function onCancel(ctx: Ctx): Promise<AgentResult> {
  const { user, active, intent } = ctx;
  if (!active) return { reply: "There's no active visit to cancel.", effect: "no_visit" };
  const cancelledStore = await storeName((await repo.getVisit(active.id))!.store_id);
  await repo.updateVisit(active.id, { state: "cancelled", pending_action: null });

  // "Cancel Lyon and start Nantes" — start the named store with any held note.
  if (intent.store_name) {
    const store = await repo.findStoreForUser(user.id, intent.store_name);
    if (store) {
      const visit = await repo.createVisit(user.id, store.id, now().toISOString());
      await attachPending(user.id, visit.id);
      return {
        reply: `Cancelled the ${cancelledStore} visit (no report saved). ✅ Started a visit to *${store.name}* with your held note. Send more observations or say “prepare the report”.`,
        effect: "cancelled_and_started",
      };
    }
  }
  await repo.discardPendingInputs(user.id);
  return { reply: `Cancelled the ${cancelledStore} visit. No report was saved. You can start a new visit any time.`, effect: "cancelled" };
}

async function onOther(ctx: Ctx): Promise<AgentResult> {
  const { user, active, intent } = ctx;
  if (active && intent.observations) return onAddNote(ctx);
  return {
    reply: `Hi ${user.display_name.split(" ")[0]} 👋 I can help you record a store visit. Try “Start a visit to Lyon”, send observations as text or voice, then “prepare the report”. You can also ask what a procedure says.`,
    effect: "help",
  };
}

// ── Shared helpers ─────────────────────────────────────────────────────────

async function regenerateAndPresent(visitId: string, prefix: string): Promise<AgentResult> {
  const visit = await repo.getVisit(visitId);
  if (!visit) return { reply: "That visit is no longer available.", effect: "no_visit" };
  const store = (await repo.getStores()).find((s) => s.id === visit.store_id)!;
  const sources = await sourceMessages(visitId);
  if (sources.length === 0) {
    return { reply: "There are no observations yet. Send some notes first.", effect: "empty_visit" };
  }

  const generated = await generateReport(store, sources);
  const version = (visit.latest_draft_version ?? 0) + 1;
  await repo.upsertDraft({
    visitId,
    storeId: visit.store_id,
    authorId: visit.author_id,
    version,
    title: generated.title,
    summary: generated.summary,
    findings: generated.findings,
    followups: generated.followups,
  });
  await repo.updateVisit(visitId, {
    state: "ready_for_review",
    latest_draft_version: version,
    last_shown_version: version,
    pending_action: null,
  });

  const body = renderDraftForWhatsapp({
    storeName: store.name,
    version,
    summary: generated.summary,
    findings: generated.findings,
    followups: generated.followups,
  });
  return { reply: prefix ? `${prefix}\n\n${body}` : body, effect: "draft_ready" };
}

/** Inbound observation-bearing messages for a visit (excludes procedure
 *  questions, validations and assistant replies). */
async function sourceMessages(visitId: string): Promise<Message[]> {
  const all = await repo.getVisitMessages(visitId);
  return all.filter((m) => {
    if (m.direction !== "inbound") return false;
    const intent = (m as unknown as { raw?: { intent?: string } }).raw?.intent;
    if (!intent) return true; // untagged inbound (e.g. attached pending) counts
    return SOURCE_INTENTS.has(intent);
  });
}

function sourceText(m: Message): string {
  return m.kind === "audio" ? m.transcript ?? "" : m.text ?? "";
}

/** Block draft/validation while an accepted voice note is still transcribing. */
async function transcriptionGate(visitId: string): Promise<AgentResult | null> {
  const all = await repo.getVisitMessages(visitId);
  const pending = all.find((m) => m.transcription_status === "pending");
  if (pending) {
    return {
      reply: "One of your voice notes is still being transcribed. I'll include it — please try again in a moment.",
      effect: "await_transcription",
    };
  }
  const failed = all.filter((m) => m.transcription_status === "failed");
  if (failed.length) {
    return {
      reply: `⚠️ ${failed.length} voice note(s) failed to transcribe and can't be included. Please resend them or type the observation, then ask again.`,
      effect: "blocked_failed_audio",
    };
  }
  return null;
}

async function attachPending(userId: string, visitId: string): Promise<void> {
  const pend = await repo.takePendingInputs(userId);
  for (const p of pend) {
    await repo.insertMessage({
      visit_id: visitId,
      actor_id: userId,
      direction: "inbound",
      kind: p.kind,
      received_at: p.received_at,
      text: p.text,
      audio_path: p.audio_path,
      audio_mime: p.audio_mime,
      transcript: p.transcript,
      original_transcript: p.transcript,
      transcription_status: p.transcription_status,
      provider_account_id: p.provider_account_id,
      provider_message_id: p.provider_message_id ? `${p.provider_message_id}#attached` : null,
      raw: { intent: "add_note" },
    });
  }
  await repo.consumePendingInputs(userId, visitId);
}

async function askWhichStore(userId: string, prefix = ""): Promise<string> {
  const ids = await storeIdsForUser(userId);
  const stores = (await repo.getStores()).filter((s) => ids.includes(s.id));
  const names = stores.map((s) => s.name).join(" or ");
  return `${prefix}Which store are you visiting — ${names}?`;
}

async function storeName(storeId: string): Promise<string> {
  return (await repo.getStores()).find((s) => s.id === storeId)?.name ?? storeId;
}

async function latestValidatedReport(storeId: string) {
  const { serviceClient } = await import("@/lib/supabase/service");
  const { data } = await serviceClient()
    .from("reports")
    .select("*")
    .eq("store_id", storeId)
    .eq("state", "validated")
    .order("validated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; summary: string; validated_at: string | null } | null;
}

function trim(s: string, n = 140): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
