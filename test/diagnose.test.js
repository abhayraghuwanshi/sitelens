import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentRun, speedRun, indexRun, botsRun, readHtml, createDiagnose } from '../server/diagnose.mjs';
import { buildTimeline } from '../server/page-events.mjs';

test('content: problems first, the key counts them', () => {
  const r = contentRun([
    { level: 'warn', text: 'Title is 72 characters; Google usually cuts it near 60.' },
    { level: 'ok', text: '1,240 words.' },
    { level: 'warn', text: '“dock for windows” (900 impressions) — the title never says “windows”.', query: 'dock for windows' },
  ]);
  assert.equal(r.key, '2 problems');
  assert.equal(r.headline, '2 problems · title is 72 characters');
  assert.equal(r.tone, 'warn');
  assert.deepEqual(r.cells.map((c) => c.value), ['2', '1,240']);
  assert.equal(r.findings.length, 2);
  assert.equal(r.findings[1].note, 'from Search Console');
  assert.equal(contentRun([{ level: 'ok', text: '900 words.' }]).headline, 'nothing to fix');
});

test('speed: seconds on phones, toned against 2.5 s and 4 s', () => {
  const r = speedRun({ lcp: 4400, score: 41, cls: 0.02, tbt: 520 });
  assert.equal(r.key, '4.4 s');
  assert.equal(r.headline, '4.4 s on phones');
  assert.equal(r.tone, 'down');
  assert.equal(r.cells[1].value, '41');
  assert.equal(r.findings.length, 2);
  assert.equal(speedRun({ lcp: 1900, score: 95 }).tone, 'up');
  assert.equal(speedRun({ error: 'quota' }).failed, true);
});

test('index: one verdict from both engines, with why and the fix', () => {
  const ok = indexRun({ google: { indexed: true, coverage: 'Submitted and indexed' }, bing: { known: true, httpStatus: 200, lastCrawled: '2026-11-10' } });
  assert.equal(ok.headline, 'shown by Google and Bing');
  assert.equal(ok.key, 'Shown / Shown');
  const no = indexRun({ google: { indexed: false, coverage: 'Crawled - currently not indexed' }, bing: { known: false } });
  assert.equal(no.headline, 'crawled, not indexed');
  assert.equal(no.tone, 'down');
  assert.equal(no.findings.length, 2);
});

test('readHtml counts visible words only and sees noindex', () => {
  const h = readHtml('<html><head><title>Docks</title><meta name="robots" content="noindex,follow"><style>a{}</style></head><body><script>var x = "lots of words here"</script><h1>Best docks</h1><p>Three good ones.</p></body></html>');
  assert.deepEqual(h, { words: 5, title: 'Docks', noindex: true });
  assert.equal(readHtml('<p>hi</p>', { 'x-robots-tag': 'noindex' }).noindex, true);
});

test('bots: says when AI crawlers get less than Google', () => {
  const r = botsRun({ google: { status: 200, words: 1200, title: 'Docks', noindex: false }, gpt: { status: 200, words: 120, noindex: false } });
  assert.equal(r.headline, '1,200 words for Googlebot, 120 words for GPTBot');
  assert.equal(r.tone, 'warn');
  assert.match(r.findings[0].text, /GPTBot gets 120 words/);
  const blocked = botsRun({ google: { status: 200, words: 900, noindex: false }, gpt: { status: 403, words: 0, noindex: false } });
  assert.equal(blocked.tone, 'down');
  assert.match(blocked.headline, /GPTBot: http 403/);
});

function memStore() {
  let data = {};
  return { get: async () => data, update: async (fn) => { fn(data); } };
}

test('a run is kept, listed for its page, and shows on the page timeline; a repeat folds', async () => {
  const store = memStore();
  let lcp = 4400;
  const days = ['2026-11-10', '2026-11-17', '2026-11-19'];
  let d = 0;
  const dg = createDiagnose({ store, vitals: { psiUrl: async () => ({ lcp, score: 40 }) }, editor: {}, hub: {}, today: () => days[d] });
  const site = { id: 's', host: 'example.com' };
  const a = await dg.run(site, { path: '/pricing', tool: 'speed' });
  assert.equal(a.headline, '4.4 s on phones');
  d = 1; await dg.run(site, { path: '/pricing', tool: 'speed' });
  d = 2; lcp = 2600; await dg.run(site, { path: '/pricing', tool: 'speed' });
  const ov = await dg.overview(site, { path: '/pricing' });
  assert.equal(ov.tools.find((t) => t.key === 'speed').last.key, '2.6 s');
  assert.equal(ov.runs.length, 3);
  const t = buildTimeline({ path: '/pricing', today: '2026-11-20', checks: await dg.runs(site, { path: '/pricing' }) });
  assert.deepEqual(t.events.map((e) => e.title), ['Speed test: 4.4 s on phones', 'Speed test: no change', 'Speed test: 2.6 s on phones']);
  assert.equal(t.events[0].who, 'you');
});

test('runs are checked: a real path and a known tool; failed runs are not kept', async () => {
  const store = memStore();
  const dg = createDiagnose({ store, vitals: { psiUrl: async () => ({ error: 'quota' }) }, editor: {}, hub: {} });
  await assert.rejects(dg.run({ id: 's' }, { path: 'pricing', tool: 'speed' }), /Pick a page/);
  await assert.rejects(dg.run({ id: 's' }, { path: '/p', tool: 'nope' }), /Unknown check/);
  const r = await dg.run({ id: 's', host: 'x.com' }, { path: '/p', tool: 'speed' });
  assert.equal(r.failed, true);
  assert.equal((await dg.runs({ id: 's' })).length, 0);
});

test('wording: same words for both crawlers, entity-free titles, short search headlines', () => {
  assert.equal(botsRun({ google: { status: 200, words: 900, noindex: false }, gpt: { status: 200, words: 900, noindex: false } }).headline, 'both crawlers get 900 words');
  assert.equal(readHtml('<title>Docks &amp; Sidebars</title>').title, 'Docks & Sidebars');
  assert.equal(contentRun([{ level: 'warn', text: '“lumabar alternative” (14 impressions) — never says “lumabar”.', query: 'lumabar alternative' }]).headline, '1 problem · “lumabar alternative” isn’t in the title or headings');
});
