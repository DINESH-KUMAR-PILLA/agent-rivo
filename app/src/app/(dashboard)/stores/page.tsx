import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui";
import { accessibleStores, recentVisits } from "@/lib/dashboard";
import { localDate } from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const [stores, visits] = await Promise.all([accessibleStores(), recentVisits({ state: "validated" })]);

  const latestByStore = new Map<string, string>();
  for (const v of visits) {
    // recentVisits is newest-first, so the first hit per store is the latest.
    if (v.store && !latestByStore.has(v.store.id)) latestByStore.set(v.store.id, v.started_at);
  }

  return (
    <div>
      <PageHeader title="Stores" subtitle="Only the stores in your configured scope are listed." />

      {stores.length === 0 ? (
        <EmptyState title="No stores in your scope" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => {
            const latest = latestByStore.get(s.id);
            return (
              <div key={s.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-ink">{s.name}</h3>
                    <p className="text-sm text-ink-faint">{s.city}</p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-ink-faint">
                    {s.timezone}
                  </span>
                </div>
                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Latest validated visit</dt>
                    <dd className="font-medium text-ink">{latest ? localDate(latest) : "None yet"}</dd>
                  </div>
                  {s.local_contact_name ? (
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">Local contact</dt>
                      <dd className="text-ink-soft">{s.local_contact_name}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <Link
                    href={`/visits?store=${s.id}`}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View visit history →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-ink-faint">
        The local contact is contextual information only — not a user account or approval recipient.
      </p>
    </div>
  );
}
