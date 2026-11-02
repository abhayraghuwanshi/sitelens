// Headless screenshot helper for the preview harness, using the DevTools
// Protocol so the viewport can be genuinely narrow (Chrome enforces a minimum
// window width, which makes --window-size unreliable for side-panel widths).
//
// Usage: node dev/screenshot.mjs <url> <out.png> [width] [height] [--theme dark]

import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith('--'));
const themed = args.find((arg) => arg.startsWith('--theme='));
const clickArg = args.find((arg) => arg.startsWith('--click='));
const evalArg = args.find((arg) => arg.startsWith('--eval='));
const scrollArg = args.find((arg) => arg.startsWith('--scroll='));
const viewportOnly = args.includes('--viewport');
const [url, out = 'shot.png', widthArg = '390', heightArg = '1400'] = positional;
const width = Number(widthArg);
const height = Number(heightArg);
const port = 9300 + Math.floor(Math.random() * 400);
const profile = await mkdtemp(path.join(tmpdir(), 'sitelens-shot-'));

if (!url) {
  console.error('Usage: node dev/screenshot.mjs <url> <out.png> [width] [height]');
  process.exit(1);
}

const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
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

function themeQuery(base) {
  if (!themed) return base;
  const value = themed.split('=')[1] || 'dark';
  const parsed = new URL(base);
  parsed.searchParams.set('theme', value);
  return parsed.toString();
}

let exitCode = 0;
try {
  await waitForDebugger();
  const target = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(themeQuery(url))}`,
    { method: 'PUT' },
  ).then((response) => response.json());

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const send = cdp(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Emulation.setEmulatedMedia', {
    features: [
      {
        name: 'prefers-color-scheme',
        value: (themed?.split('=')[1] || 'light') === 'dark' ? 'dark' : 'light',
      },
    ],
  });

  await send('Page.navigate', { url: themeQuery(url) });
  await wait(1600);
  if (clickArg) {
    const selector = clickArg.slice('--click='.length);
    await send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)})?.click()`,
    }).catch(() => {});
    await wait(700);
  }
  if (evalArg) {
    const expression = evalArg.slice('--eval='.length);
    await send('Runtime.evaluate', { expression, awaitPromise: true }).catch(() => {});
    await wait(500);
  }
  if (scrollArg) {
    const target = scrollArg.split('=')[1] || 'bottom';
    const expression =
      target === 'top'
        ? 'window.scrollTo(0, 0)'
        : 'window.scrollTo(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))';
    await send('Runtime.evaluate', { expression });
    await wait(450);
  }
  await wait(600);

  // Let the panel finish its async boot + first chart paint.
  await send('Runtime.evaluate', {
    expression: 'document.fonts ? document.fonts.ready : null',
    awaitPromise: true,
  }).catch(() => {});
  await wait(600);

  const metrics = await send('Page.getLayoutMetrics');
  const content = metrics.cssContentSize || metrics.contentSize;
  const captureHeight = viewportOnly ? height : Math.max(height, Math.ceil(content?.height || height));

  const result = await send(
    'Page.captureScreenshot',
    scrollArg && viewportOnly
      ? { format: 'png' }
      : {
          format: 'png',
          captureBeyondViewport: !viewportOnly,
          clip: {
            x: 0,
            y: 0,
            width,
            height: captureHeight,
            scale: 1,
          },
        },
  );

  await writeFile(out, Buffer.from(result.data, 'base64'));
  console.log(`Saved ${out} (${width}×${captureHeight})`);
} catch (error) {
  console.error(error.message);
  exitCode = 1;
} finally {
  try {
    chrome.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

process.exit(exitCode);
