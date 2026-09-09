import { serviceClient } from "@/lib/supabase/service";
import type {
  Finding,
  FollowupNote,
  Message,
  MessageKind,
  PendingAction,
  Report,
  Store,
  Visit,
} from "@/lib/types";

const db = serviceClient;

// ── Stores ────────────────────────────────────────────────────────────────
export async function getStores(): Promise<Store[]> {
  const { data } = await db().from("stores").select("*");
  return (data ?? []) as Store[];
}

export async function findStoreForUser(
  userId: string,
  spokenName: string,
): Promise<Store | null> {
  // Match a store the user is authorised for by name or city (case-insensitive,
  // substring). "Lyon", "Atlas Lyon Centre" and "the Lyon store" all resolve.
  const { data: memberships } = await db()
    .from("store_memberships")
    .select("store_id, stores(*)")
    .eq("user_id", userId);
  const stores = (memberships ?? [])
    .map((m: { stores: Store | Store[] }) => (Array.isArray(m.stores) ? m.stores[0] : m.stores))
    .filter(Boolean) as Store[];
  const needle = spokenName.toLowerCase();
  return (
    stores.find(
      (s) =>
        needle.includes(s.city.toLowerCase()) ||
        needle.includes(s.name.toLowerCase()) ||
        s.name.toLowerCase().includes(needle) ||
        s.city.toLowerCase() === needle,
    ) ?? null
  );
}

// ── Visits ────────────────────────────────────────────────────────────────
export async function getActiveVisit(userId: string): Promise<Visit | null> {
  const { data } = await db()
    .from("visits")
    .select("*")
    .eq("author_id", userId)
    .in("state", ["collecting", "ready_for_review"])
    .maybeSingle();
  return (data as Visit) ?? null;
}

export async function getVisit(visitId: string): Promise<Visit | null> {
  const { data } = await db().from("visits").select("*").eq("id", visitId).maybeSingle();
  return (data as Visit) ?? null;
}

export async function createVisit(
  userId: string,
  storeId: string,
  startedAt: string,
): Promise<Visit> {
  const { data, error } = await db()
    .from("visits")
    .insert({ author_id: userId, store_id: storeId, state: "collecting", started_at: startedAt })
    .select("*")
    .single();
  if (error) throw new Error(`createVisit failed: ${error.message}`);
  return data as Visit;
}

export async function updateVisit(visitId: string, patch: Partial<Visit>): Promise<void> {
  const { error } = await db().from("visits").update(patch).eq("id", visitId);
  if (error) throw new Error(`updateVisit failed: ${error.message}`);
}

export async function setPendingAction(
  visitId: string,
  action: PendingAction | null,
): Promise<void> {
  await updateVisit(visitId, { pending_action: action });
}

// ── Messages ────────────────────────────────────────────────────────────────
export interface NewMessage {
  visit_id?: string | null;
  actor_id: string | null;
  direction?: "inbound" | "outbound";
  kind: MessageKind;
  received_at: string;
  text?: string | null;
  audio_path?: string | null;
  audio_mime?: string | null;
  transcript?: string | null;
  original_transcript?: string | null;
  transcription_status?: Message["transcription_status"];
  transcription_error?: string | null;
  provider_account_id?: string | null;
  provider_message_id?: string | null;
  raw?: Record<string, unknown> | null;
}

export async function insertMessage(m: NewMessage): Promise<Message> {
  const { data, error } = await db()
    .from("messages")
    .insert({ direction: "inbound", ...m })
    .select("*")
    .single();
  if (error) throw new Error(`insertMessage failed: ${error.message}`);
  return data as Message;
}

export async function updateMessage(id: string, patch: Partial<Message>): Promise<void> {
  await db().from("messages").update(patch).eq("id", id);
}

export async function getVisitMessages(visitId: string): Promise<Message[]> {
  const { data } = await db()
    .from("messages")
    .select("*")
    .eq("visit_id", visitId)
    .order("received_at", { ascending: true });
  return (data ?? []) as Message[];
}

