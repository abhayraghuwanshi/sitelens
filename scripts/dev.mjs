// Runs the API server (with --watch) and the Vite dev server together.
// STUDIO_VITE_PORT pins Vite to one port (and fails rather than moving).
import { spawn } from 'node:child_process';

const vitePort = process.env.STUDIO_VITE_PORT;

const env = { ...process.env, STUDIO_APP_URL: process.env.STUDIO_APP_URL || 'http://127.0.0.1:5173/' };
const children = [
  spawn(process.execPath, ['--no-warnings=ExperimentalWarning', '--watch', 'server/index.mjs'], { stdio: 'inherit', env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', ...(vitePort ? ['--port', vitePort, '--strictPort'] : [])], { stdio: 'inherit', env }),
];
const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((child) => child.on('exit', (code) => {
  stop();
  process.exitCode = code ?? 0;
}));
