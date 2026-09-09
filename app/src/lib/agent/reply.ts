import type { Finding, FollowupNote } from "@/lib/types";

/** Render a draft as a readable WhatsApp message, clearly labelled as a draft. */
export function renderDraftForWhatsapp(args: {
  storeName: string;
  version: number;
  summary: string;
  findings: Finding[];
  followups: FollowupNote[];
}): string {
  const kindMark: Record<Finding["kind"], string> = {
    positive: "✅",
    issue: "⚠️",
    observation: "•",
  };
  const lines: string[] = [];
  lines.push(`📝 *DRAFT ${args.version}* — ${args.storeName}`);
  lines.push("_Not yet validated. Review below, then reply “I validate this draft”._");
  lines.push("");
  lines.push(`*Summary*\n${args.summary}`);

  if (args.findings.length) {
    lines.push("\n*Findings*");
    for (const f of args.findings) lines.push(`${kindMark[f.kind]} ${f.text}`);
  }
  if (args.followups.length) {
    lines.push("\n*Follow-up notes*");
    for (const n of args.followups) lines.push(`• ${n.text}`);
  }
  lines.push("");
  lines.push(`_Reply “I validate draft ${args.version}” to finalise, or send a correction._`);
  return lines.join("\n");
}
