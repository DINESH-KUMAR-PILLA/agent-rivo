# Agent Rivo — implementation

A working prototype of the Field Visit Reporting assistant from the candidate handbook.
A regional manager conducts a store visit over **WhatsApp** (text **and** voice), and the
conversation becomes an accurate, editable, explicitly-validated **visit report**. The same
manager reviews everything in a **web dashboard**.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres + Auth + Storage + pgvector) ·
Groq (LLM + Whisper STT) · Unipile (WhatsApp) · Transformers.js local embeddings (`gte-small`).
Deployed on **Vercel** — the dashboard and all backend logic (webhook, transcription, RAG,
validation) run as one Next.js app, so there is no separate server to keep alive.

> The whole application lives in this `app/` directory. The candidate-kit fixtures
> (`../data`, `../procedures`, `../audio`) are read by the seed/index scripts.

---

## Architecture at a glance

```
WhatsApp ──▶ Unipile ──▶ /api/whatsapp/webhook ─┐
                                                │   verify sender → agent brain
Local test runner ─▶ /api/test-runner ──────────┤   (intent → state machine → LLM)
                                                ▼
                                    ┌────────────────────────┐
                                    │  Supabase (service role)│  visits, messages, reports,
                                    │  RLS on client tables    │  private audio, pgvector RAG
                                    └────────────────────────┘
                                                ▲
Dashboard (Server Components, user JWT) ────────┘   RLS-scoped reads only
```

- **The model never writes state.** An LLM call classifies intent and drafts the report; all
  persistence and every state transition happen in deterministic TypeScript
  (`src/lib/agent/orchestrator.ts`).
- **Scope is enforced twice.** The browser reads Supabase under the user's JWT (RLS). The
  backend uses the service-role key (which bypasses RLS) and re-checks scope in code
  (`src/lib/access.ts`). A guessed id, changed route param, private storage URL or “I am Anika”
  text cannot leak another user's store.

Key modules:

| Path | Responsibility |
|---|---|
| `src/lib/agent/orchestrator.ts` | Conversation state machine (start/note/correct/draft/validate/switch/cancel) |
| `src/lib/agent/intent.ts` | LLM intent classification (zod-validated) |
| `src/lib/agent/report.ts` | Grounded report generation (no invented facts; cites source ids) |
| `src/lib/agent/procedure.ts` | RAG answers with citations + honest “not specified” |
| `src/lib/agent/repo.ts` | All DB operations, dedup, versioning |
| `src/app/api/whatsapp/webhook` | Unipile inbound: verify sender, fetch audio, reply |
| `src/app/api/test-runner` | Private local injector for the 2nd user, replay, scenarios |
| `src/app/api/audio/[messageId]` | Scope-checked signed URL for private voice notes |
| `supabase/migrations/*.sql` | Schema, RLS, pgvector, private storage bucket |

---

## Prerequisites

- Node.js 20+ (built on 22).
- A **Supabase** project (free tier).
- A **Groq** API key (free tier) — chat + `whisper-large-v3-turbo`.
- A **Unipile** account with a connected WhatsApp (7-day trial) — for the live journey only.

---

## Setup — step by step

### 1. Install

```bash
cd app
npm install
cp .env.example .env.local     # fill in as you go through the steps below
```

### 2. Create the Supabase project & run migrations  *(you do this)*

1. Create a new project at <https://supabase.com/dashboard>.
2. **Settings → API** — copy into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` ← Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← anon / publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` ← service_role secret (server-only, never in the browser)
3. **SQL Editor → New query** — run the four migration files **in order**:
   `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_rag.sql`, `0004_storage.sql`.
   (Or, with the Supabase CLI linked: `supabase db push`.)

That creates all tables, RLS policies, the `match_document_chunks` function and the private
`visit-audio` storage bucket.

### 3. Seed data, index procedures, provision users

```bash
npm run seed        # imports 3 stores, 2 users, 6 validated visits/reports/messages (idempotent)
npm run embed       # splits the 5 procedures into passages + local gte-small embeddings → pgvector
npm run provision   # creates the two Supabase Auth users and binds them to the fixtures
```

`npm run provision` prints the login credentials. Default password: `AgentRivo!2026`
(override with `ADMIN_SEED_PASSWORD`). Emails:
`anika@agent-rivo.example.test`, `noah@agent-rivo.example.test`.

Reset to a clean seed any time (clears app-created visits/reports/messages, keeps users & corpus):

```bash
npm run seed:reset
```

Re-running `seed` never duplicates the six historical reports (everything is keyed on the stable
fixture ids).

### 4. Groq

Create a key at <https://console.groq.com/keys> → `GROQ_API_KEY`. Defaults:
`GROQ_CHAT_MODEL=llama-3.3-70b-versatile`, `GROQ_STT_MODEL=whisper-large-v3-turbo`.
Both are configurable in `.env.local` — swap models without code changes.

### 5. Run locally

```bash
npm run dev            # http://localhost:3100
```

Sign in as Anika. You should see **2 stores, 4 validated reports, 0 active, 0 awaiting** — read
live from Supabase, matching the handbook baseline.

### 6. WhatsApp via Unipile  *(for the live voice/text journey)*

1. In Unipile, connect a **controlled** WhatsApp account and copy `UNIPILE_DSN`,
   `UNIPILE_API_KEY`, `UNIPILE_ACCOUNT_ID`.
2. Invent `UNIPILE_WEBHOOK_SECRET` (any long random string).
3. Bind the manager's phone as a verified sender:
   set `WHATSAPP_SENDER_ANIKA=<the sender/provider id>` and re-run `npm run provision`.
   (A user typing “I am Anika” is **not** authentication — only this server-side binding is.)
