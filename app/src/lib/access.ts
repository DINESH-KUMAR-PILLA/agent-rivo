import { serviceClient } from "@/lib/supabase/service";
import type { AppUser } from "@/lib/types";

/**
 * Server-side scope enforcement. Because the backend uses the service-role key
 * (which bypasses RLS), every privileged path must independently confirm the
 * mapped user is authorised for the store it is touching. RLS is the browser's
 * backstop; this is the backend's.
 */

export async function getUserById(userId: string): Promise<AppUser | null> {
  const { data } = await serviceClient().from("app_users").select("*").eq("id", userId).maybeSingle();
  return (data as AppUser) ?? null;
}

export async function getUserByAuthId(authUserId: string): Promise<AppUser | null> {
  const { data } = await serviceClient()
    .from("app_users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return (data as AppUser) ?? null;
}

/** Resolve a verified WhatsApp sender to an app user. A user-written name is
 *  never authentication — only this server-controlled binding is. */
export async function getUserByWhatsappSender(senderId: string): Promise<AppUser | null> {
  const { data } = await serviceClient()
    .from("app_users")
    .select("*")
    .eq("whatsapp_sender_id", senderId)
    .maybeSingle();
  return (data as AppUser) ?? null;
}

export async function storeIdsForUser(userId: string): Promise<string[]> {
  const { data } = await serviceClient()
    .from("store_memberships")
    .select("store_id")
    .eq("user_id", userId);
  return (data ?? []).map((r: { store_id: string }) => r.store_id);
}

export async function userCanAccessStore(userId: string, storeId: string): Promise<boolean> {
  const { data } = await serviceClient()
    .from("store_memberships")
    .select("store_id")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .maybeSingle();
  return Boolean(data);
}
