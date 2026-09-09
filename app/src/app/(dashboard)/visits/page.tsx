import Link from "next/link";
import { PageHeader, VisitBadge, EmptyState, ReportStateBadge } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { accessibleStores, recentVisits } from "@/lib/dashboard";
import { localDate } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: { store?: string; from?: string; to?: string; state?: string };
}) {
  const filter = {
    storeId: searchParams.store,
    from: searchParams.from,
    to: searchParams.to,
    state: searchParams.state,
  };
  const [stores, visits] = await Promise.all([accessibleStores(), recentVisits(filter)]);

  return (
    <div>
      <PageHeader title="Visits" subtitle="Filter your visit history by store, state and date." />
      <FilterBar
        action="/visits"
        stores={stores}
        storeId={searchParams.store}
        from={searchParams.from}
        to={searchParams.to}
        state={searchParams.state}
        showState
      />

      {visits.length === 0 ? (
        <EmptyState title="No visits match these filters" body="Adjust the filters above." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Store</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Report</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{localDate(v.started_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{v.store?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <VisitBadge state={v.state} />
                  </td>
                  <td className="px-4 py-3">
                    {v.report ? (
                      <ReportStateBadge state={v.report.state} version={v.report.version} />
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/visits/${v.id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
