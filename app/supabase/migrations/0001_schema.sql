-- ═══════════════════════════════════════════════════════════════════════════
-- Agent Rivo — schema
-- One application role (regional_manager). Fixture string ids (store_lyon,
-- visit_001, report_004, SOP-03) are preserved directly as primary keys so the
-- seeded source references still resolve after import.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type visit_state as enum ('collecting', 'ready_for_review', 'validated', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_state as enum ('draft', 'validated');
exception when duplicate_object then null; end $$;

do $$ begin
  -- How a stored message reached us / what it represents in the timeline.
  create type message_kind as enum ('text', 'audio', 'correction', 'procedural_question', 'validation', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transcription_status as enum ('not_applicable', 'pending', 'done', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

-- ── Users & stores ───────────────────────────────────────────────────────────
-- app_users mirrors the fixture identities. auth_user_id binds to Supabase Auth;
-- whatsapp_sender_id binds a verified provider sender. Both are server-controlled.
create table if not exists app_users (
  id                 text primary key,
  display_name       text not null,
  role               text not null default 'regional_manager',
  test_email         text,
  auth_user_id       uuid unique references auth.users (id) on delete set null,
  whatsapp_sender_id text unique,
  created_at         timestamptz not null default now()
);

create table if not exists stores (
  id                 text primary key,
  name               text not null,
  city               text not null,
  timezone           text not null default 'Europe/Paris',
  local_contact_name text
);

-- Store scope lives in protected data, never in user-editable profile metadata.
create table if not exists store_memberships (
  user_id  text not null references app_users (id) on delete cascade,
  store_id text not null references stores (id) on delete cascade,
  primary key (user_id, store_id)
);

-- ── Visits ─────────────────────────────────────────────────────────────────--
create table if not exists visits (
  id                   text primary key default ('visit_' || replace(gen_random_uuid()::text, '-', '')),
  store_id             text not null references stores (id),
  author_id            text not null references app_users (id),
  state                visit_state not null default 'collecting',
  started_at           timestamptz not null default now(),
  validated_at         timestamptz,
  report_id            text,
  latest_draft_version int not null default 0,
  -- The draft version last shown to the user in WhatsApp; validation is bound to it.
  last_shown_version   int,
  -- Transient assistant memory: a pending disambiguation / store-switch prompt.
  pending_action       jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists visits_author_idx on visits (author_id);
create index if not exists visits_store_idx on visits (store_id);
-- At most one active (collecting|ready_for_review) visit per user.
create unique index if not exists visits_one_active_per_user
  on visits (author_id)
  where state in ('collecting', 'ready_for_review');

-- ── Messages (source timeline) ───────────────────────────────────────────────
create table if not exists messages (
  id                    text primary key default ('msg_' || replace(gen_random_uuid()::text, '-', '')),
  visit_id              text references visits (id) on delete cascade,
  actor_id              text references app_users (id),
  direction             message_direction not null default 'inbound',
  kind                  message_kind not null,
  received_at           timestamptz not null default now(),
  text                  text,
  -- Private Storage object path for the original audio (never a public URL).
  audio_path            text,
  audio_mime            text,
  transcript            text,               -- what the speech service actually returned
  original_transcript   text,              -- preserved verbatim even after a correction
  transcription_status  transcription_status not null default 'not_applicable',
  transcription_error   text,
  -- Provider dedup key. Deduplicate on (account + provider message id), not text.
  provider_account_id   text,
  provider_message_id   text,
  raw                   jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists messages_visit_idx on messages (visit_id, received_at);
create unique index if not exists messages_provider_dedup
  on messages (provider_account_id, provider_message_id)
  where provider_message_id is not null;

-- Notes captured before the user has chosen a store. Held per user, then either
-- attached to a freshly started visit or discarded on cancel.
create table if not exists pending_inputs (
  id                    text primary key default ('pend_' || replace(gen_random_uuid()::text, '-', '')),
  user_id               text not null references app_users (id) on delete cascade,
  kind                  message_kind not null,
  received_at           timestamptz not null default now(),
  text                  text,
  audio_path            text,
  audio_mime            text,
  transcript            text,
  transcription_status  transcription_status not null default 'not_applicable',
  provider_account_id   text,
  provider_message_id   text,
  consumed_by_visit     text references visits (id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists pending_user_idx on pending_inputs (user_id) where consumed_by_visit is null;

-- ── Reports (versioned head per visit; validated snapshot is immutable) ───────
create table if not exists reports (
  id                    text primary key default ('report_' || replace(gen_random_uuid()::text, '-', '')),
  visit_id              text not null unique references visits (id) on delete cascade,
  store_id              text not null references stores (id),
  author_id             text not null references app_users (id),
  state                 report_state not null default 'draft',
  version               int not null default 1,
  title                 text not null,
  summary               text not null default '',
  -- findings: [{ category, kind, text, source_message_ids[] }]
  findings              jsonb not null default '[]'::jsonb,
  -- followup_notes: [{ text, source_message_ids[] }]
  followup_notes        jsonb not null default '[]'::jsonb,
  validated_by          text references app_users (id),
  validated_at          timestamptz,
  validation_message_id text,
  updated_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
create index if not exists reports_store_idx on reports (store_id);
create index if not exists reports_state_idx on reports (state);

-- ── Idempotency ledger for provider events (webhook replay safety) ────────────
create table if not exists processed_events (
  provider_account_id text not null,
  provider_message_id text not null,
  effect              text not null,        -- e.g. 'ingested', 'validated'
  processed_at        timestamptz not null default now(),
  primary key (provider_account_id, provider_message_id)
);

-- ── RAG corpus ────────────────────────────────────────────────────────────────
create table if not exists documents (
  id             text primary key,          -- SOP-01 … SOP-05
  title          text not null,
  version        text not null,
  effective_from date,
  network_id     text,
  path           text
);

create table if not exists document_chunks (
  id           text primary key default ('chunk_' || replace(gen_random_uuid()::text, '-', '')),
  document_id  text not null references documents (id) on delete cascade,
  section      text,
  ordinal      int not null,
  content      text not null,
  embedding    vector(384)                  -- Supabase/gte-small
);
create index if not exists chunks_doc_idx on document_chunks (document_id, ordinal);

-- FK from visit.report_id added after reports exists.
do $$ begin
  alter table visits
    add constraint visits_report_fk foreign key (report_id) references reports (id) on delete set null;
exception when duplicate_object then null; end $$;

-- keep reports.updated_at fresh
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists reports_touch on reports;
create trigger reports_touch before update on reports
  for each row execute function touch_updated_at();
