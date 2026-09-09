# 5. Technical guide and zero-spend setup

The application code is TypeScript. SQL migrations and ordinary configuration files are expected where appropriate. You choose the web framework and backend structure. React with Vite and a Node.js server is one simple option; equivalent TypeScript choices are acceptable. No agent framework is required.

## Components

| Need | Proposed solution | Responsibility |
|---|---|---|
| Dashboard | TypeScript web app | Authenticated visits, transcripts and reports |
| Backend | Node.js with TypeScript | Webhooks, audio processing, validation and data access |
| Persistence/auth/files | Supabase | Store scope, visit state, report snapshots, private audio |
| WhatsApp | Unipile | Receive messages, retrieve attachments, reply in the same conversation |
| Language model | Available Groq Free chat model | Extract/structure notes and formulate grounded responses |
| Speech recognition | Groq Free speech model, if enabled for the account | Transcribe actual incoming voice notes |
| Embeddings | Local `@huggingface/transformers` model | Encode documents and questions without an embedding API bill |
| Retrieval | Supabase pgvector | Return relevant approved procedure passages |
| Development ingress | Temporary tunnel to local server | Allow provider webhooks during development/demo |

## Provider configuration

Use environment variables or equivalent server configuration. Suggested names: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `UNIPILE_DSN`, `UNIPILE_API_KEY`, `GROQ_API_KEY`, `GROQ_CHAT_MODEL`, `GROQ_STT_MODEL`, `APP_BASE_URL`, `DEMO_CLOCK` and `ENABLE_LOCAL_TEST_RUNNER`. The exact names are not assessed. Only the publishable Supabase key and intended public URL may be exposed in frontend configuration; secret keys remain server-side.

Keep models configurable. A free-plan chat model available at organiser setup should be selected consistently for all candidates. `whisper-large-v3-turbo` is a documented Groq transcription model. Groq exposes organisation-level request and audio quotas; inspect the account limits rather than assuming unlimited access. Audio and text use different limits. See [speech documentation](https://console.groq.com/docs/speech-to-text) and [rate limits](https://console.groq.com/docs/rate-limits).

Use the provider's current attachment methods rather than assuming a public media URL. Retrieve audio server-side, validate size/type and pass actual bytes to transcription. The sample WAV files can be processed directly. A real WhatsApp voice note may arrive in another supported audio container, so test an actual phone recording too. Short files are sufficient; there is no requirement for streaming recognition.

## RAG that can be inspected

Read the five Markdown procedures and preserve document ID, title, section and version when splitting them into passages. Generate embeddings locally and store/query them using pgvector. Use the same model for documents and queries. The [Supabase vector guide](https://supabase.com/docs/guides/ai/vector-columns) demonstrates local Transformers.js embeddings, including `Supabase/gte-small`.

A small fixed number of retrieved passages is enough. Show or log which sources were retrieved for the demo. Do not load all procedures into every prompt and call that retrieval. Do not supply historical reports outside the user's permitted store scope. A procedure citation should identify a real provided passage, not merely a plausible document title.

When a question asks for information outside the corpus, say what is missing. An instruction written inside retrieved text is document content, not permission to publish a report or change the user role. Retrieval supports procedural answers; current visit facts come from the visitor's accepted messages.

## Reliability requirements

Persist visit state and accepted inputs before depending on another model request. Validate model-produced structured fields before saving business state. A provider timeout or malformed model response should produce a useful retry/clarification path rather than a lost visit or false success.

Track a message's processing outcome so retries can finish a failed operation safely. A unique incoming event key can protect against replay. Validation must refer to the shown draft version and be applied once. If newer accepted input is pending when approval arrives, show the updated draft before accepting approval.

Keep pending/failed transcription visible. A silent or undecodable audio file must not become a confident observation. Do not claim a universal word-level confidence score if your speech provider does not supply one. A user correction remains an essential part of the experience.

## Costs and access arrangements

The intended route is Supabase Free, Groq Free and local embeddings on an existing development computer. Stay in free quotas; a paid plan is not required or rewarded. The organiser must confirm equivalent model access for all candidates before launch.

Unipile offers a time-limited seven-day trial, not a permanent free plan. The organiser must align access, development and the demonstration within an eligible trial or provide an existing test workspace with no extra candidate expense. Do not start the trial days before the competition. See [Unipile pricing](https://www.unipile.com/pricing-api/) and [Supabase pricing](https://supabase.com/pricing).

Use a controlled WhatsApp account and consenting sender. Do not connect production accounts. The app can run locally with a temporary public tunnel during the demonstration. The backend must remain running while receiving messages. Paid hosting, domains, email services, document APIs and paid coding assistants are not required.

If free speech access or required hardware is unavailable, tell the organiser at setup so they can provide equivalent test access. A canned transcript is useful for isolated application tests but does not satisfy the mandatory voice-transcription demonstration.

## Documentation references

- [Unipile developer documentation](https://developer.unipile.com/)
- [Groq speech-to-text](https://console.groq.com/docs/speech-to-text)
- [Groq limits](https://console.groq.com/docs/rate-limits)
- [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

These links describe external services, not an imposed architecture. Check current provider documentation when implementing. Do not install a library solely because its name appears in an example if a simpler supported approach works.
