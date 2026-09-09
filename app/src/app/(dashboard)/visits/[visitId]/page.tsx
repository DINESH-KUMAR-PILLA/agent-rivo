import Link from "next/link";
import { notFound } from "next/navigation";
import { VisitBadge, ReportStateBadge, FindingChip } from "@/components/ui";
import { getVisitDetail } from "@/lib/dashboard";
import { localDate, formatDate } from "@/lib/clock";
import type { Finding, FollowupNote } from "@/lib/types";

export const dynamic = "force-dynamic";

function intentChip(m: any): { label: string; cls: string } | null {
  const intent = m.raw?.intent;
  if (m.direction === "outbound") return { label: "Assistant", cls: "bg-brand-50 text-brand-700" };
  if (m.kind === "audio") return { label: "Voice transcript", cls: "bg-violet-50 text-violet-700" };
  if (intent === "correction") return { label: "Correction", cls: "bg-amber-50 text-amber-700" };
  if (intent === "procedure_question") return { label: "Procedural question", cls: "bg-sky-50 text-sky-700" };
  if (intent === "validation") return { label: "Validation", cls: "bg-emerald-50 text-emerald-700" };
  return { label: "Text", cls: "bg-slate-100 text-ink-faint" };
}

export default async function VisitDetailPage({ params }: { params: { visitId: string } }) {
  const detail = await getVisitDetail(params.visitId);
  if (!detail) notFound();
  const { visit, messages, report } = detail;

  return (
    <div>
      <Link href="/visits" className="text-sm text-ink-faint hover:text-ink-soft">
        ← All visits
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{visit.store?.name ?? "Visit"}</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {localDate(visit.started_at)} · {visit.author?.display_name}
          </p>
        </div>
        <VisitBadge state={visit.state} />
      </div>

      {(visit.state === "collecting" || visit.state === "ready_for_review") && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {visit.state === "collecting"
            ? "This visit is collecting notes. Continue in WhatsApp — send observations, then say “prepare the report”."
            : "A draft is ready. Review it in WhatsApp and reply “I validate this draft” to finalise it."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Source timeline ── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">Source timeline</h2>
          <div className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-ink-faint">No messages yet.</p>
            ) : (
              messages.map((m: any) => {
                const chip = intentChip(m);
                return (
                  <div key={m.id} className="card p-4">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className={`badge ${chip?.cls}`}>{chip?.label}</span>
                      <span className="text-xs text-ink-faint">{new Date(m.received_at).toLocaleTimeString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>

                    {m.kind === "audio" ? (
                      <div className="space-y-2">
                        {m.transcription_status === "pending" && (
                          <p className="text-sm italic text-amber-600">Transcribing…</p>
                        )}
                        {m.transcription_status === "failed" && (
                          <p className="text-sm italic text-rose-600">
                            Transcription failed — {m.transcription_error ?? "unknown error"}. No text was invented.
                          </p>
                        )}
                        {m.transcript && (
                          <p className="text-sm text-ink">
                            “{m.transcript}”
                            {m.original_transcript && m.original_transcript !== m.transcript ? (
                              <span className="mt-1 block text-xs text-ink-faint">
                                Original transcript preserved: “{m.original_transcript}”
                              </span>
                            ) : null}
                          </p>
                        )}
                        {m.audio_path && (
                          <div className="pt-1">
                            {/* Scope-checked: /api/audio redirects to a short-lived signed URL */}
                            <audio controls preload="none" className="w-full" src={`/api/audio/${m.id}`}>
                              Your browser does not support audio playback.
                            </audio>
                            <a
                              href={`/api/audio/${m.id}`}
                              className="mt-1 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              Open / download original
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-ink">{m.text}</p>
                    )}
                    <div className="mt-2 text-[11px] text-ink-faint">source id: {m.id}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Current draft / validated report ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {report?.state === "validated" ? "Validated report" : "Current draft"}
            </h2>
            {report ? <ReportStateBadge state={report.state} version={report.version} /> : null}
          </div>

          {!report ? (
            <div className="card p-6 text-sm text-ink-faint">
              No draft has been generated yet. In WhatsApp, say “prepare the report”.
            </div>
          ) : (
            <div className="card p-6">
              <h3 className="text-lg font-bold text-ink">{report.title}</h3>
              {report.state === "validated" && report.validated_at ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Validated {formatDate(new Date(report.validated_at))} at{" "}
                  {new Date(report.validated_at).toLocaleTimeString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-600">Draft {report.version} — not yet validated.</p>
              )}

              <p className="mt-4 text-sm text-ink-soft">{report.summary}</p>

              <div className="mt-5 space-y-3">
                {(report.findings as Finding[]).map((f, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <FindingChip kind={f.kind} />
                      <span className="text-[11px] uppercase tracking-wide text-ink-faint">
                        {f.category.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-ink">{f.text}</p>
                    <p className="mt-1 text-[11px] text-ink-faint">Sources: {f.source_message_ids.join(", ")}</p>
                  </div>
                ))}
              </div>

              {(report.followup_notes as FollowupNote[]).length > 0 && (
                <div className="mt-5">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Follow-up notes
                  </h4>
                  {(report.followup_notes as FollowupNote[]).map((n, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 p-3">
                      <p className="text-sm text-ink">{n.text}</p>
                      <p className="mt-1 text-[11px] text-ink-faint">Sources: {n.source_message_ids.join(", ")}</p>
                    </div>
                  ))}
                </div>
              )}

              {report.state === "validated" && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <Link href={`/reports/${report.id}`} className="btn-primary">
                    Open full report
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
