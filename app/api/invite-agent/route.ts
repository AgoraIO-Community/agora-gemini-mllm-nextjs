import { NextRequest, NextResponse } from 'next/server';
import {
  Agent,
  Area,
  ExpiresIn,
  AgoraClient,
  GeminiLive,
} from 'agora-agents';
import type { GeminiThinkingLevel } from 'agora-agents';
import { ClientStartRequest, AgentResponse } from '@/types/conversation';
import { DEFAULT_AGENT_UID } from '@/lib/agora';

// System prompt that defines the agent's personality and behavior.
// Swap this out to change what the agent talks about.
const ADA_PROMPT = `You are **Ada**, an agentic developer advocate from **Agora**. You help developers understand and build with Agora's Conversational AI platform.

# What Agora Actually Is
Agora is a real-time communications company. The product you represent is the **Agora Conversational AI Engine** — it lets developers add voice AI agents to any app by connecting ASR, LLM, and TTS into a real-time pipeline over Agora's SD-RTN (Software Defined Real-Time Network). Key facts:
- The product is called the **Conversational AI Engine** (not "Chorus", not "Harmony", or any other name you might invent)
- It runs a full ASR → LLM → TTS pipeline with sub-500ms latency
- It supports Deepgram, Microsoft, and others for ASR; OpenAI, Anthropic, and others for LLM; ElevenLabs, Microsoft, and others for TTS
- Agora's SD-RTN is its global real-time network infrastructure — not "SDRTN"
- MCP in this context means **Model Context Protocol** (Anthropic's open standard for connecting AI models to tools/data), not "multi-channel processing"
- Agora does not have a product called Chorus, Harmony, or any similar name — do not invent product names

# Honesty Rule
If you don't know a specific fact about Agora, say so plainly and suggest checking docs.agora.io. Never invent product names, feature names, or capabilities.

# Persona & Tone
- Friendly, technically credible, concise. You're a peer who builds things, not a support agent.
- Plain English. No marketing fluff.

# Core Behavior Guidelines
- **Default to brief**: This is a voice conversation. Keep most replies to 1–2 sentences. Only go longer if the user explicitly asks for detail or the answer genuinely requires it.
- **Never list or enumerate**: No bullet points, no numbered steps. Say the single most important thing.
- **Clarify before answering**: For anything complex, ask one focused question first.
- **Ask at most one question per turn**: Never stack questions.
- **Guide, don't lecture**: Unlock the next step, not everything at once.`;

// First thing the agent says when a user joins the channel.
const GREETING = `Hi there! I'm Ada, your virtual assistant from Agora. How can I help?`;

// agentUid identifies the AI in the RTC channel — must match the client default.
const agentUid = String(DEFAULT_AGENT_UID);
const REQUEST_MODEL_LIVE = 'models/gemini-3.8-live';
const REQUEST_MODEL_EXTENDED_THINKING = 'models/gemini-3.8-live-extended-thinking';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  try {
    // --- 1. Parse request ---

    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name, model: selectedModel = REQUEST_MODEL_LIVE, thinking_level } = body;

    // Validate required env vars on first request so misconfiguration surfaces
    // with a clear error message rather than a silent failure.
    const appId = requireEnv('NEXT_PUBLIC_AGORA_APP_ID');
    const appCertificate = requireEnv('NEXT_AGORA_APP_CERTIFICATE');

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: 'channel_name and requester_id are required' },
        { status: 400 },
      );
    }
    if (selectedModel !== REQUEST_MODEL_LIVE && selectedModel !== REQUEST_MODEL_EXTENDED_THINKING) {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
    }
    if (thinking_level !== undefined && (selectedModel !== REQUEST_MODEL_EXTENDED_THINKING || !['low', 'medium', 'high'].includes(thinking_level))) {
      return NextResponse.json({ error: 'Invalid thinking level for model' }, { status: 400 });
    }

    // --- 2. Build and start the agent ---

    // AgentSession detects the Gemini MLLM and pins its preview route and gate.
    // area: change to Area.EU or Area.AP for European or Asia-Pacific deployments.
    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });

    const model: string = selectedModel;
    const thinkingLevel = selectedModel === REQUEST_MODEL_EXTENDED_THINKING ? (thinking_level ?? 'medium') as GeminiThinkingLevel : undefined;

    // Pipeline: Gemini 3.8 MLLM (ASR + LLM + TTS) via preview endpoint.
    // MLLM mode has no separate LLM stage, so agent-level `instructions` and
    // `maxHistory` do not apply — the system prompt is set on the vendor below.
    const agent = new Agent({
      client,
      greeting: GREETING,
      failureMessage: 'Please wait a moment.',
      // RTM is required for transcript events in the browser client.
      // Tools are disabled for this preview (no MCP tool invocation).
      advancedFeatures: { enable_rtm: true, enable_tools: false },
      // Required for browser RTM events:
      // - data_channel: 'rtm' enables RTM delivery path for state/metrics/errors
      // - enable_error_message emits AGENT_ERROR payloads
      // - enable_metrics emits AGENT_METRICS latency payloads
      parameters: {
        // web client → ultra-low-latency chorus profile
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    }).withMllm(
      new GeminiLive({
        apiKey: requireEnv('NEXT_GOOGLE_API_KEY'),
        model,
        voice: 'Puck',
        languageCodes: ['en-US'],
        thinkingLevel,
        // The system prompt must go on the vendor — agent-level `instructions`
        // is only applied to the cascading pipeline's llm.system_messages.
        instructions: ADA_PROMPT,
        // MLLM has no ASR stage, so these flags are the only source of
        // transcript events for the browser transcript panel.
        transcribeAgent: true,
        transcribeUser: true,
        // Vendor-side VAD; overrides top-level turn_detection when MLLM is on.
        turnDetection: { mode: 'server_vad' },
      }),
    );

    // remoteUids restricts the agent to only process audio from this user
    const session = agent.createSession({
      channel: channel_name,
      agentUid,
      remoteUids: [requester_id],
      idleTimeout: 30,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });

    const agentId = await session.start();

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
    } as AgentResponse);
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      },
      { status: 500 },
    );
  }
}
