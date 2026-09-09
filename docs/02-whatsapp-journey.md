# 2. WhatsApp journey and visit lifecycle

## Starting and identifying a visit

Bind the incoming provider sender to a known regional manager using server-controlled configuration. A user-written name is not authentication. Unknown senders receive an access/setup response and cannot read network data.

If the user says “Start a visit to Lyon”, identify the authorised store and acknowledge it. If they say only “Start a visit”, ask which authorised store. If they provide notes before choosing a store, hold them as pending input for that user and ask for the store; do not attach them to the last store visited by someone else.

A single message may start a visit and include observations. Do not lose the observation part when recognising the start instruction.

## Visit states

Use equivalent states if your database design differs, but preserve these meanings:

| State | Meaning | Allowed user actions |
|---|---|---|
| collecting | The visit is active and accepting notes | Add/correct notes, ask questions, request draft, cancel |
| ready_for_review | A generated draft is available at a specific version | Read it, correct it, explicitly validate or cancel |
| validated | The latest reviewed report was explicitly approved | Read, copy or print; start a new visit |
| cancelled | The draft visit was deliberately abandoned | Show a cancelled label in history if retained; start another visit |

Both collecting and ready_for_review count as active. No more than one active visit may exist for the same user. Two different regional managers may have active visits simultaneously.

## Text and voice processing

For each incoming message, persist a stable provider message identifier, sender mapping, received timestamp, message type and visit association. For audio, record download/transcription progress separately from visit state. Download server-side through authorised provider access; never put provider secrets in a browser URL.

Retain the original audio or a securely retrievable private reference, and the transcription actually returned by the speech service. Display text notes and voice transcripts in chronological order. A short acknowledgement while transcribing is acceptable. Do not generate a final report while an earlier accepted voice note is still pending unless the user explicitly chooses to exclude it.

If audio cannot be transcribed, tell the user which note failed and offer a retry or a text alternative. Never guess speech from silence, invent missing words as facts or announce that a report includes a note which was not processed.

Keep a correction distinct from the original input. For example, if speech recognition produced “fifteen boxes” and the user says “I said five boxes”, retain the original transcript for traceability and use five in the report. A full transcription editor is not required; conversational correction is sufficient.

## Report drafting and correction

When asked to prepare the report, use accepted observations from this visit only. Typical sections are overview, exterior/front area, interior/display, backroom, equipment, team, and explicit follow-up notes. Empty sections can be omitted or labelled “not discussed”; never fill them with model assumptions.

Keep source message references internally or in the detail view so a reviewer can trace important statements. The written report may paraphrase but must preserve meaning. Do not generate a task for every problem. “One employee is absent” is not a request to recruit someone. A spoken request such as “Sarah should update the sign by Friday” may appear in the follow-up notes; there is no separate assignment or completion system.

Examples of supported corrections:

- “Change fifteen boxes to five.”
- “Remove the sentence about a missing employee; that was another store.”
- “The tablet works; it is the printer that is broken.”
- “Change Sarah to Karim in that sentence.”
- “The deadline I mentioned is Monday 14 September, not Friday.”

If two statements could match a correction, ask which one. After a material change, increase the draft version and present the amended draft or an explicit link to it. Do not overwrite the original messages or silently create a new visit.

## Explicit validation

“Prepare the report”, “finish my notes”, a procedural question, or silence is not approval. A user can approve through an explicit message such as “I validate report draft 2.” Natural variations are acceptable when unambiguous and tied to the current review prompt.

Bind approval to the version actually shown. If a newer voice note or correction has arrived, the old approval must not finalise a changed document. Respond with the updated draft for review. The validated snapshot records the approving user and timestamp. A retry of the same approval message must not create another report or validation entry.

“End visit” should prepare the draft for review when it has not yet been approved. Once validated, close the active collection session and provide a report reference. The user may start another visit without carrying over the old visit's observations, instructions or pending attachments.

## Store switching and cancellation

If the user names another store while a visit is active, ask them to validate/finish or explicitly cancel the current visit. Do not silently publish it, discard it, move its notes or combine two stores. An explicit cancellation ends the session without a validated report. Historical cancelled input may be retained privately for troubleshooting, but must not appear as a completed visit.

## RAG inside or outside a visit

Questions such as “What should I record for an equipment incident?” are answered using the procedure corpus. Cite document title or ID and section. A response can say what is missing from the documentation. A procedure question must not create an observation or change the active store.

Historical queries such as “What was recorded in my latest Nantes visit?” use authorised stored reports and must identify the report/date. Do not present an old fact as a current observation. Historical report search can be an ordinary scoped database query; procedure retrieval must use the RAG pipeline.

## Dates and failure recovery

The fixed demonstration clock is Monday 7 September 2026 at 10:00 Europe/Paris. “This Friday” is 11 September 2026 in that scenario. If interpreting a relative phrase could change its meaning, ask a short question and show the explicit date in the draft. Live mode uses the actual message timestamp and store timezone.

A retry after a provider error must preserve accepted inputs. Log failures without exposing secrets. Deduplicate on provider account plus message ID, not message text: two distinct messages can legitimately contain identical words. Test restarting while a draft exists and replaying a validation event.
