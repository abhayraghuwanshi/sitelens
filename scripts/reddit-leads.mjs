// Finds recent Reddit posts from people with the problem Studio solves (traffic
// that dropped, GA4 that confuses them, a launch they can't read) and writes
// them to a list. It only reads: it never posts, comments or messages anyone.
// You decide who to reach out to, and you write to them yourself.
//
//   npm run leads                      # last 14 days
//   npm run leads -- --days 30
//
// Needs no keys: it reads Reddit's public RSS search feed, about one request
// every 10 seconds, so a run takes a couple of minutes. (Reddit's JSON search
// now refuses requests without a key.) With REDDIT_CLIENT_ID and
// REDDIT_CLIENT_SECRET in .env it uses Reddit's API instead, which is faster.
// Writes .data/reddit-leads/<date>.csv and .md; people seen on an earlier run
// are marked, so each list shows who's new.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SUBREDDITS = ['GoogleAnalytics', 'SEO', 'bigseo', 'juststart', 'SaaS', 'indiehackers', 'SideProject', 'chrome_extensions', 'webdev', 'Entrepreneur'];

// What someone with the problem writes. Kept short: Reddit's search caps the query.
export const PHRASES = [
  'traffic dropped', 'traffic drop', 'lost traffic', 'GA4 confusing', 'understand GA4', 'GA4 help',
  'where is my traffic', 'search console', 'no conversions', 'nobody downloads', 'did my launch',
  'track downloads', 'analytics for my',
];

// Signs it's someone with a site or product of their own, not an agency or a vendor.
const OWNER = /\b(my (site|website|blog|app|extension|saas|product|landing page|startup)|i (launched|built|made|shipped))\b/i;
const VENDOR = /\b(we offer|our agency|dm me|hire|services|for sale|promo code)\b/i;
const SKIP_AUTHORS = new Set(['[deleted]', 'AutoModerator']);

export function buildQuery(phrases = PHRASES) {
  return phrases.map((p) => `"${p}"`).join(' OR ');
}

// → { score, why[] } for one post. Higher is a better person to talk to.
export function scorePost(post, { now = Date.now(), phrases = PHRASES } = {}) {
  const text = `${post.title || ''}\n${post.selftext || ''}`;
  const lower = text.toLowerCase();
  const matched = phrases.filter((p) => lower.includes(p.toLowerCase()));
  const why = [];
  let score = matched.length * 2;
  if (matched.length) why.push(`says “${matched.slice(0, 2).join('”, “')}”`);
  if (OWNER.test(text)) { score += 3; why.push('has a site or product of their own'); }
  if (/\bga4|google analytics\b/i.test(text)) { score += 2; why.push('uses GA4'); }
  if (VENDOR.test(text)) { score -= 5; why.push('looks like a vendor'); }
  // The RSS feed has no comment counts; only the API says how answered a post is.
  if (typeof post.num_comments === 'number' && post.num_comments <= 3) { score += 1; why.push('few answers yet'); }
  const days = (now / 1000 - (post.created_utc || 0)) / 86_400;
  if (days <= 3) score += 2;
  else if (days <= 7) score += 1;
  return { score, why };
}

// Reddit listing children → one lead per person (their best post), best first.
export function toLeads(children, { now = Date.now(), days = 14, seen = new Set() } = {}) {
  const since = now / 1000 - days * 86_400;
  const best = new Map();
  for (const { data: p } of children) {
    if (!p || SKIP_AUTHORS.has(p.author) || p.stickied || p.distinguished || p.over_18) continue;
    if ((p.created_utc || 0) < since) continue;
    const { score, why } = scorePost(p, { now });
    if (score < 3) continue;
    const lead = {
      user: p.author,
      subreddit: p.subreddit,
      title: p.title,
      url: `https://www.reddit.com${p.permalink}`,
      profile: `https://www.reddit.com/user/${p.author}`,
      posted: new Date(p.created_utc * 1000).toISOString().slice(0, 10),
      comments: typeof p.num_comments === 'number' ? p.num_comments : '',
      score,
      why: why.join('; '),
      seen: seen.has(p.author),
    };
    const had = best.get(p.author);
    if (!had || lead.score > had.score) best.set(p.author, lead);
  }
  return [...best.values()].sort((a, b) => a.seen - b.seen || b.score - a.score);
}

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export function toCsv(leads) {
  const cols = ['user', 'subreddit', 'title', 'url', 'profile', 'posted', 'comments', 'score', 'why', 'seen'];
  return [cols.join(','), ...leads.map((l) => cols.map((c) => csvCell(l[c])).join(','))].join('\n') + '\n';
}

