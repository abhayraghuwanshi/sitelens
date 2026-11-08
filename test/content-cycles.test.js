import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { cycleWindow, cycleOn, engineOf, categoryOf, cycleVerdict, buildCycle, valueOf, createContentCycles } from '../server/content-cycles.mjs';

const today = '2026-11-08';
const snap = (path, patch = {}) => ({
  path, title: path, published: '2026-03-01', category: 'Guides', visits: 0, engaged: 0, conversions: 0,
  google: { clicks: 0, impressions: 0, position: null }, bing: { clicks: 0, impressions: 0, position: null }, ai: { sessions: 0, cited: 0 }, byEngine: {}, ...patch,
});

test('cycles: back-to-back windows from the start day', () => {
  assert.deepEqual(cycleWindow('2026-10-01', 14, 1), { n: 1, start: '2026-10-01', end: '2026-10-14', days: 14 });
  assert.deepEqual(cycleWindow('2026-10-01', 14, 2), { n: 2, start: '2026-10-15', end: '2026-10-28', days: 14 });
  assert.equal(cycleOn('2026-10-01', 14, '2026-10-01'), 1);
  assert.equal(cycleOn('2026-10-01', 14, '2026-10-14'), 1);
  assert.equal(cycleOn('2026-10-01', 14, '2026-10-15'), 2);
  assert.equal(cycleOn('2026-10-01', 14, '2026-09-20'), 1);
});

test('engineOf: sources go to the engine that sent them', () => {
  assert.equal(engineOf('google'), 'google');
  assert.equal(engineOf('bing'), 'bing');
  assert.equal(engineOf('duckduckgo'), 'bing');
  assert.equal(engineOf('chatgpt.com'), 'ai');
  assert.equal(engineOf('perplexity.ai'), 'ai');
  assert.equal(engineOf('(direct)'), 'other');
  assert.equal(engineOf('reddit.com'), 'other');
});

test('categoryOf: your label, then the topic page, then the topic of its queries, then the URL', () => {
  const groups = [{ name: 'Brand', pattern: 'acme' }, { name: 'Analytics tools', pattern: 'plausible|fathom' }, { name: 'Search Console', pattern: 'search console|gsc' }];
  const topicPages = new Map([['/blog/pillar', 'Search Console']]);
  assert.deepEqual(categoryOf({ path: '/blog/x' }, { override: 'Mine' }), { name: 'Mine', from: 'you' });
  assert.equal(categoryOf({ path: '/blog/pillar' }, { groups, topicPages }).name, 'Search Console');
  assert.equal(categoryOf({ path: '/blog/a', queries: [{ query: 'acme vs plausible', impressions: 10 }, { query: 'gsc api', impressions: 400 }] }, { groups }).name, 'Search Console');
  assert.equal(categoryOf({ path: '/blog/a', title: 'Fathom, a year in', queries: [] }, { groups }).name, 'Analytics tools');
  assert.equal(categoryOf({ path: '/guides/setup' }).name, 'Guides');
  assert.equal(categoryOf({ path: '/blog/2026/10/launch' }).name, 'Uncategorized');
  assert.equal(categoryOf({ path: '/case-studies/acme' }).name, 'Case studies');
});

test('cycleVerdict: grow the leaders, improve the near-misses, cut what nothing finds twice', () => {
  const v = (r, prev = null, ctx = {}) => cycleVerdict(r, prev, { days: 14, today, rank: 1, size: 3, ...ctx }).verdict;
  const dead = snap('/a');
  assert.equal(v(snap('/new', { published: '2026-10-30' })), 'new');
  assert.equal(v(dead, dead), 'cut');
  assert.equal(v(dead, snap('/a', { visits: 30 })), 'watch');
  assert.equal(v(snap('/old', { published: '2025-01-01' })), 'cut'); // first cycle, long dead
  assert.equal(v(snap('/young', { published: '2026-09-15' })), 'watch'); // first cycle, still young
  assert.equal(v(snap('/hit', { visits: 80, engaged: 50, conversions: 4, google: { clicks: 60, impressions: 900, position: 5, query: 'x' } })), 'grow');
  assert.equal(v(snap('/hit', { visits: 80, engaged: 50 }), null, { rank: 3, size: 3 }), 'keep');
  assert.equal(v(snap('/bounce', { visits: 40, engaged: 5 }), null, { rank: 3, size: 3 }), 'improve');
  assert.equal(v(snap('/skipped', { visits: 3, engaged: 2, google: { clicks: 1, impressions: 600, position: 9 } }), null, { rank: 3, size: 3 }), 'improve');
  // An AI citation alone keeps an article alive.
  assert.equal(v(snap('/cited', { ai: { sessions: 0, cited: 2 } }), dead), 'keep');
  assert.match(cycleVerdict(dead, dead, { today }).why, /two cycles running/);
});

