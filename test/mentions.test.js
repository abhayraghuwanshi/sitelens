import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deriveTerms, containsTerm, parseHnHits, parseRedditListing, parsePhPost, dailyCounts, normalizeMentionSettings, createMentions,
} from '../server/mentions.mjs';
import { createAlerts } from '../server/alerts.mjs';

function fakeStore(state) {
  return {
    get: async () => state,
    update: async (fn) => fn(state),
    sites: async () => [{ id: 'demo', demo: true, host: 'example.com' }, ...state.sites],
  };
}

test('deriveTerms: hosts, products, repos, extensions and keywords; demo and short terms skipped', () => {
  const terms = deriveTerms({
    sites: [{ id: 'demo', demo: true, host: 'example.com' }, { id: 's1', host: 'www.Cool-Desk.com' }],
    products: [{ label: 'Cooldesk', siteId: 's1', repos: ['me/cooldesk'], extensionIds: ['abc'] }],
    extensions: [{ id: 'ioggffobciopdddacpclplkeodllhjko' }],
    keywords: [{ term: 'new tab by cooldesk', scope: 'ext:ioggffobciopdddacpclplkeodllhjko' }, { term: 'cool-desk.com' }],
  });
  const by = Object.fromEntries(terms.map((t) => [t.term, t]));
  assert.deepEqual(Object.keys(by).sort(), ['cool-desk.com', 'cooldesk', 'github.com/me/cooldesk', 'ioggffobciopdddacpclplkeodllhjko', 'new tab by cooldesk']);
  assert.deepEqual(by.cooldesk.scopes, ['site:s1', 'repo:me/cooldesk', 'ext:abc']);
  assert.deepEqual(by['cool-desk.com'].origins, ['site', 'keyword']);
});

test('parseHnHits keeps only literal matches (Algolia is fuzzy)', () => {
  const json = {
    hits: [
      { objectID: '1', _tags: ['story'], title: 'Show HN: Cooldesk, a new tab', url: 'https://cool-desk.com', points: 42, num_comments: 7, author: 'a', created_at_i: 1_790_000_000 },
      { objectID: '2', _tags: ['comment'], comment_text: 'Coindesk reported…', story_title: 'Crypto', author: 'b', created_at_i: 1_790_000_100 },
      { objectID: '3', _tags: ['comment'], comment_text: 'I use <i>CoolDesk</i> daily', story_title: 'Ask HN: new tab?', author: 'c', created_at_i: 1_790_000_200 },
    ],
  };
  const items = parseHnHits(json, 'cooldesk');
  assert.deepEqual(items.map((m) => [m.id, m.kind, m.points]), [['hn:1', 'story', 42], ['hn:3', 'comment', 0]]);
  assert.equal(items[1].title, 'Comment on “Ask HN: new tab?”');
  assert.equal(items[0].permalink, 'https://news.ycombinator.com/item?id=1');
  assert.ok(containsTerm('cool-desk.com', 'see https://cool-desk.com/x'));
});

test('parseRedditListing and parsePhPost map to mentions', () => {
  const reddit = parseRedditListing({ data: { children: [
    { data: { id: 'x1', name: 't3_x1', title: 'Cooldesk is neat', selftext: '', url: 'https://cool-desk.com', permalink: '/r/chrome/comments/x1/', subreddit: 'chrome', score: 12, num_comments: 3, created_utc: 1_790_000_000, author: 'u' } },
    { data: { id: 'x2', title: 'unrelated', selftext: '', url: '', permalink: '/r/a/x2', created_utc: 1_790_000_000 } },
  ] } }, 'cooldesk');
  assert.equal(reddit.length, 1);
  assert.equal(reddit[0].community, 'r/chrome');
  assert.equal(reddit[0].createdAt, 1_790_000_000_000);

  const ph = parsePhPost({ data: { post: { id: '9', name: 'Cooldesk', tagline: 'Tabs', url: 'https://www.producthunt.com/posts/cooldesk', votesCount: 120, commentsCount: 1,
    createdAt: '2026-05-01T07:00:00Z', comments: { edges: [{ node: { id: '5', body: 'Love it', createdAt: '2026-05-01T09:00:00Z', user: { username: 'pat' } } }] } } } });
  assert.deepEqual(ph.map((m) => [m.id, m.kind, m.points]), [['ph:9', 'launch', 120], ['ph:c5', 'comment', 0]]);
});