/** True if this provider event was already ingested (replay/dedup). */
export async function alreadyProcessed(
  accountId: string,
  messageId: string,
): Promise<boolean> {
  const { data } = await db()
    .from("processed_events")
    .select("provider_message_id")
    .eq("provider_account_id", accountId)
    .eq("provider_message_id", messageId)
    .maybeSingle();
  return Boolean(data);
}

export async function markProcessed(
  accountId: string,
  messageId: string,
  effect: string,
): Promise<void> {
  await db()
    .from("processed_events")
    .upsert(
      { provider_account_id: accountId, provider_message_id: messageId, effect },
      { onConflict: "provider_account_id,provider_message_id" },
    );
}

// ── Pending inputs (notes before a store is chosen) ──────────────────────────
export async function addPendingInput(input: {
  userId: string;
  kind: MessageKind;
  receivedAt: string;
  text?: string | null;
  audioPath?: string | null;
  audioMime?: string | null;
  transcript?: string | null;
  transcriptionStatus?: Message["transcription_status"];
  providerAccountId?: string | null;
  providerMessageId?: string | null;
}): Promise<void> {
  await db().from("pending_inputs").insert({
    user_id: input.userId,
    kind: input.kind,
    received_at: input.receivedAt,
    text: input.text ?? null,
    audio_path: input.audioPath ?? null,
    audio_mime: input.audioMime ?? null,
    transcript: input.transcript ?? null,
    transcription_status: input.transcriptionStatus ?? "not_applicable",
    provider_account_id: input.providerAccountId ?? null,
    provider_message_id: input.providerMessageId ?? null,
  });
}

export async function takePendingInputs(userId: string) {
  const { data } = await db()
    .from("pending_inputs")
    .select("*")
    .eq("user_id", userId)
    .is("consumed_by_visit", null)
    .order("received_at", { ascending: true });
  return data ?? [];
}

export async function consumePendingInputs(userId: string, visitId: string): Promise<void> {
  await db()
    .from("pending_inputs")
    .update({ consumed_by_visit: visitId })
    .eq("user_id", userId)
    .is("consumed_by_visit", null);
}

export async function discardPendingInputs(userId: string): Promise<void> {
  // Mark as consumed by nothing meaningful is impossible (FK); instead delete.
  await db().from("pending_inputs").delete().eq("user_id", userId).is("consumed_by_visit", null);
}

// ── Reports ────────────────────────────────────────────────────────────────
export async function getReportByVisit(visitId: string): Promise<Report | null> {
  const { data } = await db().from("reports").select("*").eq("visit_id", visitId).maybeSingle();
  return (data as Report) ?? null;
}

export async function upsertDraft(args: {
  visitId: string;
  storeId: string;
  authorId: string;
  version: number;
  title: string;
  summary: string;
  findings: Finding[];
  followups: FollowupNote[];
}): Promise<Report> {
  const existing = await getReportByVisit(args.visitId);
  if (existing) {
    const { data, error } = await db()
      .from("reports")
      .update({
        version: args.version,
        title: args.title,
        summary: args.summary,
        findings: args.findings,
        followup_notes: args.followups,
        state: "draft",
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`upsertDraft update failed: ${error.message}`);
    return data as Report;
  }
  const { data, error } = await db()
    .from("reports")
    .insert({
      visit_id: args.visitId,
      store_id: args.storeId,
      author_id: args.authorId,
      state: "draft",
      version: args.version,
      title: args.title,
      summary: args.summary,
      findings: args.findings,
      followup_notes: args.followups,
    })
    .select("*")
    .single();
  if (error) throw new Error(`upsertDraft insert failed: ${error.message}`);
  return data as Report;
}

export async function validateReport(args: {
  reportId: string;
  visitId: string;
  userId: string;
  validatedAt: string;
  validationMessageId: string;
}): Promise<void> {
  await db()
    .from("reports")
    .update({
      state: "validated",
      validated_by: args.userId,
      validated_at: args.validatedAt,
      validation_message_id: args.validationMessageId,
    })
    .eq("id", args.reportId);
  await db()
    .from("visits")
    .update({ state: "validated", validated_at: args.validatedAt, report_id: args.reportId })
    .eq("id", args.visitId);
}
