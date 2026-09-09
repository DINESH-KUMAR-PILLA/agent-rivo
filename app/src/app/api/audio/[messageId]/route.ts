import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserByAuthId, userCanAccessStore } from "@/lib/access";
import { serviceClient } from "@/lib/supabase/service";
import { signedAudioUrl } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Returns a short-lived signed URL for a voice note's original audio — but only
 * after confirming the signed-in user is authorised for the visit's store. This
 * is why the Storage bucket is private: a guessed storage path can't bypass the
 * scope check, because the browser never holds a public URL.
 */
export async function GET(_req: NextRequest, { params }: { params: { messageId: string } }) {
  // Who is asking? (browser session)
  const supabase = createServerSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const appUser = await getUserByAuthId(authUser.id);
  if (!appUser) return NextResponse.json({ error: "no profile" }, { status: 403 });

  // Look up the message + its visit's store (service role; we enforce scope next).
  const { data: msg } = await serviceClient()
    .from("messages")
    .select("audio_path, visit_id, visits(store_id, state, author_id)")
    .eq("id", params.messageId)
    .maybeSingle();

  const visit = (msg as any)?.visits;
  const audioPath = (msg as any)?.audio_path as string | null;
  if (!msg || !audioPath || !visit) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const store = Array.isArray(visit) ? visit[0] : visit;
  const allowed =
    (await userCanAccessStore(appUser.id, store.store_id)) &&
    (store.state === "validated" || store.author_id === appUser.id);
  if (!allowed) {
    // Safe not-found; never reveal another user's store details.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = await signedAudioUrl(audioPath, 120);
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(url);
}
