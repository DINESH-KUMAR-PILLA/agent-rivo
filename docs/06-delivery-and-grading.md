# 6. Acceptance, delivery and grading

## Required acceptance matrix

| ID | Requirement | Evidence during the demo |
|---|---|---|
| A01 | Real WhatsApp text collection through Unipile | New phone message appears in the correct visit |
| A02 | Real voice-note transcription | Phone recording, retrieved audio and actual transcript shown |
| A03 | Mixed text and voice in one visit | Both contribute to a single report |
| A04 | Faithful correction | Corrected fact in latest draft; original input remains traceable |
| A05 | Explicit version-aware validation | Draft is not final until current version is approved |
| A06 | Regional dashboard | Functional overview, stores/history, visit detail and report library |
| A07 | Original evidence | Text, audio and transcript can be inspected by the authorised user |
| A08 | RAG with citations | Supported procedural answer plus an honest unsupported answer |
| A09 | Scope enforcement | Restricted store blocked in chat, direct route/API and storage access |
| A10 | Persistent state | Active visit survives an application restart |
| A11 | Replay safety | Re-delivering the same provider message has no duplicate effect |
| A12 | Recoverable audio/model failure | No invented transcript or false publication; accepted notes remain |
| A13 | Explicit store switching | No facts carried into a different store's new visit |
| A14 | Reproducible setup | README, environment template, schema/migrations and seed process |

## Suggested one-week sequence

This is a planning aid, not a mandated architecture or hourly workload.

1. Read the brief, agree on test access, provision the two identities and seed the three stores/history. Verify scope early.
2. Complete a real WhatsApp text round-trip and persist an active visit.
3. Add actual voice-note handling and conversational corrections.
4. Build report drafting, explicit validation and restart/replay handling.
5. Add procedure retrieval and the dashboard's core screens.
6. Exercise the public scenarios, fix failures and check the second identity's access.
7. Prepare a clean installation path and demonstrate the complete flow.

You can build slices in another order. Prioritise the main journey over optional media features or decorative charts.

## Submission contents

- Source repository with TypeScript application code and a dependency lockfile.
- Clear installation and run instructions, including backend and webhook setup.
- An environment template with placeholders, never secrets.
- Schema/migrations and a documented development seed/reset process.
- How to create/bind the two authenticated users and the controlled WhatsApp sender.
- Which chat, transcription and embedding models were used, and how to change them.
- A small set of meaningful runnable checks for corrections/publication, access and event replay.
- A short known-limitations section that distinguishes implemented behaviour from optional features.

An accessible hosted app is optional. A local application demonstrated with a working webhook is sufficient. A recorded demo may supplement the live demonstration but does not replace the evaluator's ability to inspect the code and run the app.

## Demonstration script

1. Show the seeded dashboard as Anika, including the correct store/report counts.
2. Start a new Lyon visit by WhatsApp. Send a fresh voice note and a text note.
3. Correct a quantity or name; show the transcript and correction in the visit detail.
4. Ask an equipment procedure question and inspect the citation.
5. Request a draft, verify its contents, then explicitly validate the latest version.
6. Refresh the dashboard and open/copy the validated report.
7. Replay one incoming event and show that the report/message is not duplicated.
8. Sign in as Noah and show that Lyon is unavailable, including a direct restricted record request.

## Scoring — 100 points

| Criterion | Points | What earns the score |
|---|---:|---|
| WhatsApp, voice and conversational continuity | 25 | Actual voice processing, mixed inputs, correct visit association |
| Report accuracy, correction and validation | 25 | No invented facts, retained corrections, approval of the current version |
| Regional manager dashboard | 20 | Real data, working filters, source inspection, useful report view |
| RAG and source quality | 10 | Relevant retrieval, usable citations, correct handling of missing knowledge |
| Reliability and access control | 15 | Scoped database/storage, replay safety, restart and recoverable errors |
| Reproducible setup and explanation | 5 | Another developer can run it; the candidate understands the implementation |

Public examples show what good behaviour looks like. The evaluator may change the store, wording, order of messages or corrected value, and may simulate a failure. Exact prose matching is not required. Hardcoded answers or replacing speech recognition with supplied transcripts do not demonstrate the relevant capability.

Voice and the dashboard are core, not bonus items. Optional OCR, image analysis, additional languages or PDF generation do not compensate for missing mandatory behaviour. No extra features are needed for a full score.

## Candidate FAQ

**Do I need to develop a task-management system?** No. Preserve explicit follow-up requests as prose in the visit report only.

**Do I need a store-manager account or approval flow?** No. Both supplied accounts are regional managers; they exist to test different permissions.

**Can I modify the proposed JSON structure?** Yes. Keep the same business facts, fixture mappings and source relationships.

**Does RAG have to search every old report with embeddings?** No. Use vector retrieval for the procedures. Historical reports can be queried directly with store scope and dates.

**Do I need to transcribe historical text fixtures?** No. Historical messages are text. The four audio samples are separate development scenarios, and live voice transcription must be demonstrated.

**Must a regional manager approve the report twice?** No. They review and validate the report once. This does not approve or close any operational work.

**Can I use AI coding tools?** Yes, provided you can explain and debug the submitted implementation. No paid subscription is required.

**What does “one week” mean?** The organiser communicates the real start, submission and demo dates. The fixed dataset clock exists only for reproducible examples.
