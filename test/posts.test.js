import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import {
  parseRedditSubmitted, parseHnStories, parseDevto, parseMediumRss, parsePhMadePosts,
  parseRedditRss, parseBlueskyFeed, parseMastodonStatuses, parseLobsters,
  platformOf, postKey, utmCampaign, matchProduct, attribute, normalizeAccounts, createPosts,
} from '../server/posts.mjs';
import { taggedLink } from '../shared/utm.js';
import { sourceFamily } from '../server/journey.mjs';

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

const REDDIT_RSS = `<feed><entry><author><name>/u/me</name></author><content type="html">&lt;div class=&quot;md&quot;&gt;&lt;p&gt;Built a new tab dashboard&lt;/p&gt;&lt;/div&gt; submitted by &lt;a href=&quot;https://www.reddit.com/user/me&quot;&gt; /u/me &lt;/a&gt; &lt;br/&gt; &lt;span&gt;&lt;a href=&quot;https://cool-desk.com/?utm_source=reddit&amp;amp;utm_campaign=launch&quot;&gt;[link]&lt;/a&gt;&lt;/span&gt; &lt;span&gt;&lt;a href=&quot;https://www.reddit.com/r/SideProject/comments/a1/x/&quot;&gt;[comments]&lt;/a&gt;&lt;/span&gt;</content><id>t3_a1</id><link href="https://www.reddit.com/r/SideProject/comments/a1/x/" /><published>2026-10-01T10:00:00+00:00</published><title>I built Cooldesk &amp;amp; more</title></entry>
<entry><content type="html">x</content><id>t3_a2</id><link href="https://www.reddit.com/r/u_me/comments/a2/y/" /><published>2026-10-02T10:00:00+00:00</published><title>Profile post</title></entry></feed>`;

test('no-login parsers: Reddit RSS, Bluesky, Mastodon, Lobsters', () => {
  const r = parseRedditRss(REDDIT_RSS, 'me');
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].id, r[0].title, r[0].community, r[0].link, r[0].points], ['reddit:t3_a1', 'I built Cooldesk & more', 'r/SideProject', 'https://cool-desk.com/?utm_source=reddit&utm_campaign=launch', null]);
  assert.equal(r[0].text, 'Built a new tab dashboard');
  assert.equal(r[1].community, '');
  // Same id as the OAuth parser, so either source updates one row.
  assert.equal(r[0].id, parseRedditSubmitted({ data: { children: [{ kind: 't3', data: { id: 'a1', name: 't3_a1', permalink: '/' } }] } }, 'me')[0].id);

  const bsky = parseBlueskyFeed({ feed: [
    { post: { uri: 'at://did:plc:x/app.bsky.feed.post/3abc', author: { handle: 'me.bsky.social' }, record: { text: 'Launched Cooldesk today\nmore', createdAt: '2026-10-01T10:00:00Z', embed: { external: { uri: 'https://cool-desk.com' } } }, likeCount: 10, repostCount: 2, replyCount: 3 } },
    { post: { uri: 'at://did:plc:y/app.bsky.feed.post/3def', author: { handle: 'someone.else' }, record: { text: 'x' } }, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } },
  ] }, 'me.bsky.social');
  assert.equal(bsky.length, 1);
  assert.deepEqual([bsky[0].title, bsky[0].permalink, bsky[0].link, bsky[0].points, bsky[0].comments], ['Launched Cooldesk today', 'https://bsky.app/profile/me.bsky.social/post/3abc', 'https://cool-desk.com', 12, 3]);

  const masto = parseMastodonStatuses([
    { uri: 'https://m.social/users/me/statuses/1', url: 'https://m.social/@me/1', created_at: '2026-10-01T10:00:00Z', content: '<p class="quote-inline">RE: <a href="https://m.social/@x/9">q</a></p><p>Cooldesk is out</p><p><a href="https://m.social/tags/js" class="mention hashtag">#js</a> <a href="https://cool-desk.com/">cool-desk.com</a></p>', favourites_count: 4, reblogs_count: 1, replies_count: 2, tags: [{ name: 'js' }], card: null },
    { reblog: {}, uri: 'r' },
  ], 'me@m.social');
  assert.equal(masto.length, 1);
  assert.deepEqual([masto[0].title, masto[0].link, masto[0].points, masto[0].community], ['Cooldesk is out', 'https://cool-desk.com/', 5, '#js']);

  const lob = parseLobsters([{ short_id: 'ab12', title: 'Cooldesk', url: 'https://cool-desk.com', score: 8, comment_count: 2, tags: ['web'], created_at: '2026-10-01T10:00:00.000-05:00', comments_url: 'https://lobste.rs/s/ab12/cooldesk' }], 'me');
  assert.deepEqual([lob[0].id, lob[0].permalink, lob[0].points, lob[0].community], ['lobsters:ab12', 'https://lobste.rs/s/ab12/cooldesk', 8, '#web']);
});

