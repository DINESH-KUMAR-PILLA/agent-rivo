# Agent Rivo — Live Demo Script

**Goal:** convince the technical team that (1) it's a real product on a real database with real security, and (2) the WhatsApp voice/text → report pipeline genuinely works end-to-end.

Live URL: **https://agent-rivo.vercel.app**
Logins: Anika `anika@agent-rivo.example.test` · Noah `noah@agent-rivo.example.test` · password `AgentRivo!2026`

---

## 0. Before they join — set the stage (5 min)

**Terminal:** `cd app`, and reset to a clean baseline so counts are predictable:
```
npm run seed:reset
```

**Open these browser tabs in advance:**
1. The dashboard, already signed in as **Anika** → https://agent-rivo.vercel.app
2. **Supabase → Table Editor** (so you can show real rows)
3. **Vercel → your project → Logs** (optional, proves webhooks arrive)
4. **Unipile dashboard** → Accounts + Webhooks (proves the real connection)

**Phones:** the "manager" phone (the second WhatsApp number we bound to Anika) with a chat open to the bot number.

**One terminal ready** for `npm run demo` (the safe backup) and `npm test`.

> Rule: keep the demo clock steady. Everything is already deployed; don't push code during the demo.

---

## 1. Opening (30 seconds — say this)

> "Agent Rivo helps a regional manager run a store visit over WhatsApp — using voice and text — and turns that messy conversation into an accurate, validated report. The same manager reviews everything in a web dashboard. It's built on Next.js and Supabase, deployed on Vercel, with WhatsApp through Unipile and speech-to-text via Groq Whisper. Let me show you."

---

## 2. The dashboard = real database (1 min)

- Show the Overview as Anika. Point at the cards: **2 stores · 4 validated reports · 0 active**.
  > "These aren't hardcoded — they're computed live from Supabase. This manager is scoped to Lyon and Nantes."
- Open one validated visit → show the report and the **source timeline**.
  > "Every statement in a report traces back to the original message that produced it."

**Let them verify it's real:** switch to the **Supabase Table Editor** tab, open `reports` and `visits`.
> "Same data, straight from the database."

---

## 3. WhatsApp live — the core (3–4 min)

From the **manager phone**, send these to the bot, one at a time, narrating:

1. **Text:** `Start a visit to Lyon`
   > "The app verifies my number maps to Anika — a typed name is never trusted — and starts a visit."
   *(Bot replies acknowledging Atlas Lyon Centre.)*

2. **Voice note** (record yourself saying): *"Fifteen boxes are outside the storage area. The front display is up to date. The shared tablet hasn't charged since this morning."*
   > "This voice note is downloaded server-side and transcribed by Groq Whisper — the real audio, not a script."
   *(Bot acknowledges the transcription.)*

3. **Text correction:** `Change fifteen boxes to five`
   > "I can correct a fact conversationally. Watch — it keeps the original for traceability but uses the corrected value."

4. **Text:** `Sarah should check the tablet with IT by Friday`
   > "A spoken follow-up is recorded as a note — not turned into a task or a promise that it's fixed."

5. **Text:** `Prepare the report`
   *(Bot shows a labelled DRAFT with findings + follow-up.)*
   > "This is a draft — clearly labelled, not final."

6. **Text:** `I validate this draft`
   *(Bot confirms it's validated with a report reference.)*
   > "It only becomes final when I explicitly approve it."

**Optional wow:** ask a procedure question by text: `What should I record for a tablet that won't charge?`
> "This is answered from the approved procedures with a citation — and it won't invent a price or a deadline that isn't in the documents."

---

## 4. Back to the dashboard — it all landed (1–2 min)

Refresh the dashboard (as Anika).
- The **validated count is now 5** (was 4). A new **Lyon visit** is in Recent visits.
- Open it: **play the voice note**, show the **transcript**, the **correction**, and the **validated report**.
  > "Five boxes, not fifteen. The tablet cause is 'unknown' — nothing invented. Sarah's follow-up is recorded as a request only."
- Click **Copy report** / **Print view**.

**Verify in the database:** Supabase Table Editor → `messages` and `reports` now contain the just-created rows.
> "That message came from a real phone, through the webhook, into the database, onto the dashboard — no manual editing."

---

## 5. Security & permissions (1 min)

- Sign out → sign in as **Noah**. Show: only **Lille**, 2 reports. No Lyon/Nantes.
- In the address bar, try a Lyon report directly: `…/reports/report_004` → **"Not available."**
  > "This is enforced by the database with Row-Level Security — not just a hidden link. A guessed URL, a changed parameter, or claiming 'I am Anika' in chat all fail."

---

## 6. Proof it's engineered, not staged (1 min — optional but strong)

- **Webhook is live & secured** (run in terminal):
  ```
  curl -i -X POST "https://agent-rivo.vercel.app/api/whatsapp/webhook?secret=WRONG" -d '{}'
  ```
  → `401 Unauthorized`.
- **Automated checks:**
  ```
  npm test
  ```
  → 15/15 pass: corrections, version-aware validation, replay-safety, access control.
  > "These run against the live database and prove the tricky behaviours automatically."

---

## 7. Close (30 seconds — say this)

> "So: real WhatsApp voice and text, faithful transcription, corrections, explicit validation, a permission-scoped dashboard on real Supabase data, and enforced security — all deployed and reproducible. The setup, schema, and seed scripts are in the repo with a README."

---

## Backup plan (if live WhatsApp misbehaves)
Stay calm and pivot:
> "Let me show the same pipeline through my controlled test injector — identical code path."
```
npm run demo
```
It runs the whole journey (voice → transcription → correction → report → validation) and prints the result. Then refresh the dashboard. **This is your safety net — rehearse it too.**

---

## Likely questions + answers
- **"Is the transcription real or the script?"** → Real. Groq Whisper transcribes the audio bytes; the code never reads the filename. I can send a fresh, unscripted voice note to prove it.
- **"How is security enforced?"** → Supabase Row-Level Security on every client table, plus server-side scope checks for the backend service key. RLS is the browser's backstop; the server re-checks independently.
- **"What if the same message arrives twice?"** → Deduplicated on provider account + message id. One effect per event — there's an automated test for it.
- **"Which models?"** → Groq `openai/gpt-oss-120b` for structuring, `whisper-large-v3-turbo` for speech, local `gte-small` for embeddings/RAG. All configurable via env vars.
- **"Does the LLM write to the database?"** → No. The model only classifies intent and drafts text; all state changes are deterministic TypeScript. Model output is validated before it's saved.
- **"Cost?"** → Runs entirely on free tiers (Supabase, Groq, Vercel); Unipile is a 7-day trial.
- **"Can it invent facts?"** → No — it's constrained to grounded statements, keeps symptoms separate from causes, and preserves stated uncertainty. Follow-ups are recorded as requests, never as completed work.

---

## Reset between runs
```
npm run seed:reset     # restores the clean 4-validated baseline
```
Run this right before the real demo so the counts start clean.