test('buildCycle: ranks within each category and says which article each engine favours', () => {
  const rows = [
    snap('/g', { category: 'A', visits: 50, engaged: 30, google: { clicks: 40, impressions: 500, position: 4 }, byEngine: { google: { visits: 40, engaged: 25, conversions: 3 } }, conversions: 3 }),
    snap('/b', { category: 'A', visits: 20, engaged: 12, bing: { clicks: 15, impressions: 100, position: 3 } }),
    snap('/dead', { category: 'A' }),
    snap('/solo', { category: 'B', visits: 12, engaged: 8, ai: { sessions: 3, cited: 4 } }),
  ];
  const prev = new Map([['/g', snap('/g', { visits: 25 })], ['/dead', snap('/dead')]]);
  const out = buildCycle({ rows, prev, today });
  const a = out.categories.find((c) => c.name === 'A');
  assert.equal(a.engines.google.leader.path, '/g');
  assert.equal(a.engines.bing.leader.path, '/b');
  assert.equal(a.engines.ai.leader, null);
  assert.equal(a.engines.agree, false);
  assert.equal(a.engines.google.conversions, 3);
  assert.equal(out.rows.find((r) => r.path === '/g').verdict, 'grow');
  assert.equal(out.rows.find((r) => r.path === '/g').previous, 25);
  assert.equal(out.rows.find((r) => r.path === '/dead').verdict, 'cut');
  assert.equal(out.rows.find((r) => r.path === '/solo').verdict, 'grow');
  assert.equal(valueOf(rows[3]), 12 + 3 * 4);
  assert.equal(out.totals.unseen, 2);
  assert.equal(out.rows[0].verdict, 'grow');
});

test('service: a finished cycle is measured once, then judged against the one before', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cycles-'));
  try {
    const store = createStore(dir);
    await store.update((s) => { s.sites = [{ id: 's1', host: 'x.dev', searchSite: 'sc-domain:x.dev', propertyId: '' }]; });
    const site = await store.site('s1');
    let clock = Date.parse('2026-10-01T10:00:00Z');
    let calls = 0;
    const articles = { list: async () => ({ rows: [{ path: '/blog/a', title: 'A', published: '2026-01-01', inSitemap: true }, { path: '/blog/b', title: 'B', published: '2026-08-20', inSitemap: true }] }) };
    const cycles = createContentCycles({
      dbPath: join(dir, 'cycles.db'), store, articles, now: () => clock, log: { error() {} },
      auth: { token: async () => 't' },
      bing: { pageStats: async () => [{ page: 'https://x.dev/blog/a', clicks: 4, impressions: 40, position: 3 }] },
      aiSearch: { citations: () => ({ asked: 0, pages: new Map() }) },
    });
    // Search Console is stubbed through the global fetch the shared client uses.
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ rows: [{ keys: ['https://x.dev/blog/a', 'q'], clicks: 9, impressions: 90, ctr: 0.1, position: 4 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
      const started = await cycles.saveSettings(site, { on: true, days: 14 });
      assert.equal(started.settings.start, '2026-10-01');
      assert.equal(started.cycles.length, 0);
      clock = Date.parse('2026-10-18T10:00:00Z'); // cycle 1 ended on the 14th; search data in by the 17th
      const after = await cycles.overview(site);
      assert.equal(after.cycles.length, 1);
      assert.equal(after.report.kind, 'closed');
      assert.equal(after.report.n, 1);
      const a = after.report.rows.find((r) => r.path === '/blog/a');
      assert.equal(a.bing.clicks, 4);
      assert.ok(a.google);
      assert.equal(after.report.rows.find((r) => r.path === '/blog/b').verdict, 'watch');
      const before = calls;
      await cycles.overview(site, { cycle: '1' });
      assert.equal(calls, before, 'a stored cycle is read from disk');
      await cycles.setCategory(site, { path: '/blog/a', category: 'Pillars' });
      assert.equal((await store.get()).contentCycles.s1.categories['/blog/a'], 'Pillars');
    } finally {
      globalThis.fetch = realFetch;
      cycles.stop();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
