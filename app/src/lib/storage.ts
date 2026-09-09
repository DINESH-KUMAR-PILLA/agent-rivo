import { randomUUID } from "crypto";
import { serviceClient } from "@/lib/supabase/service";

const BUCKET = "visit-audio";

/** Store an original voice note privately. Path is namespaced by user so a
 *  signed URL for one user's audio can be scoped-checked before minting. */
export async function uploadAudio(
  userId: string,
  bytes: Uint8Array,
  ext: string,
  mime: string,
): Promise<string> {
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await serviceClient()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`audio upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL. Only ever called by the server after a scope check. */
export async function signedAudioUrl(path: string, expiresIn = 120): Promise<string | null> {
  const { data } = await serviceClient().storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function downloadAudio(path: string): Promise<Uint8Array> {
  const { data, error } = await serviceClient().storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`audio download failed: ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}
