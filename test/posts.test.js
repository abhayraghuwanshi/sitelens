import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import {
  parseRedditSubmitted, parseHnStories, parseDevto, parseMediumRss, parsePhMadePosts,
  platformOf, utmCampaign, matchProduct, attribute, normalizeAccounts, createPosts,
} from '../server/posts.mjs';

const T = (d) => Date.parse(`${d}T12:00:00Z`);

test('parsers turn each platform into one post shape', () => {
  const r = parseRedditSubmitted({ data: { children: [
    { kind: 't3', data: { id: 'a1', name: 't3_a1', title: 'I built Cooldesk', selftext: 'new tab', permalink: '/r/SideProject/comments/a1/x/', is_self: true, subreddit: 'SideProject', score: 42, num_comments: 7, created_utc: 1793000000 } },
    { kind: 't1', data: { id: 'c1' } },
  ] } }, 'me');
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].id, r[0].community, r[0].points, r[0].permalink], ['reddit:t3_a1', 'r/SideProject', 42, 'https://www.reddit.com/r/SideProject/comments/a1/x/']);
  const hn = parseHnStories({ hits: [{ objectID: '9', title: 'Show HN: Cooldesk', url: 'https://cool-desk.com', points: 12, num_comments: 3, created_at_i: 1793000000 }] }, 'me');
  assert.equal(hn[0].community, 'Show HN');
  assert.equal(hn[0].link, 'https://cool-desk.com');
  const dev = parseDevto([{ id: 5, title: 'Post', url: 'https://dev.to/me/post', description: 'd', tag_list: ['js'], public_reactions_count: 9, comments_count: 1, published_at: '2026-10-01T10:00:00Z' }], 'me');
  assert.deepEqual([dev[0].points, dev[0].community], [9, '#js']);
  const rss = `<rss><channel><item><title><![CDATA[My Medium post]]></title><link>https://medium.com/@me/my-post-abc?source=rss</link><guid isPermaLink="false">https://medium.com/p/abc</guid><category><![CDATA[startup]]></category><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate><content:encoded><![CDATA[<p>Hello cooldesk</p>]]></content:encoded></item></channel></rss>`;
  const med = parseMediumRss(rss, 'me');
  assert.deepEqual([med[0].id, med[0].title, med[0].permalink, med[0].community, med[0].points], ['medium:abc', 'My Medium post', 'https://medium.com/@me/my-post-abc', '#startup', null]);
  const ph = parsePhMadePosts({ data: { user: { madePosts: { edges: [{ node: { id: '1', name: 'Cooldesk', tagline: 'tabs', url: 'https://www.producthunt.com/posts/cooldesk', votesCount: 80, commentsCount: 9, createdAt: '2026-09-01T00:00:00Z' } }] } } } }, 'me');
  assert.equal(ph[0].title, 'Cooldesk — tabs');
});

test('platformOf, utmCampaign and normalizeAccounts', () => {
  assert.equal(platformOf('https://www.linkedin.com/posts/me_activity-1'), 'linkedin');
  assert.equal(platformOf('https://x.com/me/status/1'), 'x');
  assert.equal(platformOf('https://indiehackers.com/post/x'), 'other');
  assert.equal(platformOf('nope'), '');
  assert.equal(utmCampaign('', 'https://cool-desk.com/?utm_source=reddit&utm_campaign=launch-post'), 'launch-post');
  assert.deepEqual(normalizeAccounts([{ platform: 'reddit', handle: 'u/Me_1' }, { platform: 'reddit', handle: 'https://www.reddit.com/user/me_1/' }, { platform: 'medium', handle: '@writer' }]),
    [{ platform: 'reddit', handle: 'Me_1' }, { platform: 'medium', handle: 'writer' }]);
  assert.throws(() => normalizeAccounts([{ platform: 'linkedin', handle: 'me' }]), /by URL/);
  assert.throws(() => normalizeAccounts([{ platform: 'hn', handle: 'a b' }]), /username/);
});

