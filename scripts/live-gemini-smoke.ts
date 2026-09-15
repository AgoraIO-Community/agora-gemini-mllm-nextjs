import {
  AgoraClient,
  Area,
  createPreviewRoute,
  generateConvoAIToken,
  PreviewFeatures,
} from 'agora-agents';
import { NextRequest } from 'next/server';

process.loadEnvFile('.env.local');
console.error = (message: unknown, error: unknown) => {
  const cause = error instanceof Error ? error : message instanceof Error ? message : null;
  if (!cause && !(typeof message === 'string' && message.startsWith('Error '))) return;
  const status = cause && 'statusCode' in cause ? String(cause.statusCode) : 'unknown';
  process.stderr.write(`Demo route error: ${cause?.name ?? 'unknown'} (HTTP ${status})\n`);
};

async function main() {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = process.env.NEXT_AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate || !process.env.NEXT_GOOGLE_API_KEY) {
    throw new Error('Missing demo credentials');
  }

  const { POST: invite } = await import('../app/api/invite-agent/route');
  const { POST: stop } = await import('../app/api/stop-conversation/route');
  const client = new AgoraClient({ area: Area.US, appId, appCertificate });
  const route = createPreviewRoute(client, [PreviewFeatures.GeminiLive]);
  const token = generateConvoAIToken({
    appId, appCertificate, channelName: 'stop', uid: 0,
  });

  for (const [model, thinkingLevel] of [
    ['models/gemini-3.8-live', undefined],
    ['models/gemini-3.8-live-extended-thinking', 'medium'],
  ] as const) {
    const channel = `sdk-smoke-${Date.now()}-${process.pid}`;
    let agentId: string | undefined;
    try {
      const response = await invite(new NextRequest('http://localhost/api/invite-agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requester_id: '19995678', channel_name: channel, model,
          ...(thinkingLevel ? { thinking_level: thinkingLevel } : {}),
        }),
      }));
      if (!response.ok) throw new Error(`${model} START returned HTTP ${response.status}`);
      const body = (await response.json()) as { agent_id?: string };
      agentId = body.agent_id;
      if (!agentId) throw new Error(`${model} START returned no agent ID`);
      process.stdout.write(`${model}: START accepted; agent ID returned\n`);

      await new Promise((resolve) => setTimeout(resolve, 6000));
      const info = await route.agents.get(
        { appid: appId, agentId },
        { headers: { Authorization: `agora token=${token}` } },
      );
      process.stdout.write(`${model}: GET status: ${info.status ?? 'unknown'}\n`);
      if (info.status !== 'RUNNING') throw new Error(`${model}: Agent did not remain RUNNING`);
    } finally {
      if (agentId) {
        const response = await stop(new Request('http://localhost/api/stop-conversation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ agent_id: agentId }),
        }));
        if (!response.ok) throw new Error(`${model} STOP returned HTTP ${response.status}`);
        process.stdout.write(`${model}: STOP accepted\n`);
      }
    }
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`SMOKE error: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
