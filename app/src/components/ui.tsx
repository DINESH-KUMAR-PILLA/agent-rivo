import Link from "next/link";
import type { VisitState, ReportState } from "@/lib/types";

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card animate-fade-in p-5 ${accent ? "ring-1 ring-brand-200" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-2 text-3xl font-bold text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-ink-faint">{hint}</div> : null}
    </div>
  );
}

const VISIT_STYLES: Record<VisitState, string> = {
  collecting: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  ready_for_review: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
  validated: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};
const VISIT_LABELS: Record<VisitState, string> = {
  collecting: "Collecting",
  ready_for_review: "Ready for review",
  validated: "Validated",
  cancelled: "Cancelled",
};

export function VisitBadge({ state }: { state: VisitState }) {
  return <span className={`badge ${VISIT_STYLES[state]}`}>{VISIT_LABELS[state]}</span>;
}

export function ReportStateBadge({ state, version }: { state: ReportState; version: number }) {
  if (state === "validated") {
    return <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Validated</span>;
  }
  return <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-200">Draft {version}</span>;
}

const FINDING_STYLES = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  issue: "bg-rose-50 text-rose-700 ring-rose-200",
  observation: "bg-slate-50 text-slate-600 ring-slate-200",
} as const;

export function FindingChip({ kind }: { kind: "positive" | "issue" | "observation" }) {
  const label = kind === "positive" ? "Positive" : kind === "issue" ? "Issue" : "Observation";
  return <span className={`badge ring-1 ${FINDING_STYLES[kind]}`}>{label}</span>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 p-10 text-center">
      <div className="text-sm font-semibold text-ink-soft">{title}</div>
      {body ? <div className="text-sm text-ink-faint">{body}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-faint">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
      {children} →
    </Link>
  );
}
