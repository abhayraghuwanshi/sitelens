// Runs the public website locally: the free tools (tools/dist on :3000) and
// the hosted server (home, sign-in, tour, /tools/ proxied) on :8080 with --watch.
// Settings come from real env vars, then .env, then local-only defaults, so
// the pages render without any setup. Google sign-in needs real credentials.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

try { process.loadEnvFile('.env'); } catch {}

const toolsPort = process.env.TOOLS_PORT || '3000';
const port = process.env.PORT || '8080';
const dataDir = process.env.STUDIO_DATA_DIR || '.data/hosted';
mkdirSync(dataDir, { recursive: true });

// Keep one master key per data folder, so restarts can still read what's stored.
const keyFile = join(dataDir, 'dev-master-key');
if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString('base64'), { mode: 0o600 });

const env = {
  ...process.env,
  STUDIO_HOST: process.env.STUDIO_HOST || 'localhost',
  MASTER_KEY: process.env.MASTER_KEY || readFileSync(keyFile, 'utf8').trim(),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'dev',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'dev',
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS || 'nobody@example.com',
  STUDIO_DATA_DIR: dataDir,
  TOOLS_ORIGIN: process.env.TOOLS_ORIGIN || `http://localhost:${toolsPort}`,
  PORT: port,
};

// Build with links back to this local site, not kauzl.com.
execFileSync(process.execPath, ['tools/build.mjs'], { stdio: 'inherit', env: { ...process.env, APP_URL: process.env.APP_URL || `http://localhost:${port}` } });

const children = [
  spawn('npx', ['--yes', 'serve', 'tools/dist', '-l', toolsPort, '--no-clipboard'], { stdio: 'inherit', env }),
  spawn(process.execPath, ['--no-warnings=ExperimentalWarning', '--watch', 'server/hosted.mjs'], { stdio: 'inherit', env }),
];
console.log(`\n  Website  →  http://localhost:${port}/home   (tools: http://localhost:${toolsPort}/tools/)\n`);

const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((child) => child.on('exit', (code) => {
  stop();
  process.exitCode = code ?? 0;
}));
