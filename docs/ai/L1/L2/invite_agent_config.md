# Gemini MLLM Invite Config

Read this when changing the Next.js demo's voice model, greeting, prompt, VAD, or invite flow.

`app/api/invite-agent/route.ts` accepts `{ requester_id, channel_name }` and
reads only `NEXT_PUBLIC_AGORA_APP_ID`, `NEXT_AGORA_APP_CERTIFICATE`, and
`NEXT_GOOGLE_API_KEY` from `.env.local`. It constructs `AgoraClient` and an
`Agent` with one `GeminiLive` provider. The selected public 3.8 model ID
is sent directly to the gateway. Extended Thinking defaults to thinking_level=medium.
There is no separate STT, LLM, or TTS stage.

Edit `ADA_PROMPT`, `GREETING`, or the MLLM constructor directly in the route.
The model switch includes medium thinking for
`models/gemini-3.8-live-extended-thinking` and omits it for
`models/gemini-3.8-live`. The SDK uses the Gemini preview
gateway and `agora-feature: gemini-live` automatically.

The route uses `DEFAULT_AGENT_UID`, shared with the browser client. It enables
RTM, error messages, and metrics, and disables tools. The session binds to the
requester's RTC channel; `/api/stop-conversation` stops it by agent ID.

Verify the request shape with `TMPDIR=/private/tmp pnpm run verify:api`.
With credentials, `TMPDIR=/private/tmp pnpm node --import tsx
scripts/live-gemini-smoke.ts` starts an agent, checks `RUNNING`, and stops it.
