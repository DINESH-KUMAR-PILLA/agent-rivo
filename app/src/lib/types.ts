// Shared domain types. The report shape mirrors examples/expected-report.json.

export type VisitState = "collecting" | "ready_for_review" | "validated" | "cancelled";
export type ReportState = "draft" | "validated";
export type MessageKind =
  | "text"
  | "audio"
  | "correction"
  | "procedural_question"
  | "validation"
  | "system";
export type TranscriptionStatus = "not_applicable" | "pending" | "done" | "failed";

export type FindingCategory =
  | "front_area"
  | "interior_display"
  | "backroom"
  | "equipment"
  | "team"
  | "other";
export type FindingKind = "positive" | "issue" | "observation";

export interface Finding {
  category: FindingCategory;
  kind: FindingKind;
  text: string;
  source_message_ids: string[];
}

export interface FollowupNote {
  text: string;
  source_message_ids: string[];
}

export interface Store {
  id: string;
  name: string;
  city: string;
  timezone: string;
  local_contact_name: string | null;
}

export interface AppUser {
  id: string;
  display_name: string;
  role: string;
  test_email: string | null;
  auth_user_id: string | null;
  whatsapp_sender_id: string | null;
}

export interface Visit {
  id: string;
  store_id: string;
  author_id: string;
  state: VisitState;
  started_at: string;
  validated_at: string | null;
  report_id: string | null;
  latest_draft_version: number;
  last_shown_version: number | null;
  pending_action: PendingAction | null;
}

export interface Message {
  id: string;
  visit_id: string | null;
  actor_id: string | null;
  direction: "inbound" | "outbound";
  kind: MessageKind;
  received_at: string;
  text: string | null;
  audio_path: string | null;
  audio_mime: string | null;
  transcript: string | null;
  original_transcript: string | null;
  transcription_status: TranscriptionStatus;
  transcription_error: string | null;
  provider_account_id: string | null;
  provider_message_id: string | null;
  raw?: Record<string, unknown> | null;
}

export interface Report {
  id: string;
  visit_id: string;
  store_id: string;
  author_id: string;
  state: ReportState;
  version: number;
  title: string;
  summary: string;
  findings: Finding[];
  followup_notes: FollowupNote[];
  validated_by: string | null;
  validated_at: string | null;
  validation_message_id: string | null;
  updated_at: string;
}

/** Transient assistant memory persisted on a visit while awaiting a user reply. */
export type PendingAction =
  | { type: "disambiguate_correction"; instruction: string; candidates: string[] }
  | { type: "confirm_store_switch"; target_store_id: string; pending_note?: string };

export interface RetrievedChunk {
  id: string;
  document_id: string;
  section: string | null;
  ordinal: number;
  content: string;
  similarity: number;
}