test('dailyCounts and settings validation', () => {
  const rows = dailyCounts([{ source: 'hn', createdAt: Date.parse('2026-10-02T10:00:00Z') }, { source: 'reddit', createdAt: Date.parse('2026-10-02T23:00:00Z') }], ['2026-10-01', '2026-10-02']);
  assert.deepEqual(rows[1], { date: '2026-10-02', hn: 1, reddit: 1, ph: 0 });
  assert.deepEqual(normalizeMentionSettings({ phSlugs: ['https://www.producthunt.com/posts/Cool-Desk?ref=x'] }).phSlugs, ['cool-desk']);
  assert.throws(() => normalizeMentionSettings({ keywords: ['abc'] }), /too short/);
  assert.throws(() => normalizeMentionSettings({ keywords: [{ term: 'cooldesk', scope: 'bogus' }] }), /Unknown scope/);
});

test('mentions: first sync backfills quietly, later finds alert once and annotate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mentions-'));
  let clock = Date.parse('2026-10-30T12:00:00Z');
  let hits = [{ objectID: '1', _tags: ['story'], title: 'Cooldesk launch', url: 'https://cool-desk.com', points: 5, created_at_i: Math.floor(clock / 1000) - 86_400 * 30 }];
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    assert.match(String(url), /typoTolerance=false/);
    return Response.json({ hits });
  };
  const state = { sites: [{ id: 's1', host: 'cool-desk.com' }], products: [{ id: 'p', label: 'Cooldesk', siteId: 's1', repos: [], extensionIds: [] }], extensions: [], sources: {}, alerts: [] };
  const store = fakeStore(state);
  const mentions = createMentions({ dbPath: join(dir, 'm.db'), store, env: {}, fetchImpl, now: () => clock });
  const alerts = createAlerts({ store, engines: {}, github: { hasDb: () => false }, extensions: { list: async () => [] }, auth: {}, mentions, now: () => clock,
    notify: { desktop: async () => ({ ok: true }), webhook: async () => ({ ok: true }) }, log: { error() {}, warn() {} } });
  try {
    const first = await mentions.sync();
    assert.equal(first.added.hn, 1);
    assert.equal(first.errors.reddit, undefined, 'Reddit is skipped without credentials');
    await alerts.run({ deliverNew: false });
    assert.equal(state.alerts.length, 0, 'backfill never alerts');

    clock += 3_600_000;
    hits = [...hits, { objectID: '2', _tags: ['story'], title: 'Why I switched to Cooldesk', points: 30, num_comments: 4, created_at_i: Math.floor(clock / 1000) - 600 }];
    const second = await mentions.sync();
    assert.equal(second.added.hn, 1);
    assert.match(calls.at(-1), /created_at_i%3E/);
    await alerts.run({ deliverNew: false });
    assert.equal(state.alerts.length, 1);
    assert.match(state.alerts[0].title, /Mentioned on Hacker News: Why I switched to Cooldesk/);
    await alerts.run({ deliverNew: false });
    assert.equal(state.alerts.length, 1, 'no duplicate alert');

    const notes = await mentions.annotations({ from: '2026-09-01', to: '2026-10-31', scopes: ['site:s1'] });
    assert.equal(notes.length, 2);
    assert.equal(notes[0].kind, 'mention');
    assert.equal(notes[0].scope, 'site:s1');
    assert.equal((await mentions.annotations({ from: '2026-09-01', to: '2026-10-31', scopes: ['repo:other/x'] })).length, 0);

    const view = await mentions.overview({ rangeKey: '90d' });
    assert.equal(view.totals.hn, 2);
    assert.equal(view.sources.reddit.ready, false);
  } finally {
    mentions.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('mentions: Reddit uses app-only OAuth and site: search for hosts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mentions-'));
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    seen.push({ u, auth: init.headers?.Authorization, ua: init.headers?.['User-Agent'] });
    if (u.includes('hn.algolia')) return Response.json({ hits: [] });
    if (u.includes('access_token')) return Response.json({ access_token: 'tok', expires_in: 3600 });
    return Response.json({ data: { children: [] } });
  };
  const store = fakeStore({ sites: [{ id: 's1', host: 'cool-desk.com' }], sources: { redditClientId: 'id', redditClientSecret: 'sec' } });
  const mentions = createMentions({ dbPath: join(dir, 'm.db'), store, env: {}, fetchImpl });
  try {
    const r = await mentions.sync();
    assert.deepEqual(r.errors, {});
    const token = seen.find((s) => s.u.includes('access_token'));
    assert.equal(token.auth, `Basic ${Buffer.from('id:sec').toString('base64')}`);
    const search = seen.find((s) => s.u.startsWith('https://oauth.reddit.com/search'));
    assert.equal(search.auth, 'Bearer tok');
    assert.equal(new URL(search.u).searchParams.get('q'), 'site:cool-desk.com');
    assert.match(search.ua, /sitelens-studio/);
  } finally {
    mentions.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
