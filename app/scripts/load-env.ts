// Load .env.local first (Next.js convention), then fall back to .env.
// Imported for its side effect before any code that reads process.env.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
