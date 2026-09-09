import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Server client bound to the signed-in user's cookies. Reads run under the
 * user's JWT, so RLS applies — this is what the dashboard's Server Components
 * use, guaranteeing store scope even before any app-level check.
 */
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only; the
          // middleware refresh path handles session renewal instead.
        }
      },
    },
  });
}