test('taggedLink builds utm links that sourceFamily maps back to the platform', () => {
  assert.equal(taggedLink({ url: 'cool-desk.com/blog?ref=1', platform: 'reddit', campaign: 'Launch Post!' }), 'https://cool-desk.com/blog?ref=1&utm_source=reddit&utm_medium=social&utm_campaign=launch-post');
  assert.match(taggedLink({ url: 'https://cool-desk.com/', platform: 'other', source: 'My Newsletter', medium: 'email', campaign: 'oct', content: 'Top link' }), /utm_source=my-newsletter&utm_medium=email&utm_campaign=oct&utm_content=top-link$/);
  assert.throws(() => taggedLink({ url: 'https://cool-desk.com/', platform: 'other', campaign: 'x' }), /source/);
  assert.throws(() => taggedLink({ url: 'https://cool-desk.com/', platform: 'reddit', campaign: '' }), /campaign/);
  for (const [platform, family] of [['reddit', 'Reddit'], ['hn', 'Hacker News'], ['ph', 'Product Hunt'], ['bluesky', 'Bluesky'], ['mastodon', 'Mastodon'], ['lobsters', 'Lobsters'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['devto', 'dev.to'], ['medium', 'medium.com']]) {
    assert.equal(sourceFamily(new URL(taggedLink({ url: 'a.com', platform, campaign: 'c' })).searchParams.get('utm_source')), family, platform);
  }
  assert.equal(sourceFamily('hachyderm.io'), 'Mastodon');
  assert.equal(sourceFamily('bsky.app'), 'Bluesky');
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
  assert.deepEqual(normalizeAccounts([
    { platform: 'bluesky', handle: 'https://bsky.app/profile/me.bsky.social' },
    { platform: 'mastodon', handle: 'https://hachyderm.io/@me' },
    { platform: 'mastodon', handle: '@you@mastodon.social' },
    { platform: 'lobsters', handle: 'https://lobste.rs/~me' },
  ]), [{ platform: 'bluesky', handle: 'me.bsky.social' }, { platform: 'mastodon', handle: 'me@hachyderm.io' }, { platform: 'mastodon', handle: 'you@mastodon.social' }, { platform: 'lobsters', handle: 'me' }]);
  assert.throws(() => normalizeAccounts([{ platform: 'mastodon', handle: 'me' }]), /Mastodon username/);
  assert.throws(() => normalizeAccounts([{ platform: 'bluesky', handle: 'me' }]), /Bluesky username/);
  assert.equal(platformOf('https://bsky.app/profile/me.bsky.social/post/3abc'), 'bluesky');
  assert.equal(platformOf('https://fosstodon.org/@me/1234'), 'mastodon');
  assert.equal(platformOf('https://lobste.rs/s/ab12'), 'lobsters');
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
      if (u.includes('reddit.com/user/me/submitted.rss')) return new Response(REDDIT_RSS.replaceAll('2026-10-0', new Date(Date.now() - 86400000).toISOString().slice(0, 9)));
      if (u.includes('oauth.reddit.com')) return new Response(JSON.stringify({ data: { children: [{ kind: 't3', data: { id: 'a1', name: 't3_a1', title: 'I built Cooldesk', permalink: '/r/SideProject/comments/a1/x/', score: 42, num_comments: 7, created_utc: Date.now() / 1000 - 86400 } }] } }));
      throw new Error(`unexpected ${u}`);
    };
    let redditToken = '';
    const mentions = { redditToken: async () => redditToken, credentials: async () => ({ ph: { token: '' } }) };
    const posts = createPosts({ dbPath: join(dir, 'posts.db'), store, mentions, auth: { token: async () => 'x' }, fetchImpl, log: { error() {} } });
    await posts.saveAccounts([{ platform: 'reddit', handle: 'me' }]);
    // No Reddit app: the public feed, no scores. With an app: scores. Feed again: scores stay.
    assert.equal((await posts.sync()).added['reddit:me'], 2);
    const score = async () => (await posts.overview({ rangeKey: '28d' })).items.find((i) => i.id === 'reddit:t3_a1').points;
    assert.equal(await score(), null);
    redditToken = 't';
    await posts.sync();
    assert.equal(await score(), 42);
    redditToken = '';
    await posts.sync();
    assert.equal(await score(), 42);
    for (const i of (await posts.overview({ rangeKey: '28d' })).items) posts.hide(i.id);

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

test('postKey: one key per post across URL forms', () => {
  const k = 'reddit:a1';
  for (const u of ['https://www.reddit.com/r/SideProject/comments/a1/x/', 'https://old.reddit.com/r/SideProject/comments/A1/x?utm_source=share', 'https://redd.it/a1']) assert.equal(postKey(u), k);
  assert.equal(postKey('https://news.ycombinator.com/item?id=42'), 'hn:42');
  assert.equal(postKey('https://www.linkedin.com/posts/me-1/?x=1'), 'linkedin.com/posts/me-1');
  assert.equal(postKey('nope'), '');
});

test('posts service: a post added by hand and later synced is kept once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'posts-'));
  try {
    const store = createStore(dir);
    await store.update((s) => { s.products = [{ id: 'cooldesk', label: 'Cooldesk', siteId: 'cd', repos: [], extensionIds: [] }]; });
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/r/SideProject/s/share1')) return new Response(null, { status: 301, headers: { location: 'https://www.reddit.com/r/SideProject/comments/a1/x/?share_id=z' } });
      if (u.includes('reddit.com/user/me/submitted.rss')) return new Response(REDDIT_RSS.replaceAll('2026-10-0', new Date(Date.now() - 86400000).toISOString().slice(0, 9)));
      throw new Error(`unexpected ${u}`);
    };
    const mentions = { redditToken: async () => '', credentials: async () => ({ ph: { token: '' } }) };
    const posts = createPosts({ dbPath: join(dir, 'posts.db'), store, mentions, auth: { token: async () => 'x' }, fetchImpl, log: { error() {} } });
    const items = async () => (await posts.overview({ rangeKey: '28d' })).items;

    // A share link from the app, added on one site's calendar: resolved, filed under that site's product.
    const manual = await posts.addManual({ url: 'https://www.reddit.com/r/SideProject/s/share1', title: 'Untitled', site: 'cd' });
    assert.equal(manual.id, 'manual:reddit:a1');
    assert.equal((await items())[0].permalink, 'https://www.reddit.com/r/SideProject/comments/a1/x/');

    // Sync brings the same post: one row, the synced one, keeping the product.
    await posts.saveAccounts([{ platform: 'reddit', handle: 'me' }]);
    assert.equal((await posts.sync()).added['reddit:me'], 1);
    const after = await items();
    assert.deepEqual(after.map((i) => i.id).sort(), ['reddit:t3_a1', 'reddit:t3_a2']);
    assert.equal(after.find((i) => i.id === 'reddit:t3_a1').product, 'cooldesk');

    // Adding it again by hand, in another URL form, reuses the synced row, even a hidden one.
    posts.hide('reddit:t3_a1');
    const again = await posts.addManual({ url: 'https://old.reddit.com/r/SideProject/comments/a1/x' });
    assert.deepEqual([again.id, again.existing], ['reddit:t3_a1', true]);
    assert.equal((await items()).length, 2);
    posts.stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('posts service: one post’s traffic, landing pages and referrers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'posts-'));
  const realFetch = globalThis.fetch;
  try {
    const store = createStore(dir);
    await store.update((s) => {
      s.sites = [{ id: 'cd', label: 'Cooldesk', host: 'cool-desk.com', propertyId: '123' }];
      s.products = [{ id: 'cooldesk', label: 'Cooldesk', siteId: 'cd', repos: [], extensionIds: [] }];
    });
    const day = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const ymd = (offset) => new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
    const ga = (dims, metrics, rows) => new Response(JSON.stringify({
      dimensionHeaders: dims.map((name) => ({ name })), metricHeaders: metrics.map((name) => ({ name, type: 'TYPE_INTEGER' })),
      rows: rows.map((r) => ({ dimensionValues: r.slice(0, dims.length).map((value) => ({ value })), metricValues: r.slice(dims.length).map((v) => ({ value: String(v) })) })),
    }));
    globalThis.fetch = async (url, init) => {
      const dims = JSON.parse(init.body).dimensions.map((d) => d.name);
      if (dims.includes('landingPage')) return ga(dims, ['sessions', 'engagedSessions', 'newUsers', 'keyEvents'], [
        ['reddit.com', '(referral)', '/', 30, 12, 25, 2], ['out.reddit.com', '(referral)', '/pricing', 10, 8, 9, 1], ['google', '(organic)', '/', 99, 50, 40, 5],
      ]);
      return ga(dims, ['sessions'], [[ymd(-3), 'reddit.com', '(referral)', 2], [ymd(-1), 'reddit.com', '(referral)', 4], [ymd(0), 'reddit.com', '(referral)', 40], [ymd(0), 'google', '(organic)', 99]]);
    };
    const posts = createPosts({ dbPath: join(dir, 'posts.db'), store, mentions: {}, auth: { token: async () => 'x' }, log: { error() {} } });
    const { id } = await posts.addManual({ url: 'https://www.reddit.com/r/SideProject/comments/a1/x/', title: 'I built Cooldesk', date: day });
    const d = await posts.detail(id);
    assert.deepEqual([d.product.id, d.site.id, d.sessions, d.attribution], ['cooldesk', 'cd', 40, 'timing']);
    assert.equal(d.series.find((p) => p.date === day).sessions, 40);
    assert.equal(d.usual, 0);
    assert.deepEqual(d.landing.map((r) => [r.label, r.sessions]), [['/', 30], ['/pricing', 10]]);
    assert.deepEqual(d.sources.map((r) => r.label), ['reddit.com', 'out.reddit.com']);
    assert.deepEqual([d.window.sessions, d.window.engaged, d.window.newUsers, d.window.keyEvents], [40, 20, 34, 3]);
    await assert.rejects(posts.detail('nope'), /isn’t in Studio/);
    posts.stop();

    // Google refusing: the calendar's stored sources still draw the trend, and the page says to sign in.
    const refused = Object.assign(new Error('Google refused to refresh the session (invalid_grant). Sign in again.'), { kind: 'auth' });
    const history = { breakdown: async () => [{ date: day, key: 'reddit.com', value: 7 }, { date: day, key: 'google', value: 50 }] };
    const offline = createPosts({ dbPath: join(dir, 'posts.db'), store, mentions: {}, auth: { token: async () => { throw refused; } }, history, log: { error() {} } });
    const s = await offline.detail(id);
    assert.deepEqual([s.authError, s.stored, s.sessions, s.landing.length], [true, true, 7, 0]);
    assert.equal(s.series.find((p) => p.date === day).sessions, 7);
    offline.stop();
  } finally {
    globalThis.fetch = realFetch;
    await rm(dir, { recursive: true, force: true });
  }
});
