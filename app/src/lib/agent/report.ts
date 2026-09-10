import { z } from "zod";
import { chatJSON } from "@/lib/groq";
import { formatDate, formatDateWithWeekday, now } from "@/lib/clock";
import type { Finding, FollowupNote, Message, Store } from "@/lib/types";

/**
 * Report generation. Turns the accepted source messages of one visit into a
 * structured, grounded report. The model may paraphrase but must not invent
 * causes, quantities, deadlines, assignees or completion claims. Every finding
 * cites the source message ids that support it. Output is validated with zod
 * before it becomes business state.
 */

const FindingSchema = z.object({
  category: z.enum(["front_area", "interior_display", "backroom", "equipment", "team", "other"]),
  kind: z.enum(["positive", "issue", "observation"]),
  text: z.string().min(1),
  source_message_ids: z.array(z.string()).min(1),
});
const FollowupSchema = z.object({
  text: z.string().min(1),
  source_message_ids: z.array(z.string()).min(1),
});
const ReportSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(FindingSchema),
  followup_notes: z.array(FollowupSchema),
});

export interface GeneratedReport {
  title: string;
  summary: string;
  findings: Finding[];
  followups: FollowupNote[];
}

const SYSTEM = `You write factual store-visit reports for a regional manager. You are given the
accepted source messages of ONE visit, each with an id. Produce a JSON report.

Return ONLY:
{
  "summary": string,                 // short, factual overview of what was observed
  "findings": [ { "category": one of ["front_area","interior_display","backroom","equipment","team","other"],
                  "kind": one of ["positive","issue","observation"],
                  "text": string,
                  "source_message_ids": [ids that support this finding] } ],
  "followup_notes": [ { "text": string, "source_message_ids": [...] } ]
}

STRICT GROUNDING RULES:
- Use ONLY facts present in the source messages. Never invent causes, quantities, deadlines, prices, assignees or diagnoses.
- If the visitor later corrected a value (e.g. "five boxes, not fifteen"), use the CORRECTED value and cite BOTH the original and the correction message ids. Do not report the old value as fact.
- Keep an observed symptom distinct from a cause. "The tablet has not charged" must NOT become "the battery is defective". If the cause is unknown, say the cause is unknown.
- A spoken request such as "Sarah should check the tablet with IT by Friday" is a follow-up NOTE, not a completed action and not a task assignment. Record it as a request only, in followup_notes.
- Do not create a follow-up for every issue. Only record follow-ups the visitor explicitly requested.
- Do not fill empty sections with assumptions. Omit categories with nothing to report.
- Preserve stated uncertainty ("I do not know the quantity" stays unknown).
- Every finding and follow-up MUST cite at least one real source_message_id from the input.
- Relative dates: today is {TODAY}. A weekday like "Friday" means the NEXT occurrence of that weekday on or after today; work it out from today's weekday shown above and write the explicit calendar date (e.g. from Monday 7 September 2026, "Friday" = 11 September 2026). Never guess; count forward from today.`;

export async function generateReport(
  store: Store,
  messages: Message[],
): Promise<GeneratedReport> {
  const today = formatDateWithWeekday(now());
  // Present each source as id + effective text (transcript for audio).
  const sources = messages
    .filter((m) => m.direction === "inbound")
    .map((m) => {
      const body = m.kind === "audio" ? m.transcript ?? "(audio not transcribed)" : m.text ?? "";
      const label = m.kind === "audio" ? "voice" : m.kind;
      return `- id=${m.id} [${label}] "${body}"`;
    })
    .join("\n");

  const user = `Store: ${store.name} (${store.city}).\nSource messages for this visit:\n${sources}\n\nWrite the grounded report JSON now.`;

  const raw = await chatJSON<unknown>({
    system: SYSTEM.replace("{TODAY}", today),
    user,
    temperature: 0.1,
  });
  const parsed = ReportSchema.parse(raw);

  // Defensive: drop any citation that does not resolve to a real message id.
  const validIds = new Set(messages.map((m) => m.id));
  const clean = <T extends { source_message_ids: string[] }>(x: T): T => ({
    ...x,
    source_message_ids: x.source_message_ids.filter((id) => validIds.has(id)),
  });

  const findings = parsed.findings.map(clean).filter((f) => f.source_message_ids.length > 0);
  const followups = parsed.followup_notes.map(clean).filter((f) => f.source_message_ids.length > 0);

  const visitDate = formatDate(new Date(messages[0]?.received_at ?? now().toISOString()));
  return {
    title: `${store.name} — Visit report — ${visitDate}`,
    summary: parsed.summary,
    findings,
    followups,
  };
}