export function toMarkdown(leads, { date, days }) {
  const lines = [`# Reddit leads, ${date}`, '', `Posts from the last ${days} days. Read each one before deciding to write; nothing has been sent.`, ''];
  for (const l of leads) {
    lines.push(`- [ ] **u/${l.user}**${l.seen ? ' _(seen before)_' : ''} in r/${l.subreddit}, ${l.posted}${l.comments === '' ? '' : `, ${l.comments} comments`}`);
    lines.push(`  ${l.title}`);
    lines.push(`  ${l.url}`);
    lines.push(`  _${l.why}_`);
  }
  return lines.join('\n') + '\n';
}

// ---------- fetching ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#32': ' ' };
const unescape = (s) => s.replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : m));
const tag = (xml, name) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '';

// Reddit's Atom search feed → the same shape as API listing children.
export function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const html = unescape(tag(e, 'content'));
    const link = e.match(/<link href="([^"]+)"/)?.[1] || '';
    return {
      data: {
        author: tag(tag(e, 'author'), 'name').replace(/^\/u\//, ''),
        subreddit: e.match(/<category term="([^"]+)"/)?.[1] || '',
        title: unescape(unescape(tag(e, 'title'))),
        selftext: unescape(html.split('submitted by')[0].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
        permalink: link.replace('https://www.reddit.com', ''),
        created_utc: Date.parse(tag(e, 'published') || tag(e, 'updated')) / 1000,
      },
    };
  });
}

const AGENT = 'sitelens-studio-leads/0.1 (read-only research script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token(id, secret) {
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'User-Agent': AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Reddit sign-in failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function search(sub, { auth, days }) {
  const t = days <= 7 ? 'week' : days <= 31 ? 'month' : 'year';
  const params = new URLSearchParams({ q: buildQuery(), restrict_sr: '1', sort: 'new', t, limit: '100', raw_json: '1' });
  const url = auth ? `https://oauth.reddit.com/r/${sub}/search?${params}` : `https://www.reddit.com/r/${sub}/search.rss?${params}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': AGENT, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) } });
    // Rate limited: wait out the window Reddit names, twice at most.
    if (res.status === 429 && attempt < 2) {
      await sleep((Number(res.headers.get('x-ratelimit-reset')) || 10) * 1000 + 1000);
      continue;
    }
    if (!res.ok) throw new Error(res.status === 429 ? 'rate limited' : `${res.status}`);
    return auth ? (await res.json()).data?.children || [] : parseFeed(await res.text());
  }
}

async function main() {
  if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
  };
  const days = Math.max(1, Number(arg('days', 14)) || 14);
  const { REDDIT_CLIENT_ID: id, REDDIT_CLIENT_SECRET: secret } = process.env;
  const auth = id && secret ? await token(id, secret) : null;
  const pause = auth ? 1100 : 11_000;
  console.log(`Searching ${SUBREDDITS.length} subreddits for the last ${days} days ${auth ? 'with the Reddit API' : 'with Reddit’s public feed, about 2 minutes'}…`);

  const out = join(root, '.data/reddit-leads');
  await mkdir(out, { recursive: true });
  const seenFile = join(out, 'seen.json');
  const seen = new Set(existsSync(seenFile) ? JSON.parse(await readFile(seenFile, 'utf8')) : []);

  const children = [];
  for (const [i, sub] of SUBREDDITS.entries()) {
    if (i) await sleep(pause);
    try {
      const found = await search(sub, { auth, days });
      children.push(...found);
      console.log(`  r/${sub}: ${found.length} posts`);
    } catch (err) {
      console.log(`  r/${sub}: skipped (${err.message})`);
    }
  }

  const leads = toLeads(children, { days, seen });
  const date = new Date().toISOString().slice(0, 10);
  await writeFile(join(out, `${date}.csv`), toCsv(leads));
  await writeFile(join(out, `${date}.md`), toMarkdown(leads, { date, days }));
  await writeFile(seenFile, JSON.stringify([...new Set([...seen, ...leads.map((l) => l.user)])], null, 1));
  const fresh = leads.filter((l) => !l.seen).length;
  console.log(`\n${leads.length} people (${fresh} new). Written to .data/reddit-leads/${date}.md and .csv`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
