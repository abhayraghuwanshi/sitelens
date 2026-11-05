import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanEvents, scanTarball, suggestFunnels, goalTier, homepageMatches, createFunnelSuggest } from '../server/funnel-suggest.mjs';
import { createEngines } from '../server/engines.mjs';
import { createStore } from '../server/store.mjs';

test('scanEvents: the common analytics calls', () => {
  const code = `
    trackEvent('hero_cta_click', { location: 'hero' });
    trackDownloadEvent("download_cta_click", { action: "click" });
    window.gtag('event', 'file_download', {});
    logEvent(analytics, \`sign_up\`);
    posthog.capture('plan_select');
    window.dataLayer.push({ foo: 1, event: 'generate_lead' });
    trackEvent(eventName, payload);
  `;
  assert.deepEqual(scanEvents(code).sort(), ['download_cta_click', 'file_download', 'generate_lead', 'hero_cta_click', 'plan_select', 'sign_up']);
});

test('scanTarball: reads code files from a GitHub-style tarball and skips node_modules', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-tar-'));
  try {
    const root = join(dir, 'owner-site-abc123');
    await mkdir(join(root, 'src', 'components'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'lib'), { recursive: true });
    await writeFile(join(root, 'src', 'components', 'Downloads.tsx'), "trackEvent('download_cta_click'); trackEvent('file_download');");
    await writeFile(join(root, 'src', 'components', 'Hero.tsx'), "trackEvent('hero_cta_click');");
    await writeFile(join(root, 'node_modules', 'lib', 'index.js'), "trackEvent('not_ours');");
    await writeFile(join(root, 'README.md'), "trackEvent('in_docs');");
    execFileSync('tar', ['-czf', join(dir, 'repo.tgz'), '-C', dir, 'owner-site-abc123']);
    const events = scanTarball(await readFile(join(dir, 'repo.tgz')));
    assert.deepEqual([...events.keys()].sort(), ['download_cta_click', 'file_download', 'hero_cta_click']);
    assert.deepEqual(events.get('file_download'), ['src/components/Downloads.tsx']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('goalTier and homepageMatches', () => {
  assert.equal(goalTier('file_download'), 3);
  assert.equal(goalTier('download_cta_click'), 2);
  assert.equal(goalTier('downloads_section_view'), 0);
  assert.equal(goalTier('nav_link_click'), 0);
  assert.ok(homepageMatches('https://cool-desk.com', 'cool-desk.com'));
  assert.ok(homepageMatches('https://www.cool-desk.com/', 'cool-desk.com'));
  assert.ok(!homepageMatches('https://example.com', 'cool-desk.com'));
  assert.ok(!homepageMatches('', 'cool-desk.com'));
});

// 10 download sessions (intent → cta → file_download from "/"), 10 browsing ones.
function sessions() {
  const out = [];
  for (let i = 0; i < 10; i++) {
    out.push({ landing: '/', start: 0, events: [
      { name: 'section_view', ts: 1 },
      { name: 'download_intent_click', ts: 5 },
      { name: 'download_cta_click', ts: 9 },
      { name: 'file_download', ts: 12 },
    ] });
    out.push({ landing: '/blog/x', start: 0, events: [{ name: 'section_view', ts: 2 }, { name: 'nav_link_click', ts: 4 }] });
  }
  return out;
}

test('suggestFunnels: ends at the strongest outcome, keeps the steps that lead to it in time order', () => {
  const code = new Map([
    ['download_intent_click', ['site/src/components/Downloads.tsx']],
    ['download_cta_click', ['site/src/components/Downloads.tsx']],
    ['file_download', ['site/src/lib/analytics.ts', 'site/src/components/Downloads.tsx']],
  ]);
  const funnels = suggestFunnels(sessions(), code);
  const [first] = funnels;
  assert.equal(first.goal, 'file_download');
  assert.deepEqual(first.steps, [
    { kind: 'page', value: '/' },
    { kind: 'event', value: 'download_intent_click' },
    { kind: 'event', value: 'download_cta_click' },
    { kind: 'event', value: 'file_download' },
  ]);
  assert.equal(first.name, 'Downloads: file download');
  assert.match(first.why, /10 of 20 sessions/);
  assert.match(first.why, /Downloads\.tsx/);
  assert.equal(funnels.length, 1, 'the CTA and intent clicks are steps of this funnel, not funnels of their own');
  // section_view fires in every session, so it isn't a step.
  assert.ok(!first.steps.some((s) => s.value === 'section_view'));
});

test('suggestFunnels: nothing to suggest without outcome-like events', () => {
  assert.deepEqual(suggestFunnels([{ landing: '/', events: [{ name: 'section_view', ts: 1 }] }]), []);
});

test('suggest: demo site works without GitHub', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-fs-'));
  try {
    const store = createStore(dir);
    const engines = createEngines({ auth: {}, bigquery: {} });
    const fs = createFunnelSuggest({ store, engines, getToken: async () => '' });
    const out = await fs.suggest({ id: 'demo', demo: true, host: 'example.com' }, '28d');
    assert.ok(out.funnels.length >= 1);
    assert.ok(out.funnels.every((f) => f.steps.length >= 2 && f.steps.at(-1).value === f.goal));
    assert.ok(out.funnels.some((f) => ['sign_up', 'file_download', 'generate_lead'].includes(f.goal)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('suggest: finds the site repo by homepage and reads its code', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-fs-'));
  try {
    const root = join(dir, 'me-site-1');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'Downloads.tsx'), "trackEvent('download_cta_click'); trackEvent('file_download'); trackEvent('old_event');");
    execFileSync('tar', ['-czf', join(dir, 'repo.tgz'), '-C', dir, 'me-site-1']);
    const tgz = await readFile(join(dir, 'repo.tgz'));
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (url.includes('/user/repos')) return Response.json([{ full_name: 'me/site', homepage: 'https://cool-desk.com', pushed_at: 't1' }, { full_name: 'me/other', homepage: 'https://x.dev' }]);
      if (url.endsWith('/repos/me/site/tarball')) return new Response(tgz);
      return new Response('nope', { status: 404 });
    };
    const engines = { funnelDiscovery: async () => ({ meta: { source: 'bigquery' }, sessions: sessions() }) };
    const fs = createFunnelSuggest({ store: createStore(dir), engines, getToken: async () => 'tok', fetchImpl });
    const out = await fs.suggest({ id: 's', host: 'cool-desk.com' }, '28d');
    assert.deepEqual(out.code.repos, [{ name: 'me/site', events: 3 }]);
    assert.deepEqual(out.code.unseen, ['old_event']);
    assert.equal(out.funnels[0].name, 'Downloads: file download');
    await fs.suggest({ id: 's', host: 'cool-desk.com' }, '28d');
    assert.equal(calls.filter((u) => u.endsWith('/tarball')).length, 1, 'tarball cached until the repo changes');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('suggestFunnels: drops a step that usually comes in the other order', () => {
  // promo_click comes before the download in only 3 of 8 sessions: as a step it would cut the funnel below half.
  const list = [];
  for (let i = 0; i < 8; i++) {
    list.push({ landing: '/', start: 0, events: [
      { name: 'download_intent_click', ts: 2 },
      { name: 'download_cta_click', ts: 5 },
      { name: 'promo_click', ts: i < 3 ? 7 : 11 },
      { name: 'file_download', ts: 9 },
    ].sort((a, b) => a.ts - b.ts) });
    list.push({ landing: '/blog', start: 0, events: [{ name: 'section_view', ts: 1 }] });
  }
  const [first] = suggestFunnels(list);
  assert.deepEqual(first.steps.map((s) => s.value), ['/', 'download_intent_click', 'download_cta_click', 'file_download']);
});
