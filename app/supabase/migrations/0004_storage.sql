-- ═══════════════════════════════════════════════════════════════════════════
-- Private Storage bucket for original voice notes.
-- The bucket is PRIVATE. The browser never gets a public URL: the dashboard
-- asks the server for a short-lived signed URL, and the server only mints one
-- after checking the caller's store scope (see /api/audio). This keeps
-- "public-looking storage links must not bypass these rules" true.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('visit-audio', 'visit-audio', false)
on conflict (id) do nothing;

-- No permissive storage.objects policy is created for anon/authenticated roles,
-- so browser clients cannot list or read objects directly. Only the service
-- role (backend) can, and it signs URLs after an explicit scope check.
