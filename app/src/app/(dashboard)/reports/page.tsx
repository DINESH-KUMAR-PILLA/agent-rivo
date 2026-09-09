import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { accessibleStores, validatedReports } from "@/lib/dashboard";
import { localDate } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: { store?: string } }) {
  const [stores, reports] = await Promise.all([
    accessibleStores(),
    validatedReports({ storeId: searchParams.store }),
  ]);

  return (
    <div>
      <PageHeader title="Report library" subtitle="Validated reports only. Drafts live in the Visits screen." />
      <FilterBar action="/reports" stores={stores} storeId={searchParams.store} />

      {reports.length === 0 ? (
        <EmptyState title="No validated reports match these filters" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`} className="card group p-5 transition-shadow hover:shadow-lift">
              <div className="flex items-center justify-between">
                <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Validated</span>
                <span className="text-xs text-ink-faint">
                  {(r as any)._started ? localDate((r as any)._started) : ""}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-ink group-hover:text-brand-700">{r.title}</h3>
              <p className="mt-1 text-sm text-ink-soft line-clamp-3">{r.summary}</p>
              <p className="mt-3 text-xs text-ink-faint">
                {r.store?.name} · {r.author?.display_name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
