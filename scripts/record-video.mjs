// Records docs/trailer.mp4 from the real app: builds the web app, starts a
// throwaway server whose only site is the built-in demo (so no real numbers end
// up in the video), screenshots each view at 2x, renders
// scripts/trailer-video/film.html frame by frame, and adds the synthesized
// soundtrack from trailer-music.mjs.
//
// Usage: node scripts/record-video.mjs [fps]   (needs Chrome and ffmpeg on PATH)

import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { score } from './trailer-music.mjs';

const fps = Number(process.argv[2] || 30);
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'docs/trailer.mp4');
const work = await mkdtemp(path.join(tmpdir(), 'sitelens-video-'));
const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Views to capture, as [file name, route]. Oct 17, 2026 is the demo's Reddit-post day,
// which the Calendar caption in film.html describes.
const SHOTS = [
  ['overview', '#/site/demo/overview'],
  ['calOct', '#/calendar?month=2026-10&day=2026-10-17'],
  ['search', '#/site/demo/search'],
  ['paths', '#/site/demo/paths'],
  ['pathsPricing', '#/site/demo/paths?start=%2Fpricing'],
  ['funnels', '#/site/demo/funnels'],
  ['retention', '#/site/demo/retention'],
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await wait(100);
  }
  throw new Error(`${url} did not start`);
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

async function openTab(port, width, height, scale) {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = cdp(ws);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  return send;
}

const appPort = 4400 + Math.floor(Math.random() * 300);
const chromePort = 9300 + Math.floor(Math.random() * 400);
let server;
let chrome;
let exitCode = 0;
try {
  execFileSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });

  server = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', path.join(root, 'server/index.mjs')], {
    cwd: root,
    env: { ...process.env, STUDIO_DATA_DIR: path.join(work, 'data'), PORT: String(appPort) },
    stdio: 'ignore',
  });
  chrome = spawn(
    chromePath,
    ['--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
      `--remote-debugging-port=${chromePort}`, `--user-data-dir=${path.join(work, 'chrome')}`, 'about:blank'],
    { stdio: 'ignore' },
  );
  await waitFor(`http://127.0.0.1:${appPort}/api/state`);
  await waitFor(`http://127.0.0.1:${chromePort}/json/version`);

  // 1. Screens of the real app.
  const shots = path.join(work, 'film/shots');
  await mkdir(shots, { recursive: true });
  const app = await openTab(chromePort, 1600, 1000, 2);
  await app('Page.navigate', { url: `http://127.0.0.1:${appPort}/#/` });
  await wait(1500);
  for (const [name, hash] of SHOTS) {
    await app('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(hash)}` });
    await wait(2600);
    const shot = await app('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(shots, `${name}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`captured ${name}`);
  }

  // 2. The film, frame by frame, piped to ffmpeg.
  const filmPage = path.join(work, 'film/film.html');
  await copyFile(path.join(root, 'scripts/trailer-video/film.html'), filmPage);
  const film = await openTab(chromePort, 1920, 1080, 1);
  await film('Page.navigate', { url: pathToFileURL(filmPage).href });
  await wait(1500);
  await film('Runtime.evaluate', { expression: 'window.__film.ready.then(() => true)', awaitPromise: true });
  await wait(400);
  const { result } = await film('Runtime.evaluate', { expression: '({ total: window.__film.total, cues: window.__film.cues })', returnByValue: true });
  const { total, cues } = result.value;

  const video = path.join(work, 'video.mp4');
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', video], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));
  const count = Math.round((total / 1000) * fps);
  for (let n = 0; n < count; n++) {
    await film('Runtime.evaluate', { expression: `window.__film.seek(${(n * 1000) / fps})` });
    const frame = await film('Page.captureScreenshot', { format: 'png' });
    if (!ffmpeg.stdin.write(Buffer.from(frame.data, 'base64'))) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    if (n % 60 === 0) process.stdout.write(`\rframe ${n}/${count}`);
  }
  ffmpeg.stdin.end();
  await done;
  console.log(`\rrendered ${count} frames`);

  // 3. Soundtrack, cut to the scene starts, then mux.
  const music = path.join(work, 'music.wav');
  await writeFile(music, score({ total: total / 1000, cues }));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', music, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log(`Saved ${path.relative(root, out)}`);
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  chrome?.kill('SIGTERM');
  server?.kill('SIGTERM');
  await wait(300);
  await rm(work, { recursive: true, force: true });
}

process.exit(exitCode);
