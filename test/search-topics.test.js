import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicReport, pathOf, demoTopics } from '../server/search-topics.mjs';
import { parseSiteConfig } from '../server/site-config.mjs';

const { config } = parseSiteConfig(`
search:
  brand: [acme]
  competitors: [rival]
  topics:
    - name: Launchers
      page: /vs/rival
      match: launcher|rival
      targets: [rival alternative, best launcher, launcher for linux]
`);

test('pathOf keeps only the path', () => {
  assert.equal(pathOf('https://www.x.com/blog/a/?q=1'), '/blog/a');
  assert.equal(pathOf('https://x.com/'), '/');
});

test('topicReport: totals, the pages Google ranks, targets and what is in the way', () => {
  const rows = [
    { query: 'rival alternative', page: 'https://x.com/vs/rival', clicks: 10, impressions: 200, position: 5 },
    { query: 'best launcher', page: 'https://x.com/blog/launchers', clicks: 2, impressions: 60, position: 9 },
    { query: 'best launcher', page: 'https://x.com/vs/rival/', clicks: 1, impressions: 40, position: 12 },
    { query: 'acme launcher', page: 'https://x.com/', clicks: 30, impressions: 50, position: 1 }, // Brand wins
    { query: 'rival pricing', page: 'https://x.com/vs/rival', clicks: 0, impressions: 5, position: 30 },
  ];
  const [t] = topicReport({ search: config.search, rows, prevRows: [{ query: 'rival alternative', clicks: 20, impressions: 210 }, { query: 'acme launcher', clicks: 9, impressions: 9 }] }).topics;
  assert.equal(t.impressions, 305);
  assert.equal(t.clicks, 13);
  assert.deepEqual(t.previous, { clicks: 20, impressions: 210 });
  assert.equal(t.pages[0].path, '/vs/rival');
  assert.ok(Math.abs(t.ownShare - 245 / 305) < 1e-9);
  const [alt, best, linux] = t.targets;
  assert.deepEqual([alt.status, alt.wrongPage, alt.potential], ['page1', false, 12]); // 200 × 11% − 10
  assert.deepEqual([best.status, best.page, best.wrongPage], ['page1', '/blog/launchers', true]);
  assert.equal(linux.status, 'unseen');
  assert.deepEqual(t.issues.wrongPage.map((w) => w.query), ['best launcher']);
  assert.deepEqual(t.issues.split, [{ query: 'best launcher', impressions: 100, pages: ['/blog/launchers', '/vs/rival'] }]);
  assert.deepEqual(t.issues.unseen, ['launcher for linux']);
});

test('no topics, no report; the demo file’s topics have demo data', () => {
  assert.deepEqual(topicReport({ search: { brand: ['acme'] }, rows: [] }), { topics: [] });
  const demo = parseSiteConfig(`search:
  topics:
    - { name: Engagement, page: /blog/how-to-measure-product-engagement, match: engagement, targets: [engagement rate ga4] }`).config.search;
  const [t] = demoTopics({ site: { host: 'example.com' }, rangeKey: '28d', search: demo }).topics;
  assert.ok(t.impressions > 0);
  assert.equal(t.targets[0].status, 'page1');
});
