import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrlInfo } from '../server/bing.mjs';
import { bingState } from '../server/site-health.mjs';

test('a URL Bing has never seen comes back with placeholder dates: it is not known, not "Shown"', () => {
  const r = parseUrlInfo({ HttpStatus: 0, DiscoveryDate: '/Date(-62135596800000)/', LastCrawledDate: '/Date(-62135596800000)/', DocumentSize: 0, AnchorCount: 0 });
  assert.equal(r.known, false);
  assert.equal(r.lastCrawled, null);
  assert.equal(bingState(r).state[1], 'Not crawled');
});

test('a crawled URL keeps its real dates', () => {
  const r = parseUrlInfo({ HttpStatus: 200, DiscoveryDate: '/Date(1760313600000)/', LastCrawledDate: '/Date(1763510400000)/', DocumentSize: 51234 });
  assert.equal(r.known, true);
  assert.equal(r.discovered, '2025-10-13');
  assert.ok(r.lastCrawled > '2025-11-01');
  assert.equal(bingState(r).state[1], 'Shown');
});

test('withWeeks: Bing page searches get 13 weekly buckets and a 4-week change', async () => {
  const { withWeeks } = await import('../server/bing.mjs');
  const ms = (d) => `/Date(${Date.parse(`${d}T00:00:00Z`)})/`;
  const rows = [{ Query: 'a', Date: ms('2026-11-15'), Impressions: 4 }, { Query: 'a', Date: ms('2026-10-10'), Impressions: 2 }, { Query: 'a', Date: ms('2025-01-01'), Impressions: 9 }];
  const [q] = withWeeks([{ query: 'a', impressions: 6 }], rows, '2026-11-18');
  assert.equal(q.weeks.length, 13);
  assert.equal(q.weeks[12].impressions, 4);
  assert.equal(q.weeks.reduce((n, w) => n + w.impressions, 0), 6);
  assert.equal(Math.round(q.change * 100), 100);
});