4. Expose your local server (dev) with a tunnel, e.g. `npx localtunnel --port 3100` or
   `cloudflared tunnel --url http://localhost:3100`, and register the webhook URL in Unipile:
   `https://<tunnel>/api/whatsapp/webhook?secret=<UNIPILE_WEBHOOK_SECRET>` for “message received”
   events. In production this is your Vercel URL (below).

---

## Deploying to Vercel  *(you do this; I've prepared everything)*

1. Push this repository to GitHub.
2. On <https://vercel.com> → **Add New Project** → import the repo.
3. **Set “Root Directory” to `app`** (this is important — the Next.js app is in the subfolder).
4. **Environment Variables** — add every variable from `.env.example` with your real values
   (all environments). Set `APP_BASE_URL` to your Vercel URL and keep secrets server-side (do
   **not** prefix them with `NEXT_PUBLIC_`). Set `ENABLE_LOCAL_TEST_RUNNER=false` for the public
   deployment so the identity-selecting test endpoint is disabled on the public URL.
5. Deploy. Then point the Unipile webhook at
   `https://<your-app>.vercel.app/api/whatsapp/webhook?secret=<UNIPILE_WEBHOOK_SECRET>`.
6. In **Supabase → Authentication → URL Configuration**, add your Vercel URL to the allowed
   redirect/site URLs.

The webhook and audio functions declare `maxDuration = 60` and run on the Node runtime, which
Vercel honours.

---

## The required end-to-end demo

Everything below works against the running app (local or Vercel).

1. **Dashboard baseline** — sign in as Anika: 2 stores / 4 validated / 0 active / 0 awaiting.
2. **Start a visit** on WhatsApp: “Start a visit to Lyon.” Send a **real voice note** and a text
   observation. The audio is downloaded server-side, transcribed by Whisper, and both appear in
   the one Lyon visit.
3. **Correct** a quantity or name (“change fifteen boxes to five”). The draft updates; the
   original transcript stays visible in the visit detail.
4. **Procedure question** (“what should I record for a tablet that won't charge?”) → answered from
   **SOP-03** with a citation; it does not create an observation.
5. **Prepare the report**, review draft, then **“I validate the latest draft.”** Validated count
   goes 4 → 5.
6. **Refresh the dashboard**, open the visit, play the audio, read the report, **copy / print** it.
7. **Replay** the same provider event → no duplicate (see `npm test`).
8. **Sign in as Noah** → only Lille is visible; a direct Lyon report/audio URL returns a safe
   not-found. Noah asking for Lyon in chat is refused with no scope escalation.

For the **second user's access tests** and **scenario replay** without extra phone numbers, use
the private test runner (local only):

```bash
# e.g. inject a text note as Noah, or replay a fixture audio as Anika
curl -s localhost:3100/api/test-runner -H "x-test-secret: $TEST_RUNNER_SECRET" \
  -H 'content-type: application/json' \
  -d '{"actor_id":"user_anika","kind":"audio","audio_path":"audio/voice-01-observations.wav","fixture_message_id":"p02_m02"}'
```

---

## Runnable checks

```bash
npm run dev        # in one terminal
npm test           # in another — needs ENABLE_LOCAL_TEST_RUNNER=true + TEST_RUNNER_SECRET
```

`tests/run-checks.ts` verifies, against real records:

- **Correction & publication** — “fifteen” corrected to “five”; the corrected value is used, the
  original message stays inspectable, the draft version increments.
- **Version-aware validation** — approving an outdated draft version is rejected; approving the
  latest validates exactly once; one report per visit.
- **Replay safety** — a repeated provider message id produces one timeline entry and one effect;
  a *different* id with identical text is a new input.
- **Access control** — Noah cannot read Lyon via chat and stays scoped to Lille.

(These are text-only so they run without Groq STT. Live voice transcription — acceptance A02 — is
demonstrated manually with a real phone recording, as the handbook requires.)

---

## Models & how to change them

| Need | Model | Change via |
|---|---|---|
| Chat / structuring | `llama-3.3-70b-versatile` (Groq) | `GROQ_CHAT_MODEL` |
| Speech-to-text | `whisper-large-v3-turbo` (Groq) | `GROQ_STT_MODEL` |
| Embeddings | `Supabase/gte-small` (local, 384-dim) | `src/lib/embeddings.ts` (must match the seeded dimension) |

---

## Known limitations (implemented vs optional)

**Implemented (mandatory scope):** real WhatsApp text + voice via Unipile; server-side Whisper
transcription with the original audio kept privately; mixed text/voice in one visit; conversational
corrections with preserved originals; grounded report generation (no invented causes/quantities/
deadlines); explicit, version-aware validation with replay safety; the four dashboard screens on
real data with working filters, audio playback, source inspection and copy/print; RAG with
citations and honest “not specified”; RLS + server-side scope enforcement; persistent state across
restart; reproducible seed/reset.

**Deliberately optional / not built** (per the handbook): photo/OCR/image analysis; PDF export
(browser print is provided); additional languages (English only); a task/assignment system
(follow-ups are report prose only); store-manager accounts; real-time dashboard subscriptions
(manual refresh, as stated).

**Notes:**
- On Vercel, the first RAG query after a cold start loads the local embedding model (~30 MB) into
  the function, adding a few seconds of latency once; subsequent calls are warm. Procedure
  embeddings themselves are precomputed at `npm run embed`.
- Unipile's webhook payload shape varies by DSN/version; `extractEvent()` in the webhook route
  parses defensively and is the one place to adjust if your events differ.
```
