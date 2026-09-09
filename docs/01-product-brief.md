# 1. Product brief

## Business situation

Atlas Network operates several establishments. A regional manager regularly visits them to observe the premises, organisation, equipment, displays and team conditions. Notes arrive in fragments: a voice message at the entrance, a text in the backroom, then a correction after speaking to someone. Writing the final report afterwards is time-consuming and makes it easy to omit or misattribute information.

Agent Rivo keeps these inputs attached to the right visit, asks concise questions when necessary and prepares a report that the visitor can review. It also answers procedural questions using approved internal documents. The dashboard provides a reliable history of what was observed and what was validated.

## User and permissions

The only product user is a regional manager. Each user has access to a list of stores. The seed provides:

- **Anika Rao:** Lyon and Nantes.
- **Noah Bennett:** Lille.

Both have the same role. They are separate accounts to demonstrate store and user isolation. Names such as Sarah, Karim or Maya in visit notes are people mentioned during a visit, not additional application users or workflow recipients.

## Core user stories

| ID | As a regional manager, I want to… | Observable result |
|---|---|---|
| U01 | Start a visit to an authorised store | The assistant identifies the store and starts a persistent visit |
| U02 | Send text and voice notes in any sequence | Notes and transcripts appear in that visit without duplication |
| U03 | Correct a fact or remove a statement | The current draft changes while original source messages remain traceable |
| U04 | Ask which procedure applies | The answer cites the supplied document and section |
| U05 | Read a draft before it becomes final | The draft is explicitly labelled and can be corrected |
| U06 | Validate the latest draft | Exactly that draft becomes a validated report |
| U07 | Review my activity in a dashboard | Store-filtered visits, report states and original inputs are visible |
| U08 | Continue after restarting the application | The same active visit and accepted notes remain available |

## Required product capabilities

**WhatsApp collection.** Receive real incoming messages through Unipile, associate the verified sender with the correct account, persist the message and respond appropriately. Text and audio are part of the same visit. English support is mandatory; other languages are optional.

**Transcription.** Retrieve actual incoming audio, transcribe it and make the transcript inspectable. Do not substitute the supplied expected script for running speech recognition. Let the user correct a name, quantity or meaning. Keep the original recording linked to its transcript with private access.

**Report generation.** Organise observations into useful sections. Include positive observations, problems and unknowns. Preserve user-requested follow-ups as report text when present. Generate a short factual summary. Do not invent causes, quantities, deadlines or promised work.

**Human validation.** The regional manager sees a draft and approves the latest version. A correction invalidates approval of the previous draft. Validation means the visit report is final; it does not mean any observed problem has been fixed.

**Dashboard.** Implement the screens in the dashboard specification. The dashboard must use actual stored application data, not static screenshots or hardcoded counts. WhatsApp activity becomes visible after refresh; live subscriptions are optional.

**RAG.** Index the supplied approved procedures. Retrieve relevant passages and cite them. Missing facts remain missing. Procedural advice must not be inserted into a report as though the manager had observed or ordered it.

## Deliberate limits for one week

One active visit per user. Short voice notes of up to two minutes and 10 MB are sufficient; reject longer or oversized files with a useful response. Users may finish or cancel a current visit before switching stores. Validated reports are read-only in the MVP. No report-version editor after validation is required.

The core accepts text and audio. It may respond to other attachment types with a clear unsupported-format message. Photos as attachments, OCR and visual analysis are optional and must not delay the core flow.

The user can review and validate through WhatsApp. The dashboard can offer a simple draft editor and a validate button too; these are optional because the full correction/validation path is already required in WhatsApp. The dashboard must show the current draft, its version and state accurately.

## What success looks like

A visitor can finish the required journey without a developer editing database rows, manually transcribing the audio, assigning permissions through a chat message or replacing the final report by hand. The output is faithful to the visit and available only to authorised users.
