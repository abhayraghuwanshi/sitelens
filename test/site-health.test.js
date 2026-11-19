import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleState, bingState, pageIndex, createSiteHealth } from '../server/site-health.mjs';

test('googleState reads URL Inspection into shown / needs a fix / not shown / hidden', () => {
  assert.deepEqual(googleState({ indexed: true, coverage: 'Submitted and indexed' }).state.slice(0, 2), ['ok', 'Shown']);
  const canon = googleState({ indexed: true, coverage: 'Submitted and indexed', userCanonical: 'https://a.com/x', googleCanonical: 'https://a.com/x/' });
  assert.equal(canon.kind, 'canon');
  assert.equal(googleState({ indexed: false, coverage: 'Crawled - currently not indexed' }).kind, 'crawled');
  assert.equal(googleState({ indexed: false, coverage: 'Discovered - currently not indexed' }).kind, 'notyet');
  assert.equal(googleState({ indexed: false, coverage: 'Page with redirect' }).kind, 'redirect');
  assert.equal(googleState({ indexed: false, coverage: "Excluded by 'noindex' tag" }).kind, 'noindex');
  assert.deepEqual(googleState({ note: 'Pick a Search Console property' }).state[0], 'unknown');
});

test('bingState reads URL info', () => {
  assert.equal(bingState({ known: false }).kind, 'notyet');
  assert.equal(bingState({ known: true, httpStatus: 301, lastCrawled: '2026-11-01' }).kind, 'redirect');
  assert.equal(bingState({ known: true, httpStatus: 200, lastCrawled: '2026-11-01' }).state[1], 'Shown');
  assert.equal(bingState({ known: true, httpStatus: 200, lastCrawled: null }).kind, 'notyet');
});

test('pageIndex picks the problem worth fixing first and keeps both addresses', () => {
  const p = pageIndex({ path: '/x', title: 'X', visits: 40 }, {
    google: { indexed: true, coverage: 'Submitted and indexed', userCanonical: 'https://a.com/x', googleCanonical: 'https://a.com/x/' },
    bing: { known: false },
  });
  assert.equal(p.kind, 'canon');
  assert.equal(p.title, 'X'); // the page's own title survives
  assert.equal(p.problem, 'Google picked a different address');
  assert.equal(p.theirs, 'https://a.com/x/');
  assert.ok(p.fix);
  assert.equal(pageIndex({ path: '/y' }, { google: { indexed: true, coverage: 'ok' }, bing: { known: true, httpStatus: 200, lastCrawled: 'd' } }).kind, null);
});

test('createSiteHealth checks the busiest pages once and caches the answer', async () => {
  const rows = [{ path: '/a', visits: 5, inSitemap: true }, { path: '/b', visits: 50, inSitemap: true }, { path: '/c', visits: 0, inSitemap: false }];
  let calls = 0;
  const health = createSiteHealth({
    pageReview: { review: async () => ({ rows }) },
    hub: { indexStatus: async (s, { path }) => { calls++; return { google: { indexed: path !== '/a', coverage: path === '/a' ? 'Crawled - currently not indexed' : 'Submitted and indexed' }, bing: { known: true, httpStatus: 200, lastCrawled: 'd' } }; } },
    vitals: { psiUrl: async (url, strategy) => ({ strategy, lcp: 2000, error: null }) },
  });
  const site = { id: 's', host: 'a.com' };
  const first = await health.index(site);
  assert.deepEqual(first.pages.map((p) => p.path), ['/b', '/a']);
  assert.equal(first.pages[1].kind, 'crawled');
  await health.index(site);
  assert.equal(calls, 2);
  const speed = await health.speed(site);
  assert.equal(speed.pages[0].phone.strategy, 'mobile');
});
