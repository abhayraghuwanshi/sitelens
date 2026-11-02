// Renders docs/trailer.html to docs/trailer.gif, frame by frame. The page's
// window.__trailer.seek() pins every CSS animation to an exact time, so the
// output does not depend on how fast headless Chrome can take screenshots.
//
// Usage: node scripts/record-trailer.mjs [fps] [width]   (needs ffmpeg on PATH)

import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [fpsArg = '12', widthArg = '880'] = process.argv.slice(2);
const fps = Number(fpsArg);
const outWidth = Number(widthArg);
const root = path.resolve(import.meta.dirname, '..');
const page = pathToFileURL(path.join(root, 'docs/trailer.html')).href;
const out = path.join(root, 'docs/trailer.gif');
const port = 9300 + Math.floor(Math.random() * 400);
const profile = await mkdtemp(path.join(tmpdir(), 'sitelens-trailer-'));
const frames = await mkdtemp(path.join(tmpdir(), 'sitelens-frames-'));

const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await wait(100);
  }
  throw new Error('Chrome DevTools endpoint did not start');
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

// Hide the player controls and let the film frame fill the 1280×720 viewport.
const recordCss = `
  body { padding: 0 !important; }
  .wrap { max-width: none !important; gap: 0 !important; }
  .controls, .note { display: none !important; }
  .frame { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
`;

let exitCode = 0;
try {
  await waitForDebugger();
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(
    (response) => response.json(),
  );
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const send = cdp(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: page });
  await wait(1500);
  await send('Runtime.evaluate', {
    expression: `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(recordCss)}; document.head.append(s); return document.fonts.ready.then(() => true); })()`,
    awaitPromise: true,
  });
  await wait(400);

  const { result } = await send('Runtime.evaluate', { expression: 'window.__trailer.total', returnByValue: true });
  const total = result.value;
  const count = Math.floor((total / 1000) * fps);
  for (let n = 0; n < count; n++) {
    await send('Runtime.evaluate', { expression: `window.__trailer.seek(${(n * 1000) / fps})` });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(frames, `f${String(n).padStart(5, '0')}.png`), Buffer.from(shot.data, 'base64'));
    if (n % 60 === 0) process.stdout.write(`\rframe ${n}/${count}`);
  }
  console.log(`\rcaptured ${count} frames`);

  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-framerate', String(fps),
      '-i', path.join(frames, 'f%05d.png'),
      '-vf', `scale=${outWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      '-loop', '0',
      out,
    ],
    { stdio: 'inherit' },
  );
  console.log(`Saved ${path.relative(root, out)}`);
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  try {
    chrome.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  await rm(frames, { recursive: true, force: true });
}

process.exit(exitCode);
