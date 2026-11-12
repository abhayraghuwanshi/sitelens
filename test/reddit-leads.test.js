import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, scorePost, toLeads, toCsv, parseFeed } from '../scripts/reddit-leads.mjs';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const post = (over) => ({ data: { author: 'maker1', subreddit: 'SEO', title: 'My site traffic dropped', selftext: 'I launched a blog, GA4 shows a drop.', permalink: '/r/SEO/comments/a/x/', created_utc: NOW / 1000 - 86_400, num_comments: 1, ...over } });

test('the query ORs quoted phrases', () => {
  assert.equal(buildQuery(['a b', 'c']), '"a b" OR "c"');
});

test('owners with GA4 and few answers score high; vendors low', () => {
  const owner = scorePost(post().data, { now: NOW });
  const vendor = scorePost(post({ selftext: 'Our agency offers services, DM me' }).data, { now: NOW });
  assert.ok(owner.score >= 8, owner.why.join());
  assert.ok(vendor.score < owner.score - 4);
});

test('leads: one per person, skips bots, old and weak posts, new people first', () => {
  const leads = toLeads([
    post(),
    post({ title: 'traffic dropped and lost traffic', selftext: 'my website, GA4' }),
    post({ author: 'AutoModerator' }),
    post({ author: 'old', created_utc: NOW / 1000 - 40 * 86_400 }),
    post({ author: 'weak', title: 'Hello', selftext: 'nothing here', num_comments: 50 }),
    post({ author: 'known' }),
  ], { now: NOW, days: 14, seen: new Set(['known']) });
  assert.deepEqual(leads.map((l) => l.user), ['maker1', 'known']);
  assert.equal(leads[0].url, 'https://www.reddit.com/r/SEO/comments/a/x/');
  assert.equal(leads[1].seen, true);
  assert.match(toCsv(leads).split('\n')[1], /^maker1,SEO,/);
});

test('parseFeed reads Reddit\'s Atom search feed into posts', () => {
  const xml = `<feed><entry><author><name>/u/maker1</name></author><category term="SEO" label="r/SEO"/><content type="html">&lt;div&gt;&lt;p&gt;My site&amp;#39;s traffic dropped.&lt;/p&gt;&lt;/div&gt; submitted by &lt;a href=&quot;x&quot;&gt;/u/maker1&lt;/a&gt;</content><link href="https://www.reddit.com/r/SEO/comments/a/x/" /><published>2026-11-07T10:00:00+00:00</published><title>Traffic dropped &amp;amp; GA4</title></entry></feed>`;
  const [{ data }] = parseFeed(xml);
  assert.deepEqual(data, { author: 'maker1', subreddit: 'SEO', title: 'Traffic dropped & GA4', selftext: 'My site\'s traffic dropped.', permalink: '/r/SEO/comments/a/x/', created_utc: Date.parse('2026-11-07T10:00:00Z') / 1000 });
});
