import Link from "next/link";
import { notFound } from "next/navigation";
import { FindingChip } from "@/components/ui";
import { ReportActions } from "@/components/report-actions";
import { getReport } from "@/lib/dashboard";
import { formatDate } from "@/lib/clock";
import type { Finding, FollowupNote } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  front_area: "Exterior / front area",
  interior_display: "Interior and display",
  backroom: "Backroom",
  equipment: "Equipment",
  team: "Team",
  other: "Other",
};

function toPlainText(r: any): string {
  const lines: string[] = [];
  lines.push(r.title);
  lines.push(`Visitor: ${r.author?.display_name} · State: Validated`);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(r.summary);
  const byCat = new Map<string, Finding[]>();
  for (const f of r.findings as Finding[]) {
    if (!byCat.has(f.category)) byCat.set(f.category, []);
    byCat.get(f.category)!.push(f);
  }
  for (const [cat, items] of byCat) {
    lines.push("");
    lines.push((CATEGORY_LABELS[cat] ?? cat).toUpperCase());
    for (const f of items) lines.push(`- [${f.kind}] ${f.text}`);
  }
  if ((r.followup_notes as FollowupNote[]).length) {
    lines.push("");
    lines.push("FOLLOW-UP NOTES");
    for (const n of r.followup_notes as FollowupNote[]) lines.push(`- ${n.text}`);
  }
  return lines.join("\n");
}

export default async function ReportViewPage({ params }: { params: { reportId: string } }) {
  const report = await getReport(params.reportId);
  if (!report || report.state !== "validated") notFound();

  const findings = report.findings as Finding[];
  const followups = report.followup_notes as FollowupNote[];
  const byCategory = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/reports" className="text-sm text-ink-faint hover:text-ink-soft">
          ← Report library
        </Link>
        <ReportActions plainText={toPlainText(report)} />
      </div>

      <article className="card print-clean mx-auto max-w-2xl p-8">
        <div className="border-b border-slate-100 pb-4">
          <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Validated report</span>
          <h1 className="mt-3 text-2xl font-bold text-ink">{report.title}</h1>
          <p className="mt-2 text-sm text-ink-faint">
            {report.store?.name} · Visitor {report.author?.display_name}
            {report.validated_at ? ` · Validated ${formatDate(new Date(report.validated_at))}` : ""}
          </p>
        </div>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Overview</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{report.summary}</p>
        </section>

        {[...byCategory.entries()].map(([cat, items]) => (
          <section key={cat} className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <ul className="mt-2 space-y-2">
              {items.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <FindingChip kind={f.kind} />
                  <span className="text-[15px] leading-relaxed text-ink">{f.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {followups.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Follow-up mentioned during the visit
            </h2>
            <ul className="mt-2 space-y-2">
              {followups.map((n, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink">
                  {n.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs italic text-ink-faint">
              These are records of requests, not repair commitments or evidence that work is complete.
            </p>
          </section>
        )}
      </article>
    </div>
  );
}
