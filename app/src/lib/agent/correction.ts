import { z } from "zod";
import { chatJSON } from "@/lib/groq";

/**
 * Decide whether a correction/removal instruction unambiguously targets exactly
 * one existing statement. If two statements could match ("remove the sign
 * issue" when both an entrance sign and a stockroom sign were mentioned), we
 * ask which one rather than guessing.
 */
const Schema = z.object({
  ambiguous: z.boolean(),
  candidates: z.array(z.string()).default([]),
});

const SYSTEM = `Given a list of statements already recorded in a visit and a user's correction or
removal instruction, decide whether the instruction clearly targets exactly ONE statement.
Return ONLY JSON: { "ambiguous": boolean, "candidates": [the statements that could match] }.
If two or more statements could plausibly match, set ambiguous=true and list them.
If exactly one matches (or it is a value change like "five not fifteen" that clearly maps),
set ambiguous=false.`;

export async function detectAmbiguity(
  statements: string[],
  instruction: string,
): Promise<{ ambiguous: boolean; candidates: string[] }> {
  if (statements.length <= 1) return { ambiguous: false, candidates: [] };
  const raw = await chatJSON<unknown>({
    system: SYSTEM,
    user: `Statements:\n${statements.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nInstruction: "${instruction}"`,
    temperature: 0,
  });
  const parsed = Schema.safeParse(raw);
  return parsed.success ? parsed.data : { ambiguous: false, candidates: [] };
}
