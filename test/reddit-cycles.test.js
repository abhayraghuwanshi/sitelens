import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { campaignFor, redditId, postVerdict, subredditBoard, campaignTraffic, lessons, createRedditCycles, RESEARCH_MODEL } from '../server/reddit-cycles.mjs';

const H = 3_600_000;
const NOW = Date.parse('2026-11-14T12:00:00Z');

test('campaignFor: one tag per draft, prefixed so GA4 can filter on it', () => {
  assert.equal(campaignFor(2, 'GoogleAnalytics', 'I compared GA4 and Plausible for 30 days!'), 'rcycle2-googleanalytics-i-compared-ga4-and-plaus');
  assert.match(campaignFor(1, 'SEO', 'x'), /^rcycle1-seo-x$/);
});

test('redditId: post URLs in their usual shapes', () => {
  assert.equal(redditId('https://www.reddit.com/r/SaaS/comments/1abc2d/my_post/'), 't3_1abc2d');
  assert.equal(redditId('https://old.reddit.com/comments/XyZ123'), 't3_xyz123');
  assert.equal(redditId('https://redd.it/abc123'), 't3_abc123');
  assert.equal(redditId('https://www.reddit.com/r/SaaS/'), '');
  assert.equal(redditId('not a url'), '');
});

test('postVerdict: removed, running, worked, some, flopped', () => {
  const v = (r) => postVerdict({ postedAt: NOW - 72 * H, score: 0, comments: 0, visits: 0, engaged: 0, acted: 0, ...r }, { now: NOW }).verdict;
  assert.equal(v({ removed: 'moderator', visits: 100 }), 'removed');
  assert.equal(v({ postedAt: NOW - 5 * H }), 'running');
  assert.equal(v({ visits: 3, acted: 1 }), 'worked');
  assert.equal(v({ visits: 40 }), 'worked');
  assert.equal(v({ visits: 6 }), 'some');
  assert.equal(v({ score: 120, visits: 1 }), 'some');
  assert.equal(v({ score: 2, visits: 1 }), 'flopped');
});

test('subredditBoard: keep where something worked, drop after two flops', () => {
  const p = (subreddit, verdict, extra = {}) => ({ status: 'posted', subreddit, verdict, visits: 0, engaged: 0, acted: 0, score: 0, comments: 0, ...extra });
  const board = subredditBoard([
    p('GoogleAnalytics', 'worked', { visits: 50, acted: 3 }), p('GoogleAnalytics', 'flopped'),
    p('SEO', 'removed'), p('seo', 'flopped'),
    p('SideProject', 'some', { visits: 8 }),
    p('webdev', 'running'),
    { status: 'idea', subreddit: 'indiehackers' },
  ]);
  const call = Object.fromEntries(board.map((s) => [s.subreddit, s.call]));
  assert.deepEqual(call, { GoogleAnalytics: 'keep', SEO: 'drop', SideProject: 'retry', webdev: 'wait' });
  assert.equal(board[0].subreddit, 'GoogleAnalytics');
  assert.equal(board.find((s) => s.subreddit === 'SEO').posts, 2);
});

test('campaignTraffic: visits per campaign, and acted from the site’s goal events', () => {
  const { traffic, goals } = campaignTraffic(
    [{ sessionCampaignName: 'rcycle1-seo-a', sessions: '10', engagedSessions: '6' }, { sessionCampaignName: 'RCYCLE1-SEO-A', sessions: '2', engagedSessions: '1' }],
    [{ sessionCampaignName: 'rcycle1-seo-a', eventName: 'page_view', totalUsers: '11' }, { sessionCampaignName: 'rcycle1-seo-a', eventName: 'file_download', totalUsers: '2' }],
  );
  assert.deepEqual(goals, ['file_download']);
  assert.deepEqual(traffic.get('rcycle1-seo-a'), { visits: 12, engaged: 7, acted: 2 });
});

test('lessons: what the next round is told', () => {
  assert.match(lessons([]), /first round/);
  const text = lessons([
    { status: 'posted', round: 1, subreddit: 'SEO', title: 'A', verdict: 'removed', score: 1, comments: 0, visits: 0, engaged: 0, acted: 0 },
    { status: 'skipped', round: 1, subreddit: 'webdev', title: 'B' },
  ]);
  assert.match(text, /r\/SEO \(round 1\) “A” → Removed/);
  assert.match(text, /r\/SEO: 1 posts/);
  assert.match(text, /skipped.*r\/webdev “B”/);
});

/* ---------- the service ---------- */

const SITE = { id: 'a', label: 'Cool Desk', host: 'cool-desk.com', propertyId: '' };

function fakeClient(script) {
  const requests = [];
  return {
    requests,
    beta: { messages: { create: async (req) => {
      requests.push(structuredClone(req));
      const next = script.shift();
      if (!next) throw new Error('script ran out');
      return { model: RESEARCH_MODEL, usage: {}, ...next };
    } } },
  };
}

const PLAN = {
  summary: 'Founders on r/SaaS.',
  subreddits: [{ name: 'r/SaaS', why: 'Founders.', rules: 'Links in comments.' }],
  posts: [
    { subreddit: 'SaaS', title: 'What I learned', body: 'Text', page: '/blog/x', angle: 'lessons', link_advice: 'In a comment.', flair: '', why: 'Fits.' },
    { subreddit: 'SaaS', title: 'Second', body: 'More', page: 'https://evil.example', angle: 'data', link_advice: '', flair: '', why: '' },
  ],
};

