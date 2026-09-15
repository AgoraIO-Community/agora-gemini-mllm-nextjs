---
recipe_version: 0.1.0
recipe_status: stable
extension_points:
  - api.routes
  - prompts.system
  - pipeline.providers
  - ui.conversation
invariants:
  - baseline.sample-derived
  - tokens.rtc-rtm
  - lifecycle.strict-mode
  - transcript.uid-remap
stable_contracts:
  - env.required
  - api.token
  - api.invite-agent
  - api.stop-conversation
---

# Quickstart Recipe Profile

This repo is a reusable quickstart sample for building browser voice-agent experiences with Agora Conversational AI Engine.

## Recipe Role

- Role: `base` quickstart recipe.
- Target audience: developers bootstrapping a production-style Next.js voice agent app.
- Reuse model: clone, bind project, run, then customize the Gemini MLLM prompt, model, thinking level, or UI.

## Recipe Scope

This base recipe provides a copyable browser voice-agent starter with:

- browser RTC audio and RTM event transport
- server-side token, invite, and stop routes; the optional custom LLM route is unused by this MLLM demo
- one Gemini 3.8 MLLM provider for end-to-end voice; no separate STT, LLM, or TTS stage
- pre-call, in-call, transcript, metrics, and connection-status UI

## Baseline Implementation Guidance

This Gemini demo adapts the official Agora Next.js quickstart. Use its source and progressive disclosure docs as the starting point for further customization.

Do not recreate Agora ConvoAI integration from memory. Provider schemas, SDK builder fields, token behavior, and RTM event details can drift. For a new baseline implementation, follow [L1/L2/from_scratch_bootstrap.md](L1/L2/from_scratch_bootstrap.md) while copying verified patterns from this repo.

## Extension Points

- `api.routes`: add browser-facing routes under `app/api`, with shared request/response types in `types/conversation.ts` when the client consumes them.
- `prompts.system`: edit `ADA_PROMPT` and `GREETING` in `app/api/invite-agent/route.ts`.
- `pipeline.providers`: configure the single `GeminiLive` provider in `app/api/invite-agent/route.ts`; set `thinkingLevel` only for Extended Thinking.
- `ui.conversation`: customize the pre-call, in-call, transcript, and metrics components. This demo uses a Gemini 3.8 Live model picker and low/medium/high slider for Extended Thinking.

## Invariants

- Keep `RtcTokenBuilder.buildTokenWithRtm` for RTM-capable tokens.
- Preserve the working token, invite, RTC, RTM, and transcript flow when customizing this derived demo.
- Preserve StrictMode `isReady` guard for join/mic initialization.
- Preserve UID remap (`uid="0"`) and `INTERRUPTED` message-list inclusion.
- Keep documentation synchronized when workflows/contracts change.

## Stable Contracts

- `GET /api/generate-agora-token` returns `{ token, uid, channel }`.
- `POST /api/invite-agent` accepts `{ requester_id, channel_name, model?, thinking_level? }`; thinking is valid only for Extended Thinking. It returns the agent id/state payload.
- `POST /api/stop-conversation` accepts `{ agent_id }` and treats already-stopping sessions as success.
- Required env vars are `NEXT_PUBLIC_AGORA_APP_ID`, `NEXT_AGORA_APP_CERTIFICATE`, and server-only `NEXT_GOOGLE_API_KEY`.
- `components/LandingPage.tsx` owns pre-call bootstrap and RTM client lifecycle.
- `components/ConversationComponent.tsx` owns joined-session RTC/toolkit lifecycle.
- `lib/conversation.ts` owns transcript normalization helpers.

## Internal / Subject to Change

- Visual styling and copy in the quickstart UI.
- Gemini model IDs, thinking defaults, voice IDs, and prompt text; update docs and checks when changing them.
- Connection issue display heuristics and metric chip presentation.

## Consumer Onboarding Recipe

1. Install the demo dependencies, including the published `agora-agents` SDK.
2. Set `NEXT_PUBLIC_AGORA_APP_ID`, `NEXT_AGORA_APP_CERTIFICATE`, and `NEXT_GOOGLE_API_KEY` in `.env.local`.
3. Run `pnpm run doctor` and `pnpm dev`; Next chooses an available port.
4. Validate with `pnpm run typecheck`, `pnpm run verify:api`, and `pnpm run build` before sharing modifications.
5. Customize agent behavior and UI using the supported surfaces above.
