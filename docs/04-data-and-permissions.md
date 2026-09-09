# 4. Data and permissions

## Supplied fixture files

| File | Records | Purpose |
|---|---:|---|
| fixture-context.json | 1 | Fictional network, reference clock and dataset version |
| stores.json | 3 | Establishment identity, timezone and contextual contact name |
| users.json | 2 | Regional managers and their authorised stores |
| visits.json | 6 | Historical validated visits |
| reports.json | 6 | Structured report snapshots with references to original messages |
| messages.json | 18 | Three original messages per historical visit, including validation |
| documents.json | 5 | Index of the supplied procedure corpus |

There is intentionally no tasks/actions dataset. A name mentioned in report prose does not need an application account. Use `audio/manifest.json` and `examples/public-scenarios.json` as test resources; they are not initial business-state records.

## Initial state

Each store has two validated historical visits. Anika authored the Lyon and Nantes visits; Noah authored the Lille visits. There are no active visits after a clean seed. Examples are independent and should start from a clean seed unless a scenario explicitly tests continuity.

Fixture time is 2026-09-07T10:00:00+02:00, Europe/Paris. This is a Monday. Dates in reports describe visits, not a mandatory real-world competition schedule. Use a clearly labelled test clock for reproducible tests and actual time in normal operation.

## Suggested conceptual entities

You may implement a different normalised schema, but the app needs to represent:

- A user and server-controlled store memberships.
- A store and its timezone.
- A visit, owner, selected store, state and start/validation timestamps.
- Original messages and private audio references, including processing status.
- A current draft, a version, accepted corrections and a final validated snapshot.
- Procedure documents/chunks with source metadata and embeddings.

UUIDs are not prescribed. IDs such as `store_lyon` or `report_004` are stable fixture references; preserve them directly or via a documented mapping. Source references in seeded reports must still resolve after import.

## Report contract

The provided JSON reports contain a title, factual summary, findings grouped by category, optional visitor-requested follow-up notes, and original-message references. This is an example of the expected information, not a required LLM response schema. The candidate chooses a validated internal representation.

Findings distinguish positive, issue and neutral observation. The categories are front_area, interior_display, backroom, equipment, team and other. Unknown categories can fall under other. No category implies a severity rating or a mandatory action. Optional dates or names in follow-up prose originate in the visitor's messages or their explicit correction.

Draft source provenance must include corrections when they change a statement. Keep original messages intact. A final report references its visit and validation actor; the report's author/store must agree with the visit. A validated snapshot is immutable in the mandatory scope.

## Access model

| Resource or action | Permission |
|---|---|
| Store list and details | Assigned stores only |
| Start or contribute to a visit | Own visit in an assigned store |
| Read or change a draft | Its author only |
| Validate a draft | Its author, still authorised for that store |
| Read historical validated reports | Assigned stores only |
| Read messages/audio | Same permitted visit scope; unpublished drafts remain author-only |
| Read procedure corpus | Both authorised test users |
| Modify role or store membership | Setup/administration only; no conversational grant |

Enforce scope in the server and database, including retrieval and storage. Hiding a link or telling the LLM not to answer is insufficient. A guessed report ID, storage URL, changed route parameter or text saying “I am Anika” must not grant access.

Use Supabase Auth for the dashboard. Enable appropriate RLS on client-accessible business tables. Store membership in protected data, not user-editable profile metadata. If the backend uses privileged credentials for processing WhatsApp, it must independently enforce the mapped user's scope because privileged access can bypass RLS. Keep those keys out of the browser and repository.

## Identity setup

`auth_user_id` and `whatsapp_sender_id` are null by design. The emails end in `.example.test` and are placeholders, not working inboxes. Provision test accounts using your documented setup and bind their actual Auth UUIDs to the fixture identities.

Bind a controlled WhatsApp sender identifier to one fixture user server-side. For the second user, a private local event runner is acceptable for access tests; do not require the candidate to acquire extra phone numbers. The mandatory main journey must still run through a real WhatsApp conversation. A test endpoint that permits identity selection must be disabled or inaccessible on the public tunnel.

## Normalised scenario inputs

Example messages use `fixture_message_id`, `actor_id`, `received_at`, `kind` and either text or an audio path. They are **not provider webhook examples**. Adapt real Unipile events using official documentation. Fixture IDs test business logic and replay; provider IDs must come from actual incoming events. Never authenticate a live event from an arbitrary `actor_id` field supplied by a caller.

## Seed and reset

Create an isolated development project and document how to provision users, map memberships, import the historical records and index the five procedures. Seeding validated history must not invoke a fresh report generation or send WhatsApp notifications. The initial history should remain identical across candidates.

Your reset process must identify the dedicated test environment and avoid unrelated data. It may clear app-created test visits before reimporting fixtures. Demonstrate that a second seed does not duplicate the six historical reports. Do not include production data or keys in the submission.
