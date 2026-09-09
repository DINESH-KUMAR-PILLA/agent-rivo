-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- The dashboard talks to Supabase from the browser with the signed-in user's
-- JWT. Every client-readable business table is scoped here so a guessed id,
-- changed route param or "I am Anika" text cannot leak another user's store.
--
-- The webhook/backend uses the service_role key, which BYPASSES RLS — so the
-- server enforces the same scope in code (see src/lib/access.ts). RLS is the
-- backstop for anything reachable from the browser.
-- ═══════════════════════════════════════════════════════════════════════════

-- Map the Supabase auth uid → our app_users.id. SECURITY DEFINER so it can read
-- app_users without recursing through that table's own policies.
create or replace function current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from app_users where auth_user_id = auth.uid();
$$;

-- Store ids the current user may access.
create or replace function my_store_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select store_id from store_memberships where user_id = current_app_user_id();
$$;

alter table app_users        enable row level security;
alter table stores           enable row level security;
alter table store_memberships enable row level security;
alter table visits           enable row level security;
alter table messages         enable row level security;
alter table pending_inputs   enable row level security;
alter table reports          enable row level security;
alter table documents        enable row level security;
alter table document_chunks  enable row level security;
alter table processed_events enable row level security;

-- app_users: a signed-in user may read their own row (for display name etc.).
drop policy if exists app_users_self on app_users;
create policy app_users_self on app_users
  for select using (auth_user_id = auth.uid());

-- stores: only assigned stores.
drop policy if exists stores_scoped on stores;
create policy stores_scoped on stores
  for select using (id in (select my_store_ids()));

-- memberships: own rows only.
drop policy if exists memberships_self on store_memberships;
create policy memberships_self on store_memberships
  for select using (user_id = current_app_user_id());

-- visits: store must be in scope AND (it is validated OR I authored it).
-- Unpublished drafts remain author-only; validated history is store-scoped.
drop policy if exists visits_read on visits;
create policy visits_read on visits
  for select using (
    store_id in (select my_store_ids())
    and (state = 'validated' or author_id = current_app_user_id())
  );

-- reports: same rule — validated readable within store scope, drafts author-only.
drop policy if exists reports_read on reports;
create policy reports_read on reports
  for select using (
    store_id in (select my_store_ids())
    and (state = 'validated' or author_id = current_app_user_id())
  );

-- messages: gated through the parent visit's readability.
drop policy if exists messages_read on messages;
create policy messages_read on messages
  for select using (
    visit_id in (
      select id from visits
      where store_id in (select my_store_ids())
        and (state = 'validated' or author_id = current_app_user_id())
    )
  );

-- pending_inputs: strictly the owning user.
drop policy if exists pending_self on pending_inputs;
create policy pending_self on pending_inputs
  for select using (user_id = current_app_user_id());

-- procedure corpus: readable by any authenticated app_user (both test users).
drop policy if exists documents_read on documents;
create policy documents_read on documents
  for select using (current_app_user_id() is not null);

drop policy if exists chunks_read on document_chunks;
create policy chunks_read on document_chunks
  for select using (current_app_user_id() is not null);

-- No client-side write policies are defined: all writes flow through the
-- service-role backend, which enforces scope in code. processed_events is
-- entirely server-side and exposes no policy (RLS on with no policy = deny).
