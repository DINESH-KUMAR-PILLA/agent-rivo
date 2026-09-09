/**
 * Centralised, validated environment access. Server-only secrets are read
 * lazily so the browser bundle never touches them. Importing this module on the
 * client only exposes the two NEXT_PUBLIC_ values.
 */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Public — safe in the browser.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

// Server-only. Call getServerEnv() from server code (routes, scripts) only.
export function getServerEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    groqApiKey: required("GROQ_API_KEY", process.env.GROQ_API_KEY),
    groqChatModel: process.env.GROQ_CHAT_MODEL ?? "openai/gpt-oss-120b",
    groqSttModel: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
    unipileDsn: process.env.UNIPILE_DSN ?? "",
    unipileApiKey: process.env.UNIPILE_API_KEY ?? "",
    unipileAccountId: process.env.UNIPILE_ACCOUNT_ID ?? "",
    unipileWebhookSecret: process.env.UNIPILE_WEBHOOK_SECRET ?? "",
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3100",
    demoClock: process.env.DEMO_CLOCK ?? "",
    enableTestRunner: (process.env.ENABLE_LOCAL_TEST_RUNNER ?? "false") === "true",
    testRunnerSecret: process.env.TEST_RUNNER_SECRET ?? "",
  };
}

export type ServerEnv = ReturnType<typeof getServerEnv>;
