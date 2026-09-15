import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

const preferredPort = Number(process.env.PORT ?? process.argv[2] ?? 3000);
if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

async function findAvailablePort(start) {
  for (let port = start; port <= 65535 && port < start + 100; port++) {
    const available = await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', (error) => {
        if (error.code === 'EADDRINUSE') resolve(false);
        else reject(error);
      });
      probe.listen(port, () => probe.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No available TCP port found from ${start}`);
}

const port = await findAvailablePort(preferredPort);
process.stdout.write(`Using http://localhost:${port}\n`);

const root = process.cwd();
const credentials = join(root, '.env.local');
if (existsSync(credentials)) {
  process.loadEnvFile(credentials);
}
const build = join(root, '.next', 'standalone');
const server = join(build, 'server.js');
const staticAssets = join(root, '.next', 'static');
if (!existsSync(server) || !existsSync(staticAssets)) {
  throw new Error('Standalone build is missing. Run pnpm run build first.');
}

mkdirSync(join(build, '.next'), { recursive: true });
cpSync(staticAssets, join(build, '.next', 'static'), { recursive: true });
const publicAssets = join(root, 'public');
if (existsSync(publicAssets)) {
  cpSync(publicAssets, join(build, 'public'), { recursive: true });
}

const child = spawn(process.execPath, [server], {
  env: { ...process.env, PORT: String(port), HOSTNAME: '0.0.0.0' },
  stdio: 'inherit',
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 128 : (code ?? 1);
});
