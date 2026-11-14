// Stages what the desktop app ships: the server, the shared GA4 code, the built
// web app and production node_modules go to src-tauri/app/; an official Node
// runtime goes to src-tauri/binaries/ as Tauri's sidecar. The Node download is
// checksum-verified and cached, so later builds are offline.
//
// Usage: node scripts/stage-desktop.mjs   (run by `npm run desktop:build`)

import { execFileSync } from 'node:child_process';
import { cp, mkdir, rm, stat, writeFile, readFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// node:sqlite is unflagged from 22.13; 24 is the current LTS line.
const NODE_VERSION = 'v24.22.2';
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const TAURI = join(ROOT, 'src-tauri');
const APP = join(TAURI, 'app');
const CACHE = join(TAURI, '.cache');

const TARGETS = {
  'darwin-arm64': { dist: 'darwin-arm64', triple: 'aarch64-apple-darwin' },
  'darwin-x64': { dist: 'darwin-x64', triple: 'x86_64-apple-darwin' },
};

const exists = (p) => stat(p).then(() => true, () => false);
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

async function stageApp() {
  await rm(APP, { recursive: true, force: true });
  await mkdir(join(APP, 'web'), { recursive: true });
  for (const dir of ['server', 'shared']) await cp(join(ROOT, dir), join(APP, dir), { recursive: true });
  await cp(join(ROOT, 'web/dist'), join(APP, 'web/dist'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) await cp(join(ROOT, file), join(APP, file));
  run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], APP);
  await rm(join(APP, 'package-lock.json'));
}

async function stageNode() {
  const target = TARGETS[`${process.platform}-${process.arch}`];
  if (!target) throw new Error(`No desktop build for ${process.platform}-${process.arch} yet.`);
  const name = `node-${NODE_VERSION}-${target.dist}`;
  const out = join(TAURI, 'binaries', `node-${target.triple}`);
  const tarball = join(CACHE, `${name}.tar.gz`);
  await mkdir(CACHE, { recursive: true });
  await mkdir(join(TAURI, 'binaries'), { recursive: true });

  if (!(await exists(tarball))) {
    const base = `https://nodejs.org/dist/${NODE_VERSION}`;
    const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
    const expected = sums.split('\n').find((l) => l.endsWith(`  ${name}.tar.gz`))?.split(/\s+/)[0];
    if (!expected) throw new Error(`${name}.tar.gz isn't in Node's SHASUMS256.txt.`);
    console.log(`Downloading ${name}…`);
    const res = await fetch(`${base}/${name}.tar.gz`);
    if (!res.ok) throw new Error(`Node download failed: HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const actual = createHash('sha256').update(body).digest('hex');
    if (actual !== expected) throw new Error(`Node checksum mismatch: expected ${expected}, got ${actual}.`);
    await writeFile(tarball, body);
  }
  run('tar', ['-xzf', tarball, '-C', CACHE, `${name}/bin/node`], ROOT);
  await cp(join(CACHE, name, 'bin/node'), out);
  await chmod(out, 0o755);
  console.log(`Sidecar: ${out}`);
}

if (!(await exists(join(ROOT, 'web/dist/index.html')))) run('npx', ['vite', 'build'], ROOT);
await stageApp();
await stageNode();
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
console.log(`Staged Kauzl ${pkg.version || ''} for the desktop app.`);
