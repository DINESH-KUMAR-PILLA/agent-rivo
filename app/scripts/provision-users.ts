/**
 * Provision the two test regional managers and bind them to the fixtures.
 *
 *   npm run provision
 *
 * Creates Supabase Auth users for each fixture identity, then writes the real
 * Auth UUID into app_users.auth_user_id and (optionally) binds a controlled
 * WhatsApp sender id. Store membership lives in protected data (store_memberships),
 * never in editable profile metadata, so it can't be changed from the browser.
 *
 * Env:
 *   ADMIN_SEED_PASSWORD   password set for both test users (default below)
 *   WHATSAPP_SENDER_ANIKA the verified WhatsApp sender id bound to Anika (main journey)
 *   WHATSAPP_SENDER_NOAH  optional sender id for Noah (else use the local test runner)
 *
 * Idempotent: re-running reuses existing auth users.
 */
import "./load-env";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "AgentRivo!2026";

const BINDINGS = [
  { id: "user_anika", email: "anika@agent-rivo.example.test", whatsapp: process.env.WHATSAPP_SENDER_ANIKA },
  { id: "user_noah", email: "noah@agent-rivo.example.test", whatsapp: process.env.WHATSAPP_SENDER_NOAH },
];

async function findAuthUserByEmail(email: string): Promise<string | null> {
  // Page through users (small dev project).
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  console.log(`▶ Provisioning test users on ${url}`);
  for (const b of BINDINGS) {
    let authId = await findAuthUserByEmail(b.email);
    if (!authId) {
      const { data, error } = await db.auth.admin.createUser({
        email: b.email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error || !data.user) {
        console.error(`  ✖ createUser ${b.email} failed:`, error?.message);
        process.exit(1);
      }
      authId = data.user.id;
      console.log(`  • created auth user for ${b.email}`);
    } else {
      // Reset the password so the documented credentials always work.
      await db.auth.admin.updateUserById(authId, { password: PASSWORD });
      console.log(`  • reused existing auth user for ${b.email}`);
    }

    const patch: Record<string, unknown> = { auth_user_id: authId };
    if (b.whatsapp) patch.whatsapp_sender_id = b.whatsapp;
    const { error } = await db.from("app_users").update(patch).eq("id", b.id);
    if (error) {
      console.error(`  ✖ binding ${b.id} failed:`, error.message);
      process.exit(1);
    }
    console.log(`    bound ${b.id} → auth ${authId}${b.whatsapp ? ` · whatsapp ${b.whatsapp}` : ""}`);
  }

  console.log("✔ Users provisioned.");
  console.log(`  Sign in with the emails above and password: ${PASSWORD}`);
  console.log("  Bind Anika's WhatsApp sender via WHATSAPP_SENDER_ANIKA for the live journey.");
}

main().then(() => process.exit(0));