test('matchProduct: assignment wins, else name, keywords, domains or repos in the text', () => {
  const products = [{ id: 'cooldesk', label: 'Cooldesk', siteId: 's1', repos: ['me/cooldesk-extension'], extensionIds: [], keywords: ['new tab dashboard'] }];
  const sites = [{ id: 's1', host: 'www.cool-desk.com' }];
  assert.equal(matchProduct({ title: 'Show HN', text: '', link: 'https://cool-desk.com' }, products, sites), 'cooldesk');
  assert.equal(matchProduct({ title: 'My new tab dashboard', text: '', link: '' }, products, sites), 'cooldesk');
  assert.equal(matchProduct({ title: 'Unrelated', text: '', link: '' }, products, sites), '');
  assert.equal(matchProduct({ title: 'Unrelated', product: 'other' }, products, sites), 'other');
});

test('attribute: utm is exact; timing splits a platform window between overlapping posts', () => {
  const byFamily = new Map([['2026-10-01|Reddit', 30], ['2026-10-02|Reddit', 12], ['2026-10-03|Reddit', 6], ['2026-10-02|Hacker News', 40]]);
  const campaigns = new Map([['launch', 25]]);
  const posts = [
    { id: 'a', platform: 'reddit', product: 'p', createdAt: T('2026-10-01'), link: '', permalink: '' },
    { id: 'b', platform: 'reddit', product: 'p', createdAt: T('2026-10-02'), link: '', permalink: '' },
    { id: 'c', platform: 'hn', product: 'p', createdAt: T('2026-10-02'), link: 'https://x.com/?utm_campaign=launch', permalink: '' },
    { id: 'd', platform: 'linkedin', product: 'p', createdAt: T('2026-10-02'), link: '', permalink: '' },
  ];
  const out = Object.fromEntries(attribute(posts, { byFamily, campaigns }).map((p) => [p.id, [p.sessions, p.attribution]]));
  // a: 30 alone + 12/2 + 6/2 = 39; b: 12/2 + 6/2 + 0 = 9.
  assert.deepEqual(out.a, [39, 'timing']);
  assert.deepEqual(out.b, [9, 'timing']);
  assert.deepEqual(out.c, [25, 'utm']);
  assert.deepEqual(out.d, [0, 'timing']);
});

test('posts service: sync per account, manual posts, hide and product assignment', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'posts-'));
  try {
    const store = createStore(dir);
    await store.update((s) => { s.products = [{ id: 'cooldesk', label: 'Cooldesk', siteId: '', repos: [], extensionIds: [] }]; });
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('hn.algolia.com')) return new Response(JSON.stringify({ hits: [{ objectID: '1', title: 'Show HN: Cooldesk', points: 5, num_comments: 2, created_at_i: Math.floor(Date.now() / 1000) - 86400 }] }));
      if (u.includes('dev.to')) return new Response('{}', { status: 404 });
      throw new Error(`unexpected ${u}`);
    };
    const mentions = { redditToken: async () => '', credentials: async () => ({ ph: { token: '' } }) };
    const posts = createPosts({ dbPath: join(dir, 'posts.db'), store, mentions, auth: { token: async () => 'x' }, fetchImpl, log: { error() {} } });
    await posts.saveAccounts([{ platform: 'hn', handle: 'me' }, { platform: 'devto', handle: 'ghost' }]);
    const r = await posts.sync();
    assert.equal(r.added['hn:me'], 1);
    assert.equal(r.errors['devto:ghost'], 'No such user');
    await posts.addManual({ url: 'https://www.linkedin.com/posts/me-1/', title: 'Launch note', date: new Date().toISOString().slice(0, 10), points: '14' });
    let o = await posts.overview({ rangeKey: '28d' });
    assert.equal(o.totals.posts, 2);
    assert.ok(o.items.every((i) => i.product === 'cooldesk' || i.platform === 'linkedin'));
    const li = o.items.find((i) => i.platform === 'linkedin');
    assert.equal(li.points, 14);
    posts.setProduct(li.id, 'cooldesk');
    o = await posts.overview({ rangeKey: '28d', product: 'cooldesk' });
    assert.equal(o.items.length, 2);
    assert.equal((await posts.annotations({ from: '', to: '' })).length, 2);
    posts.hide(li.id);
    posts.hide(o.items.find((i) => i.platform === 'hn').id);
    assert.equal((await posts.overview({ rangeKey: '28d' })).items.length, 0);
    // A hidden synced post stays hidden after the next sync.
    await posts.sync();
    assert.equal((await posts.overview({ rangeKey: '28d' })).items.length, 0);
    posts.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
