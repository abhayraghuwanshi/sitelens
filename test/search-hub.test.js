import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRows, createSearchHub } from '../server/search-hub.mjs';
import { TOOLS } from '../server/mcp.mjs';

test('mergeRows: Google and Bing side by side per search or page, URL variants added up, most seen first', () => {
  const rows = mergeRows(
    [{ query: 'Raycast Windows', clicks: 4, impressions: 900, ctr: 0.0044, position: 8.4 }, { query: 'only google', clicks: 1, impressions: 10, ctr: 0.1, position: 3 }],
    [{ query: 'raycast windows', clicks: 2, impressions: 300, ctr: 0.0067, position: 5 }, { query: 'only bing', clicks: 0, impressions: 50, ctr: 0, position: 12 }],
    (r) => r.query.toLowerCase(),
  );
  assert.deepEqual(rows.map((r) => [r.key, r.impressions, Boolean(r.google), Boolean(r.bing)]), [
    ['raycast windows', 1200, true, true], ['only bing', 50, false, true], ['only google', 10, true, false],
  ]);
  const pages = mergeRows([], [{ page: 'https://a.com/x', clicks: 1, impressions: 10, position: 2 }, { page: 'https://www.a.com/x', clicks: 3, impressions: 30, position: 6 }], (r) => new URL(r.page).pathname);
  assert.deepEqual(pages[0].bing, { clicks: 4, impressions: 40, ctr: 0.1, position: 5 });
});

test('index status: Google URL Inspection and Bing URL info for one page, only on the site', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => (sent.push(JSON.parse(init.body)), { ok: true, json: async () => ({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-11-01T08:00:00Z' } } }) });
  const hub = createSearchHub({ engines: {}, bing: { urlInfo: async () => ({ known: true, lastCrawled: '2026-10-30' }) }, auth: { token: async () => 't' }, fetchImpl });
  const site = { id: 'a', host: 'cool-desk.com', searchSite: 'sc-domain:cool-desk.com' };
  const r = await hub.indexStatus(site, { path: '/blog/x' });
  assert.equal(r.url, 'https://cool-desk.com/blog/x');
  assert.deepEqual([r.google.indexed, r.google.coverage, r.google.lastCrawled, r.bing.lastCrawled], [true, 'Submitted and indexed', '2026-11-01', '2026-10-30']);
  assert.deepEqual(sent[0], { inspectionUrl: 'https://cool-desk.com/blog/x', siteUrl: 'sc-domain:cool-desk.com', languageCode: 'en-US' });
  await assert.rejects(hub.indexStatus(site, { url: 'https://evil.com/x' }), /isn’t a URL on cool-desk.com/);
});

test('search_rankings shapes both engines and filters to one article', () => {
  const tool = TOOLS.find((t) => t.name === 'search_rankings');
  const side = (clicks, impressions, ctr, position) => ({ clicks, impressions, ctr, position });
  const d = {
    google: { current: side(60, 4000, 0.015, 9.21), previous: side(70, 4100, 0.017, 9), range: { start: '2026-10-08', end: '2026-11-04' } },
    bing: { error: { message: 'Bing Webmaster Tools isn’t connected.' } },
    opportunities: [{ query: 'raycast windows', type: 'striking', impressions: 900, ctr: 0.0044, position: 8.4, potential: 60 }],
    queries: [{ key: 'raycast windows', google: side(4, 900, 0.0044, 8.44), bing: null }, { key: 'other', google: side(1, 5, 0.2, 2), bing: null }],
    pages: [{ key: '/blog/raycast-alternatives-windows', google: side(4, 900, 0.0044, 8.4), bing: null }, { key: '/', google: side(50, 3000, 0.016, 3), bing: null }],
    queryPages: [{ query: 'raycast windows', path: '/blog/raycast-alternatives-windows' }],
  };
  const out = tool.shape(d, { page: '/blog/raycast' });
  assert.deepEqual(out.google.now, { clicks: 60, impressions: 4000, ctr: 1.5, position: 9.2 });
  assert.deepEqual(out.bing, { error: 'Bing Webmaster Tools isn’t connected.' });
  assert.deepEqual(out.searches, [{ search: 'raycast windows', google: { clicks: 4, impressions: 900, ctr: 0.4, position: 8.4 }, bing: null, landsOn: ['/blog/raycast-alternatives-windows'] }]);
  assert.deepEqual(out.pages.map((p) => p.page), ['/blog/raycast-alternatives-windows']);
});
