// `npm run desktop:dev`: the desktop window on live code. Runs `npm run dev`
// (the API on 4318 restarting on server changes, and Vite reloading the web app
// on save) with the desktop app's own data folder, then opens the Tauri window
// on Vite's page. `npm run desktop:preview` runs the packaged copy instead.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
// Its own port, so another project's Vite on 5173 can't be shown instead.
const VITE_PORT = process.env.STUDIO_VITE_PORT || '5180';
const VITE = `http://127.0.0.1:${VITE_PORT}/`;
// The same data (sign-ins, history) the installed app uses.
const DATA = process.env.STUDIO_DATA_DIR || join(homedir(), 'Library', 'Application Support', 'com.sitelens.studio');

const run = (cmd, args, env = {}) => spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
const children = [];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

async function main() {
  // Tauri still compiles against the staged sidecar and resources: stage once if they're missing.
  if (!existsSync(join(ROOT, 'src-tauri', 'app', 'server')) || !existsSync(join(ROOT, 'src-tauri', 'binaries'))) {
    await new Promise((ok, fail) => run('npm', ['run', 'desktop:stage']).on('exit', (code) => (code ? fail(new Error('staging failed')) : ok())));
  }
  children.push(run(process.execPath, ['scripts/dev.mjs'], { STUDIO_DATA_DIR: DATA, PORT: '4318', STUDIO_APP_URL: VITE, STUDIO_VITE_PORT: VITE_PORT }));
  children.push(run('npx', ['tauri', 'dev'], { STUDIO_DEV_URL: VITE }));
  for (const child of children) child.on('exit', (code) => { stop(); process.exitCode = code ?? 0; });
}

main().catch((err) => {
  console.error(err.message);
  stop();
  process.exitCode = 1;
});
