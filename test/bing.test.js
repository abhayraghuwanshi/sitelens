import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { parseBingDate, bingDay, matchSiteUrl, aggregateQueries, bingError, createBing } from '../server/bing.mjs';
import { bingItem, crawlItem } from '../server/journey.mjs';

const D = (iso) => `/Date(${Date.parse(`${iso}T07:00:00Z`)}-0700)/`;

test('Bing dates, site matching and errors', () => {
  assert.equal(parseBingDate('/Date(1698710400000)/'), 1698710400000);
  assert.equal(parseBingDate('/Date(1698710400000-0700)/'), 1698710400000);
  assert.equal(bingDay(D('2026-10-20')), '2026-10-20');
  const sites = [{ url: 'http://cool-desk.com/', verified: true }, { url: 'https://www.cool-desk.com/', verified: true }, { url: 'https://other.com/', verified: true }];
  assert.equal(matchSiteUrl('cool-desk.com', sites), 'https://www.cool-desk.com/');
  assert.equal(matchSiteUrl('cool-desk.com', [{ url: 'https://cool-desk.com/', verified: false }, { url: 'http://cool-desk.com/', verified: true }]), 'http://cool-desk.com/');
  assert.equal(matchSiteUrl('nope.dev', sites), '');
  assert.equal(bingError({ ErrorCode: 3, Message: 'ERROR!!! InvalidApiKey' }, 400).kind, 'bing-key');
  assert.equal(bingError({ ErrorCode: 14, Message: 'ERROR!!! NotAuthorized' }, 400).kind, 'bing-site');
});

test('aggregateQueries sums periods in range with impression-weighted position', () => {
  const rows = [
    { Query: 'cooldesk', Clicks: 4, Impressions: 40, AvgImpressionPosition: 2, Date: D('2026-10-10') },
    { Query: 'cooldesk', Clicks: 6, Impressions: 60, AvgImpressionPosition: 1, Date: D('2026-10-17') },
    { Query: 'new tab', Clicks: 1, Impressions: 100, AvgImpressionPosition: 9, Date: D('2026-10-17') },
    { Query: 'old', Clicks: 50, Impressions: 50, AvgImpressionPosition: 1, Date: D('2026-08-01') },
  ];
  const out = aggregateQueries(rows, '2026-10-01', '2026-10-30');
  assert.deepEqual(out.map((q) => [q.query, q.clicks, q.impressions]), [['cooldesk', 10, 100], ['new tab', 1, 100]]);
  assert.equal(out[0].position, 1.4);
  assert.equal(out[0].ctr, 0.1);
});

test('journey lines for Bing clicks and crawl errors', () => {
  assert.equal(bingItem({ clicks: 120, previous: 100, impressions: 3000 }, 28).text, '120 clicks · 3,000 impressions (+20% vs previous 28d)');
  assert.equal(crawlItem({ crawlErrors: 30, crawlErrorsBefore: 5 }).status, 'warn');
  assert.equal(crawlItem({ crawlErrors: 6, crawlErrorsBefore: 1 }).status, 'good');
  assert.equal(crawlItem(null), null);
});

test('bing service: verifies the key, keeps daily history, submits URLs on the site only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bing-'));
  try {
    const store = createStore(dir);
    await store.addSite?.({ label: 'cooldesk', host: 'cool-desk.com' });
    const NOW = Date.parse('2026-10-30T12:00:00Z');
    const days = Array.from({ length: 60 }, (_, i) => new Date(NOW - (i + 2) * 86_400_000).toISOString().slice(0, 10));
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      const u = new URL(url);
      const method = u.pathname.split('/').pop();
      calls.push([method, u.searchParams.get('apikey'), init.body ? JSON.parse(init.body) : null]);
      if (u.searchParams.get('apikey') === 'BADKEY0000000000') return new Response(JSON.stringify({ ErrorCode: 3, Message: 'ERROR!!! InvalidApiKey' }), { status: 400 });
      const d = {
        GetUserSites: [{ Url: 'https://cool-desk.com/', IsVerified: true }],
        GetRankAndTrafficStats: days.map((day, i) => ({ Date: D(day), Clicks: i < 28 ? 3 : 1, Impressions: 50 })),
        GetCrawlStats: [{ Date: D(days[0]), CrawledPages: 40, CrawlErrors: 2, InIndex: 31, Code4xx: 2, Code5xx: 0 }],
        GetQueryStats: [{ Query: 'cooldesk', Clicks: 10, Impressions: 100, AvgImpressionPosition: 1.5, Date: D(days[3]) }],
        GetPageStats: [{ Query: 'https://cool-desk.com/', Clicks: 9, Impressions: 80, AvgImpressionPosition: 1.2, Date: D(days[3]) }],
        GetUrlSubmissionQuota: { DailyQuota: 99, MonthlyQuota: 2799 },
        SubmitUrlBatch: null,
      }[method];
      return new Response(JSON.stringify({ d }));
    };
    const bing = createBing({ dbPath: join(dir, 'bing.db'), store, env: {}, fetchImpl, now: () => NOW, log: { error() {} } });
    const site = { id: 's1', host: 'cool-desk.com', label: 'cooldesk' };

    await assert.rejects(() => bing.overview(site, '28d'), (e) => e.kind === 'needs-bing');
    await assert.rejects(() => bing.saveKey('BADKEY0000000000'), (e) => e.kind === 'bing-key');
    await bing.saveKey('GOODKEY000000000');
    const o = await bing.overview(site, '28d');
    assert.equal(o.siteUrl, 'https://cool-desk.com/');
    assert.equal(o.range.end, days[0]);
    assert.equal(o.current.clicks, 84);
    assert.equal(o.previous.clicks, 28);
    assert.equal(o.queries[0].query, 'cooldesk');
    assert.equal(o.pages[0].page, 'https://cool-desk.com/');
    assert.equal(o.crawl.latest.inIndex, 31);
    assert.deepEqual(o.quota, { daily: 99, monthly: 2799 });

    const r = await bing.submit(site, ['https://cool-desk.com/new', 'https://cool-desk.com/new']);
    assert.equal(r.submitted, 1);
    assert.deepEqual(calls.find((c) => c[0] === 'SubmitUrlBatch')[2], { siteUrl: 'https://cool-desk.com/', urlList: ['https://cool-desk.com/new'] });
    await assert.rejects(() => bing.submit(site, ['https://evil.com/x']), /isn’t a full URL on cool-desk\.com/);
    assert.equal((await bing.summary({ ...site, demo: true }, '28d')), null);
    await assert.rejects(() => bing.overview({ id: 's2', host: 'other.dev' }, '28d'), (e) => e.kind === 'bing-site');
    bing.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
