import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, StatCard, VisitBadge, EmptyState } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { accessibleStores, currentAppUser, overviewCounts, recentVisits } from "@/lib/dashboard";
import { localDate } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { store?: string; from?: string; to?: string };
}) {
  const me = await currentAppUser();
  if (!me) redirect("/login");

  const filter = { storeId: searchParams.store, from: searchParams.from, to: searchParams.to };
  const [stores, counts, visits] = await Promise.all([
    accessibleStores(),
    overviewCounts(me, filter),
    recentVisits(filter),
  ]);

  const rangeLabel =
    searchParams.from || searchParams.to
      ? `${searchParams.from ?? "…"} → ${searchParams.to ?? "…"}`
      : "All dates";

  return (
    <div>
      <PageHeader title={`Welcome, ${me.display_name.split(" ")[0]}`} subtitle={`Visit dates: ${rangeLabel}`} />

      <FilterBar action="/" stores={stores} storeId={searchParams.store} from={searchParams.from} to={searchParams.to} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Accessible stores" value={counts.accessibleStores} hint="Your configured scope" />
        <StatCard label="Validated reports" value={counts.validatedReports} hint={rangeLabel} />
        <StatCard label="Active visits" value={counts.activeVisits} hint="Collecting or in review" />
        <StatCard label="Awaiting validation" value={counts.awaitingValidation} hint="Ready for review" accent />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">Recent visits</h2>
        {visits.length === 0 ? (
          <EmptyState title="No visits match these filters" body="Adjust the store or date range above." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Store</th>
                  <th className="px-4 py-3 font-semibold">State</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-ink">{localDate(v.started_at)}</td>
                    <td className="px-4 py-3 text-ink-soft">{v.store?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <VisitBadge state={v.state} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/visits/${v.id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                        Open visit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        WhatsApp activity appears here after a refresh. New visits, transcripts and validations are read
        live from Supabase — nothing on this page is hardcoded.
      </p>
    </div>
  );
}
