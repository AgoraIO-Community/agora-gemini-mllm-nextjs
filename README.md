# agora-gemini-mllm — Next.js demo

This demo uses the published Agora TypeScript Agent SDK. One `GeminiLive` provider handles audio input and output end to end; there is no separate STT, LLM, or TTS stage.

The browser chooses `models/gemini-3.8-live` or `models/gemini-3.8-live-extended-thinking`. Extended Thinking exposes a low/medium/high slider; the regular model sends no thinking level. `POST /api/invite-agent` carries the public model ID and optional `thinking_level`; the route validates the selection. The SDK routes Gemini sessions to the preview gateway with `agora-feature: gemini-live` and sends the Google credential as `mllm.api_key`.

## Requirements

- Node.js 22+ and pnpm.
- Agora App ID, App Certificate, and Google API key.

## Run locally

Run these commands from this demo folder:

```bash
pnpm install
test -f .env.local || cp env.local.example .env.local
# Fill NEXT_PUBLIC_AGORA_APP_ID, NEXT_AGORA_APP_CERTIFICATE, and NEXT_GOOGLE_API_KEY in .env.local.
pnpm dev
```

Next.js chooses an available port; open the Local URL it prints. The local credential file needs only the three secrets above. Prompt, greeting, model, voice, and session settings live in `app/api/invite-agent/route.ts`.

## Verify

```bash
pnpm run typecheck
pnpm run verify:api
pnpm run build
```

With valid credentials, run `node --import tsx scripts/live-gemini-smoke.ts` to start a real agent, confirm `RUNNING`, and stop it.

## Deploy

Deploy this Next.js app with `NEXT_PUBLIC_AGORA_APP_ID`, server-only `NEXT_AGORA_APP_CERTIFICATE`, and server-only `NEXT_GOOGLE_API_KEY`. The Gemini models in this demo still require the preview gateway.

See [AGENTS.md](./AGENTS.md) and the [recipe contract](./docs/ai/RECIPE.md) for the request flow and extension points. Licensed under [MIT](./LICENSE).
