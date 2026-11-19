import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSpend, summarizeSpend, summarizeEarnings, isoOf, createAdSpend } from '../server/campaigns.mjs';
import { createStore } from '../server/store.mjs';

test('isoOf: GA4 relative dates to ISO', () => {
  assert.equal(isoOf('today', '2026-11-19'), '2026-11-19');
  assert.equal(isoOf('yesterday', '2026-11-19'), '2026-11-18');
  assert.equal(isoOf('27daysAgo', '2026-11-19'), '2026-10-23');
  assert.equal(isoOf('2026-01-02', '2026-11-19'), '2026-01-02');
});

test('normalizeSpend: needs a name, dates in order, an amount, and a utm_campaign for Other', () => {
  const ok = normalizeSpend({ platform: 'reddit', name: ' Launch ', start: '2026-11-01', end: '2026-11-10', amount: '120.456' });
  assert.deepEqual(ok, { platform: 'reddit', name: 'Launch', campaign: '', start: '2026-11-01', end: '2026-11-10', amount: 120.46, note: '' });
  assert.equal(normalizeSpend({ platform: 'nope', name: 'x', campaign: 'c', start: '2026-11-01', amount: 5 }).platform, 'other');
  assert.throws(() => normalizeSpend({ platform: 'reddit', name: '', start: '2026-11-01', amount: 5 }), /name/);
  assert.throws(() => normalizeSpend({ platform: 'reddit', name: 'x', start: '2026-11-05', end: '2026-11-01', amount: 5 }), /before the start/);
  assert.throws(() => normalizeSpend({ platform: 'reddit', name: 'x', start: '2026-11-01', amount: 0 }), /spent/);
  assert.throws(() => normalizeSpend({ platform: 'other', name: 'x', start: '2026-11-01', amount: 5 }), /utm_campaign/);
});

test('summarizeSpend: pro-rated to the period, matched by campaign or by paid visits from the platform', () => {
  const rows = [
    { sessionCampaignName: '(organic)', sessionSource: 'reddit', sessionMedium: 'cpc', sessions: 40, keyEvents: 2 },
    { sessionCampaignName: '(referral)', sessionSource: 'reddit', sessionMedium: 'social', sessions: 99, keyEvents: 9 },
    { sessionCampaignName: 'Launch-Week', sessionSource: 'linkedin', sessionMedium: 'paid_social', sessions: 10, keyEvents: 1 },
  ];
  const entries = [
    normalizeSpend({ platform: 'reddit', name: 'R', start: '2026-11-01', end: '2026-11-30', amount: 300 }),
    normalizeSpend({ platform: 'linkedin', name: 'L', campaign: 'launch-week', start: '2026-11-10', end: '2026-11-10', amount: 50 }),
    normalizeSpend({ platform: 'x', name: 'Old', start: '2026-01-01', end: '2026-01-31', amount: 99 }),
  ];
  const s = summarizeSpend(entries, rows, { start: '2026-10-23', end: '2026-11-19' });
  const by = Object.fromEntries(s.entries.map((e) => [e.name, e]));
  assert.equal(by.R.spent, 190); // 19 of 30 days
  assert.equal(by.R.sessions, 40); // paid only, not the organic social visits
  assert.equal(by.R.costPerKeyEvent, 95);
  assert.equal(by.L.spent, 50);
  assert.equal(by.L.sessions, 10);
  assert.equal(by.L.matchedBy, 'campaign');
  assert.equal(by.Old.inPeriod, false);
  assert.equal(by.Old.spent, 0);
  assert.equal(s.total, 240);
});

test('summarizeEarnings: totals and sources that earned', () => {
  const e = summarizeEarnings([
    { sessionSource: 'google', sessionMedium: 'organic', totalAdRevenue: 12.5, publisherAdImpressions: 900, publisherAdClicks: 4 },
    { sessionSource: 'reddit', sessionMedium: 'social', totalAdRevenue: 0, publisherAdImpressions: 30, publisherAdClicks: 0 },
  ], 10);
  assert.equal(e.total, 12.5);
  assert.equal(e.previous, 10);
  assert.equal(e.impressions, 930);
  assert.deepEqual(e.bySource, [{ source: 'google', medium: 'organic', revenue: 12.5 }]);
});

test('ad spend entries: add, change, remove, per site; each change clears the cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'adspend-'));
  try {
    const store = createStore(dir);
    const cleared = [];
    const ads = createAdSpend({ store, onChange: (site) => cleared.push(site.id) });
    const site = { id: 's1' };
    const a = await ads.save(site, { platform: 'meta', name: 'Spring', start: '2026-11-01', end: '2026-11-07', amount: 70 });
    assert.match(a.id, /^ad_/);
    const b = await ads.save(site, { id: a.id, platform: 'meta', name: 'Spring sale', start: '2026-11-01', end: '2026-11-07', amount: 80 });
    assert.equal(b.id, a.id);
    assert.deepEqual((await ads.list(site)).map((e) => [e.name, e.amount]), [['Spring sale', 80]]);
    assert.deepEqual(await ads.list({ id: 'other' }), []);
    await ads.remove(site, a.id);
    assert.deepEqual(await ads.list(site), []);
    assert.deepEqual(cleared, ['s1', 's1', 's1']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('spendByDay: an entry spread evenly over its days, clipped to the window', async () => {
  const { spendByDay } = await import('../server/campaigns.mjs');
  const m = spendByDay([{ amount: 30, start: '2026-11-01', end: '2026-11-03' }, { amount: 7, start: '2026-11-03', end: '2026-11-03' }], '2026-11-02', '2026-11-10');
  assert.deepEqual([...m], [['2026-11-02', 10], ['2026-11-03', 17]]);
});
