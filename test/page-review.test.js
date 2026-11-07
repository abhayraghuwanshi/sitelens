import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { suggest, buildReview, createPageReview, siteRateOf } from '../server/page-review.mjs';

const today = '2026-11-07';
const page = (path, patch = {}) => ({ path, inSitemap: true, published: '2026-03-01', sessions: 0, engagementRate: 0, aiSessions: 0, search: null, ...patch });
const s = (row, ctx = {}) => suggest(row, { days: 90, siteSessions: 3000, today, ...ctx }).suggestion;

test('suggest: keep what earns, fix what’s shown but skipped, cut what nobody and nothing finds', () => {
  assert.equal(s(page('/privacy')), 'needed');
  assert.equal(s(page('/')), 'needed');
  assert.equal(s(page('/blog/launch', { published: '2026-10-20' })), 'new');
  // Recently edited, but already earning: judged on what it earns.
  assert.equal(s(page('/blog/raycast', { published: '2026-10-28', sessions: 334, engagementRate: 0.52, search: { clicks: 226, impressions: 14277, position: 6.1 } })), 'keep');
  assert.equal(s(page('/blog/hit', { sessions: 400, engagementRate: 0.6, search: { clicks: 200, impressions: 5000, position: 4 } })), 'keep');
  assert.equal(s(page('/blog/bounce', { sessions: 400, engagementRate: 0.2 })), 'improve-content');
  assert.equal(s(page('/blog/skipped', { sessions: 40, engagementRate: 0.6, search: { clicks: 4, impressions: 900, position: 8 } })), 'improve-title');
  assert.equal(s(page('/blog/deep', { sessions: 5, search: { clicks: 0, impressions: 400, position: 34 } })), 'improve-content');
  assert.equal(s(page('/blog/dead', { published: '2025-06-01' })), 'cut');
  assert.equal(s(page('/blog/orphan', { inSitemap: false })), 'not-found');
  assert.equal(s(page('/blog/word-of-mouth', { sessions: 25, search: { clicks: 0, impressions: 5, position: 50 } })), 'not-found');
  assert.equal(s(page('/blog/page-two', { sessions: 300, engagementRate: 0.6, search: { clicks: 58, impressions: 8357, position: 14.8 } })), 'improve-content');
  // AI sending readers is enough to keep a page.
  assert.equal(s(page('/blog/cited', { sessions: 8, aiSessions: 6, engagementRate: 0.7 })), 'keep');
  assert.match(suggest(page('/blog/dead', { published: '2025-06-01' }), { today }).reason, /Nobody comes.*0 visits, 0 search impressions/);
});

test('buildReview: Bing joined by path, worst first, counts and decisions', () => {
  const rows = [page('/blog/hit', { sessions: 400, engagementRate: 0.6 }), page('/blog/dead', { published: '2025-01-01' }), page('/blog/bing-only', { sessions: 1 })];
  const r = buildReview({
    rows, today, siteSessions: 3000,
    bingPages: [{ page: 'https://www.a.com/blog/bing-only/', clicks: 2, impressions: 150, position: 6 }],
    decisions: { '/blog/dead': { decision: 'remove', at: 1 } },
  });
  assert.deepEqual(r.rows.map((x) => [x.path, x.suggestion]), [['/blog/dead', 'cut'], ['/blog/bing-only', 'improve-title'], ['/blog/hit', 'keep']]);
  assert.deepEqual(r.rows[1].bing, { clicks: 2, impressions: 150, position: 6 });
  assert.deepEqual(r.counts, { cut: 1, 'improve-title': 1, keep: 1 });
  assert.equal(r.decided, 1);
  assert.equal(r.rows[0].decision.decision, 'remove');
});

test('decide: kept per site and path, cleared with no decision', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-review-'));
  try {
    const store = createStore(dir);
    const review = createPageReview({ articles: {}, bing: {}, store });
    await review.decide({ id: 'a' }, { path: '/blog/old', decision: 'merge', mergeInto: '/blog/guide', note: 'Same topic' });
    assert.deepEqual(Object.keys((await store.get()).pageDecisions.a['/blog/old']).sort(), ['at', 'decision', 'mergeInto', 'note']);
    await assert.rejects(review.decide({ id: 'a' }, { path: '/x', decision: 'burn' }), /one of/);
    await assert.rejects(review.decide({ id: 'a' }, { path: 'x', decision: 'keep' }), /path/);
    await review.decide({ id: 'a' }, { path: '/blog/old', decision: '' });
    assert.deepEqual((await store.get()).pageDecisions.a, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('siteRateOf: outcome users over landing-page visitors, only with enough visitors', () => {
  assert.equal(siteRateOf([{ visitors: 300, goalUsers: 12 }, { visitors: 100, goalUsers: 8 }]), 0.05);
  assert.equal(siteRateOf([{ visitors: 20, goalUsers: 2 }]), null);
});

test('review: numbers follow the period, suggestions stay judged on 90 days', async () => {
  const row = (path, sessions, clicks, impressions) => ({ path, inSitemap: true, published: '2026-01-01', sessions, engagementRate: 0.5, aiSessions: 0, views: sessions, search: { clicks, impressions, position: 5, queries: [] } });
  const lists = {
    '90d': [row('/blog/hit', 400, 200, 5000), row('/blog/dead', 0, 0, 0)],
    today: [row('/blog/hit', 3, 0, 0)],
  };
  const articles = { list: async (site, key) => ({ rows: lists[key] || [], totals: {}, notes: {} }), titles: () => new Map() };
  const store = { get: async () => ({}) };
  const review = createPageReview({ articles, bing: { overview: async () => null }, store, today: () => '2026-11-07' });
  const site = { id: 's', demo: true };
  const today = await review.review(site, 'today');
  assert.deepEqual(today.period, { key: 'today', label: 'today so far', search: 'the last 7 days Search Console has' });
  const hit = today.rows.find((r) => r.path === '/blog/hit');
  assert.deepEqual([hit.suggestion, hit.visits], ['keep', 3]);
  assert.equal(today.rows.find((r) => r.path === '/blog/dead').suggestion, 'cut');
  assert.equal((await review.review(site, '90d')).rows.find((r) => r.path === '/blog/hit').visits, 400);
});
