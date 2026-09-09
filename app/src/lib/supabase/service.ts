import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS — only ever import this from server code
 * (API routes, scripts). Callers must enforce user scope themselves via
 * src/lib/access.ts.
 */
let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (cached) return cached;
  const env = getServerEnv();
  cached = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
