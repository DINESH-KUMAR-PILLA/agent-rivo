> ## 👉 The solution lives in [`app/`](app/)
> This is my implementation of the challenge below.
> - **Setup, architecture & run instructions:** [`app/README.md`](app/README.md)
> - **Live demo walkthrough / script:** [`app/DEMO_SCRIPT.md`](app/DEMO_SCRIPT.md)
> - **Live app:** https://agent-rivo.vercel.app  (sign in: `anika@agent-rivo.example.test` / `AgentRivo!2026`; second user `noah@agent-rivo.example.test`)
>
> **Stack:** Next.js 14 (TypeScript) · Supabase (Postgres + Auth + Storage + pgvector) · Groq (LLM + Whisper) · Unipile (WhatsApp) · deployed on Vercel.
> Quick start: `cd app && npm install`, copy `.env.example` → `.env.local`, run the SQL in `app/supabase/migrations/`, then `npm run seed && npm run embed && npm run provision && npm run dev`.
>
> The original assignment brief follows.
>
> ---

# Agent Rivo
## Field Visit Reporting Challenge — Candidate Handbook

**Version 2.0 · One week · English · TypeScript + Supabase + WhatsApp via Unipile**

Build an assistant that helps a regional manager conduct a store visit through WhatsApp, using **both text and voice messages**, and turn the conversation into an accurate, editable visit report. The same regional manager uses a web dashboard to browse stores, follow the progress of visits, review source material and read validated reports.

This is a working prototype assessment, not a request for a production deployment. All business data is fictional. There is one application role: **regional manager**. Two test users with different store permissions are supplied to verify access control.

## Read in this order

1. [Product brief and exact scope](docs/01-product-brief.md).
2. [WhatsApp behaviour and visit lifecycle](docs/02-whatsapp-journey.md).
3. [Regional manager dashboard specification](docs/03-dashboard-spec.md).
4. [Data model, seed material and permissions](docs/04-data-and-permissions.md).
5. [Technical guide, audio, RAG and cost controls](docs/05-technical-guide.md).
6. [Acceptance criteria, submission and scoring](docs/06-delivery-and-grading.md).
7. [Worked conversations and expected outcomes](examples/walkthroughs.md).
8. [Complete expected report](examples/expected-report.md), alongside its [structured example](examples/expected-report.json).

The `data/` directory contains a fictional network, three stores, two regional managers, six historical visits, their reports and original messages. `procedures/` contains five documents for retrieval. `audio/` contains four spoken samples, their scripts and an audio manifest. These are genuine audio files generated with synthetic speech, not real recordings of employees.

## The required end-to-end demonstration

Sign in as a regional manager. Start a visit through WhatsApp. Send a real voice note and a text observation. Correct something. Ask for the report, review the draft and explicitly validate it. Open the same visit in the dashboard and show the report, original inputs and validation state. Ask one procedural question and show the cited document. Then prove that the second test user cannot access the first user's restricted store.

The supplied audio files help develop and test transcription. They do not replace the demonstration of an actual voice note sent through WhatsApp.

## Scope boundary

The output is a **visit report**. Explicitly requested follow-ups may be recorded as prose inside the report. They do not become a separate task system. There are no store-manager accounts, action assignment inboxes, completion declarations, task-closure approvals, reminder campaigns, external notifications or customer conversations to implement.

Voice and text are mandatory. Photographs, OCR, PDF export and additional languages are optional. Browser print or copying the report is sufficient for the required export/copy capability.

## Before you begin

The organiser supplies the real start/deadline/demo dates and confirms the test-account setup. Use development accounts only. Supabase and Groq free quotas and an eligible Unipile trial are the proposed zero-spend route; confirm availability before activating the trial. API credentials and actual WhatsApp identifiers are intentionally not included in these files.

This handbook is the authoritative scope for this version. In case of an apparent conflict, prioritise the required behaviours in `docs/06-delivery-and-grading.md` and ask the organiser a specific question. You may choose your schema and libraries; preserve the business outcomes and explain your decisions.
