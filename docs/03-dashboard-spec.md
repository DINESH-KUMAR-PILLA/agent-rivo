# 3. Regional manager dashboard

Build a usable web interface for the same regional manager who speaks to Agent Rivo on WhatsApp. Its purpose is to review visits, source notes and reports. Data must come from Supabase and obey the signed-in user's permissions.

## Screen A — Overview

Show the signed-in person's name and a clear navigation path to stores, visits and reports. Include these cards:

1. **Accessible stores:** count of stores in the user's configured scope.
2. **Validated reports:** count within the selected visit-date range and store filter.
3. **Active visits:** own visits in collecting or ready_for_review.
4. **Awaiting validation:** own visits in ready_for_review.

The last two are subsets of visit state, not independent task metrics. Label the selected range. A clear default is all supplied dates. Show a “Recent visits” table sorted by visit start time, newest first, with store, date, state and a link to details.

Baseline before starting a new scenario: Anika has 2 accessible stores, 4 validated reports, 0 active visits and 0 awaiting validation. Noah has 1 accessible store, 2 validated reports, 0 active visits and 0 awaiting validation. These are test expectations, not values to hardcode.

When Anika starts a new Lyon visit, the active count becomes 1. Preparing its draft changes awaiting validation to 1 while active remains 1. Validating that draft changes the all-date validated count from 4 to 5 and both active counts to 0.

## Screen B — Stores and visit history

List only accessible stores. Each row/card shows name, city, date of the latest validated visit if one exists, and a link to visit history. A store detail page may show the contact name as ordinary contextual text. The contact is not a user account or approval recipient.

Anika's latest validated Lyon visit is 3 September 2026; Nantes is 4 September. Noah's Lille visit is 5 September. Use the supplied visits to derive these dates.

Filter visits by store and state. Date filtering is inclusive on the visit's local calendar date. A simple title/summary search is sufficient. Filtering a list must also filter associated counters when those counters claim to represent that selection.

## Screen C — Visit detail

Display:

- Store, visit date/time, author and state badge.
- A chronological input timeline distinguishing **text**, **voice transcript**, **correction** and **procedural question** where relevant.
- For each voice note, a playable audio control or secure open/download action and its transcript. Show pending or failed transcription explicitly.
- The current report draft or validated report, with a visible draft version and validation time when applicable.
- A way to see which source message supports a report statement. A source list or expandable reference is enough.
- A clear message explaining how to continue in WhatsApp when the visit is collecting or awaiting review.

The report view must not display a validated badge simply because text was generated. If the draft changes after it was shown, the displayed version and content must update consistently.

Reading and inspection are required. Editing and validating in the dashboard are optional. If added, these controls must use the same server-side state/version checks as WhatsApp.

## Screen D — Report library and report view

Show validated reports with store, visit date, short summary and author. Drafts may be available in the visits screen but must not be counted as validated reports.

Opening a report shows its complete readable content, including positive observations, issues, explicit unknowns and any visitor-requested follow-up notes. Provide **copy report** or a clean **print view**. Generating a PDF file is optional; browser print is enough. Private report URLs must not bypass authentication.

## Example layout — illustrative, not a prescribed design

```text
Agent Rivo                         Anika Rao    Sign out

Overview   Stores   Visits   Reports
Store: All accessible stores       Visit dates: All

[2 stores] [4 validated reports] [0 active] [0 awaiting validation]

Recent visits
04 Sep 2026   Nantes   Validated   Open visit
03 Sep 2026   Lyon     Validated   Open visit
25 Aug 2026   Nantes   Validated   Open visit
24 Aug 2026   Lyon     Validated   Open visit
```

```text
Lyon — 07 Sep 2026                 Ready for review · Draft 2

Source timeline                    Current draft
10:01 Text: start Lyon              Overview
10:02 Voice: ... [Play]             Front display is up to date.
      Transcript                   Five boxes are outside storage.
10:03 Text: correction              ...

Sources: message 2, correction 3    Awaiting explicit approval in WhatsApp
```

## Empty, loading and error states

An empty filter result says “No visits match these filters”; it must not look like a failed request. While loading, avoid showing misleading zero totals as final values. On a failed read, offer a retry. A missing or forbidden report displays a safe not-found/access response without revealing another user's store details.

After a successful WhatsApp update, a manual refresh is sufficient. State this clearly during the demo. Real-time subscriptions are a bonus. Support a desktop layout and a readable narrow-screen layout; tables may scroll horizontally. Use visible field labels, keyboard-accessible controls and text labels alongside state colours.

## Dashboard acceptance checks

1. Counts and latest-visit dates match the seed for each test user.
2. A new WhatsApp visit appears without a manual database edit.
3. Voice playback/transcript belong to the correct visit.
4. Corrections appear in the draft while original messages stay inspectable.
5. Validation updates the state and library exactly once.
6. Store/date filters work on real records.
7. The second user cannot open a guessed URL or retrieve restricted data directly.
8. Empty/error states are understandable; copy/print contains the validated report content.

No store-manager dashboard, task board, overdue-action chart, completion button, closure approval queue or employee ranking belongs in this scope.