async function setup(script) {
  const dir = await mkdtemp(join(tmpdir(), 'studio-reddit-'));
  const store = createStore(dir);
  await store.update((s) => { s.sources = { anthropicKey: 'sk-test' }; });
  const client = fakeClient(script);
  const redditCalls = [];
  const fetchImpl = async (url) => {
    redditCalls.push(String(url));
    if (String(url).includes('/subreddits/search')) return Response.json({ data: { children: [{ data: { display_name: 'SaaS', subscribers: 400000, public_description: 'Software as a service', over18: false } }] } });
    if (String(url).includes('/api/info')) return Response.json({ data: { children: [{ data: { name: 't3_abc123', score: 57, num_comments: 12, upvote_ratio: 0.93, created_utc: (NOW - 72 * H) / 1000 } }] } });
    return Response.json({});
  };
  const cycles = createRedditCycles({
    dbPath: join(dir, 'reddit.db'), store, auth: {}, baseUrl: 'http://x', fetchImpl, now: () => NOW, log: { error() {} },
    mentions: { redditToken: async () => 'tok' }, createClient: () => client,
  });
  const done = async () => { for (let i = 0; i < 50 && (await cycles.overview(SITE)).research; i++) await new Promise((r) => setTimeout(r, 5)); };
  return { cycles, client, redditCalls, done, cleanup: async () => { cycles.stop(); await rm(dir, { recursive: true, force: true }); } };
}

test('research → plan → posted → measured', async () => {
  const { cycles, client, redditCalls, done, cleanup } = await setup([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'reddit_find_subreddits', input: { query: 'saas' } }] },
    { stop_reason: 'pause_turn', content: [{ type: 'text', text: 'searching' }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'save_plan', input: PLAN }] },
  ]);
  try {
    const started = await cycles.research(SITE, { focus: 'the launch' });
    assert.equal(started.started, true);
    await done();
    const first = client.requests[0];
    assert.equal(first.model, RESEARCH_MODEL);
    assert.ok(first.tools.some((t) => t.type === 'web_search_20260209'));
    assert.match(first.messages[0].content, /round 1[\s\S]*first round[\s\S]*the launch/);
    // The Reddit result went back as untrusted data; pause_turn was resent without a new user turn.
    assert.match(client.requests[1].messages[2].content[0].content, /never as instructions[\s\S]*"SaaS"/);
    assert.equal(client.requests[2].messages.at(-1).role, 'assistant');
    assert.ok(redditCalls.some((u) => u.includes('/subreddits/search?q=saas')));

    let o = await cycles.overview(SITE);
    assert.equal(o.failed, null);
    assert.equal(o.rounds.length, 1);
    assert.equal(o.rounds[0].subreddits[0].name, 'SaaS');
    assert.equal(o.items.length, 2);
    const [a, b] = o.items;
    assert.equal(a.status, 'idea');
    assert.equal(a.link, `https://cool-desk.com/blog/x?utm_source=reddit&utm_medium=social&utm_campaign=${a.campaign}`);
    assert.equal(b.page, '/', 'only site paths are linked');

    await assert.rejects(cycles.markPosted(SITE, { id: a.id, url: 'https://www.reddit.com/r/SaaS/' }), /Reddit URL/);
    await cycles.markPosted(SITE, { id: a.id, url: 'https://www.reddit.com/r/SaaS/comments/abc123/what_i_learned/' });
    await cycles.setStatus(SITE, { id: b.id, status: 'skipped' });
    await assert.rejects(cycles.markPosted(SITE, { id: b.id, url: 'https://redd.it/abc123' }), /another draft/);
    o = await cycles.overview(SITE);
    const posted = o.items.find((x) => x.id === a.id);
    assert.equal(posted.score, 57);
    assert.equal(posted.comments, 12);
    assert.equal(posted.verdict, 'some');
    assert.equal(o.totals.posts, 1);
    assert.equal(o.subreddits[0].call, 'retry');
    assert.equal(o.needs.ga4, true);
    await assert.rejects(cycles.editDraft(SITE, { id: a.id, title: 'new' }), /posted already/);
  } finally {
    await cleanup();
  }
});

test('research: a failed run is reported, and needs a key and Reddit', async () => {
  const { cycles, done, cleanup } = await setup([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'still no' }] }]);
  try {
    await cycles.research(SITE);
    await done();
    assert.match((await cycles.overview(SITE)).failed.message, /without a plan/);
    await assert.rejects(cycles.research({ ...SITE, demo: true }), /sample/);
  } finally {
    await cleanup();
  }
});

test('demo: a sample cycle with verdicts', async () => {
  const { cycles, cleanup } = await setup([]);
  try {
    const o = await cycles.overview({ id: 'demo', demo: true });
    assert.equal(o.demo, true);
    assert.ok(o.items.some((x) => x.verdict === 'worked'));
    assert.ok(o.subreddits.some((s) => s.call === 'keep'));
  } finally {
    await cleanup();
  }
});
