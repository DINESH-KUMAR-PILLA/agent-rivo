import { createServerSupabase } from "@/lib/supabase/server";
import type { AppUser, Report, Store, Visit } from "@/lib/types";

/**
 * Server-side data access for the dashboard. Every query runs under the
 * signed-in user's JWT, so RLS guarantees store scope before any app logic —
 * a guessed id or changed route param simply returns nothing.
 */

export async function currentAppUser(): Promise<AppUser | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("app_users").select("*").eq("auth_user_id", user.id).maybeSingle();
  return (data as AppUser) ?? null;
}

export async function accessibleStores(): Promise<Store[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("stores").select("*").order("name");
  return (data ?? []) as Store[];
}

export interface VisitRow extends Visit {
  store: Store | null;
  report: Pick<Report, "id" | "state" | "version"> | null;
}

export async function recentVisits(filter?: {
  storeId?: string;
  from?: string;
  to?: string;
  state?: string;
}): Promise<VisitRow[]> {
  const supabase = createServerSupabase();
  let q = supabase
    .from("visits")
    // Disambiguate: visits↔reports has two FKs (visits.report_id, reports.visit_id).
    .select("*, store:stores(*), report:reports!reports_visit_id_fkey(id, state, version)")
    .order("started_at", { ascending: false });
  if (filter?.storeId) q = q.eq("store_id", filter.storeId);
  if (filter?.state) q = q.eq("state", filter.state);
  if (filter?.from) q = q.gte("started_at", `${filter.from}T00:00:00+02:00`);
  if (filter?.to) q = q.lte("started_at", `${filter.to}T23:59:59+02:00`);
  const { data } = await q;
  return (data ?? []).map((v: any) => ({
    ...v,
    store: Array.isArray(v.store) ? v.store[0] : v.store,
    report: Array.isArray(v.report) ? v.report[0] : v.report,
  })) as VisitRow[];
}

export interface OverviewCounts {
  accessibleStores: number;
  validatedReports: number;
  activeVisits: number;
  awaitingValidation: number;
}

export async function overviewCounts(
  me: AppUser,
  filter?: { storeId?: string; from?: string; to?: string },
): Promise<OverviewCounts> {
  const supabase = createServerSupabase();

  const stores = await accessibleStores();
  const scopedStores = filter?.storeId
    ? stores.filter((s) => s.id === filter.storeId)
    : stores;

  // Validated reports (respects store + date filter).
  let rq = supabase.from("reports").select("id, store_id, visit:visits!reports_visit_id_fkey(started_at)", { count: "exact" }).eq("state", "validated");
  if (filter?.storeId) rq = rq.eq("store_id", filter.storeId);
  const { data: reportRows } = await rq;
  let validated = (reportRows ?? []) as any[];
  if (filter?.from || filter?.to) {
    validated = validated.filter((r) => {
      const started = (Array.isArray(r.visit) ? r.visit[0]?.started_at : r.visit?.started_at) ?? "";
      const date = started.slice(0, 10);
      if (filter.from && date < filter.from) return false;
      if (filter.to && date > filter.to) return false;
      return true;
    });
  }

  // Active / awaiting — always the user's OWN visits, subsets of visit state.
  const { data: activeRows } = await supabase
    .from("visits")
    .select("id, state, store_id")
    .eq("author_id", me.id)
    .in("state", ["collecting", "ready_for_review"]);
  const active = (activeRows ?? []).filter((v: any) => !filter?.storeId || v.store_id === filter.storeId);
  const awaiting = active.filter((v: any) => v.state === "ready_for_review");

  return {
    accessibleStores: scopedStores.length,
    validatedReports: validated.length,
    activeVisits: active.length,
    awaitingValidation: awaiting.length,
  };
}

export async function getVisitDetail(visitId: string) {
  const supabase = createServerSupabase();
  const { data: visit } = await supabase
    .from("visits")
    .select("*, store:stores(*), author:app_users(display_name)")
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return null;

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("visit_id", visitId)
    .order("received_at", { ascending: true });

  const { data: report } = await supabase.from("reports").select("*").eq("visit_id", visitId).maybeSingle();

  const v: any = visit;
  return {
    visit: { ...v, store: Array.isArray(v.store) ? v.store[0] : v.store, author: Array.isArray(v.author) ? v.author[0] : v.author },
    messages: (messages ?? []) as any[],
    report: (report as Report) ?? null,
  };
}

export async function validatedReports(filter?: { storeId?: string }): Promise<
  (Report & { store: Store | null; author: { display_name: string } | null })[]
> {
  const supabase = createServerSupabase();
  let q = supabase
    .from("reports")
    .select("*, store:stores(*), author:app_users(display_name), visit:visits!reports_visit_id_fkey(started_at)")
    .eq("state", "validated");
  if (filter?.storeId) q = q.eq("store_id", filter.storeId);
  const { data } = await q;
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    store: Array.isArray(r.store) ? r.store[0] : r.store,
    author: Array.isArray(r.author) ? r.author[0] : r.author,
    _started: Array.isArray(r.visit) ? r.visit[0]?.started_at : r.visit?.started_at,
  }));
  rows.sort((a: any, b: any) => (b._started ?? "").localeCompare(a._started ?? ""));
  return rows as any;
}

export async function getReport(reportId: string) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("reports")
    .select("*, store:stores(*), author:app_users(display_name), visit:visits!reports_visit_id_fkey(started_at)")
    .eq("id", reportId)
    .maybeSingle();
  if (!data) return null;
  const r: any = data;
  return {
    ...r,
    store: Array.isArray(r.store) ? r.store[0] : r.store,
    author: Array.isArray(r.author) ? r.author[0] : r.author,
    started_at: Array.isArray(r.visit) ? r.visit[0]?.started_at : r.visit?.started_at,
  } as Report & { store: Store; author: { display_name: string }; started_at: string };
}
