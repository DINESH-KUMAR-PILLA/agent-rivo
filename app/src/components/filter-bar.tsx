import type { Store } from "@/lib/types";

/**
 * Server-rendered filter form (GET). No client JS: submitting updates the URL
 * search params, which the page reads to scope its queries and counters.
 */
export function FilterBar({
  action,
  stores,
  storeId,
  from,
  to,
  showState,
  state,
}: {
  action: string;
  stores: Store[];
  storeId?: string;
  from?: string;
  to?: string;
  showState?: boolean;
  state?: string;
}) {
  return (
    <form action={action} method="get" className="card mb-6 flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[180px] flex-1">
        <label className="label" htmlFor="store">
          Store
        </label>
        <select id="store" name="store" defaultValue={storeId ?? ""} className="input">
          <option value="">All accessible stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {showState ? (
        <div className="min-w-[150px]">
          <label className="label" htmlFor="state">
            State
          </label>
          <select id="state" name="state" defaultValue={state ?? ""} className="input">
            <option value="">All states</option>
            <option value="collecting">Collecting</option>
            <option value="ready_for_review">Ready for review</option>
            <option value="validated">Validated</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="from">
          From
        </label>
        <input id="from" name="from" type="date" defaultValue={from ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="to">
          To
        </label>
        <input id="to" name="to" type="date" defaultValue={to ?? ""} className="input" />
      </div>
      <button type="submit" className="btn-primary">
        Apply
      </button>
      <a href={action} className="btn-ghost">
        Reset
      </a>
    </form>
  );
}
