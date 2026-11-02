// My posts: what *you* published about your products, from the accounts you
// name, with the traffic each post likely brought.
//
//  - Reddit: /user/<name>/submitted through the official OAuth app from
//    Settings → Mentions (app-only token; Reddit's anonymous JSON 403s).
//  - Hacker News: Algolia, tags=story,author_<name>. No key.
//  - Dev.to: /api/articles?username=<name>. No key.
//  - Medium: the public RSS feed medium.com/feed/@<name>. No key, no metrics.
//  - Product Hunt: GraphQL user(username).madePosts with the developer token.
//  - LinkedIn, X and anything else: added by URL. Their APIs don't let you
//    read your own posts without partner approval or a paid tier.
//
// A post belongs to a product when it names one (product name, keywords,
// domains, repos) or when you assign it. Traffic is GA4 sessions from that
// platform's referrers on the post day and the two days after, or exact
// sessions for its utm_campaign when the posted link carries one.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';
import { ValidationError } from './store.mjs';
import { historyRange } from './github.mjs';
import { sourceFamily } from './journey.mjs';
import { createCache } from './cache.mjs';

const DAY = 86_400_000;
const USER_AGENT = 'node:sitelens-studio:0.2 (local analytics dashboard)';
const WINDOW_DAYS = 3;

export const PLATFORMS = {
  reddit: { label: 'Reddit', family: 'Reddit', fetch: true, handle: 'u/username' },
  hn: { label: 'Hacker News', family: 'Hacker News', fetch: true, handle: 'username' },
  devto: { label: 'Dev.to', family: 'dev.to', fetch: true, handle: 'username' },
  medium: { label: 'Medium', family: 'medium.com', fetch: true, handle: '@username' },
  ph: { label: 'Product Hunt', family: 'Product Hunt', fetch: true, handle: 'username' },
  linkedin: { label: 'LinkedIn', family: 'LinkedIn', fetch: false },
  x: { label: 'X', family: 'X', fetch: false },
  other: { label: 'Other', family: '', fetch: false },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, platform TEXT NOT NULL, handle TEXT, title TEXT, text TEXT,
  permalink TEXT, link TEXT, community TEXT, points INTEGER, comments INTEGER,
  created_at INTEGER NOT NULL, product TEXT DEFAULT NULL, manual INTEGER DEFAULT 0,
  hidden INTEGER DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_created ON posts (created_at);
`;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const strip = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const cleanHandle = (h) => String(h || '').trim().replace(/^https?:\/\/[^/]+\//, '').replace(/^(u\/|user\/|@)/i, '').replace(/[/?#].*$/, '');

/* ---------- parsers (unit-tested) ---------- */

export function parseRedditSubmitted(json, handle) {
  return (json.data?.children || []).filter((c) => c.kind === 't3' && c.data?.id).map(({ data: d }) => ({
    id: `reddit:${d.name || `t3_${d.id}`}`,
    platform: 'reddit',
    handle,
    title: strip(d.title),
    text: strip(d.selftext).slice(0, 1000),
    permalink: `https://www.reddit.com${d.permalink}`,
    link: d.is_self ? '' : d.url || '',
    community: d.subreddit_name_prefixed || (d.subreddit ? `r/${d.subreddit}` : ''),
    points: Number(d.score) || 0,
    comments: Number(d.num_comments) || 0,
    createdAt: Math.round(Number(d.created_utc) * 1000),
  }));
}

export function parseHnStories(json, handle) {
  return (json.hits || []).map((h) => ({
    id: `hn:${h.objectID}`,
    platform: 'hn',
    handle,
    title: strip(h.title),
    text: strip(h.story_text).slice(0, 1000),
    permalink: `https://news.ycombinator.com/item?id=${h.objectID}`,
    link: h.url || '',
    community: h.title?.startsWith('Show HN') ? 'Show HN' : h.title?.startsWith('Ask HN') ? 'Ask HN' : '',
    points: Number(h.points) || 0,
    comments: Number(h.num_comments) || 0,
    createdAt: Number(h.created_at_i) * 1000,
  }));
}

export function parseDevto(list, handle) {
  return (Array.isArray(list) ? list : []).map((a) => ({
    id: `devto:${a.id}`,
    platform: 'devto',
    handle,
    title: strip(a.title),
    text: strip(a.description).slice(0, 1000),
    permalink: a.url,
    link: a.canonical_url && a.canonical_url !== a.url ? a.canonical_url : '',
    community: (a.tag_list || []).map((t) => `#${t}`).join(' '),
    points: Number(a.public_reactions_count ?? a.positive_reactions_count) || 0,
    comments: Number(a.comments_count) || 0,
    createdAt: Date.parse(a.published_at || a.published_timestamp),
  }));
}

export function parseMediumRss(xml, handle) {
  const items = String(xml || '').split('<item>').slice(1);
  return items.map((raw) => {
    const tag = (name) => strip((raw.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1]);
    const link = tag('link').replace(/\?source=.*$/, '');
    const guid = tag('guid');
    return {
      id: `medium:${guid.split('/').pop() || link}`,
      platform: 'medium',
      handle,
      title: tag('title'),
      text: tag('content:encoded').slice(0, 1000),
      permalink: link,
      link: '',
      community: [...raw.matchAll(/<category><!\[CDATA\[(.*?)\]\]><\/category>/g)].map((m) => `#${m[1]}`).join(' '),
      points: null,
      comments: null,
      createdAt: Date.parse(tag('pubDate')),
    };
  }).filter((p) => p.title && Number.isFinite(p.createdAt));
}

export function parsePhMadePosts(json, handle) {
  return (json.data?.user?.madePosts?.edges || []).map(({ node: p }) => ({
    id: `ph:${p.id}`,
    platform: 'ph',
    handle,
    title: `${p.name} — ${p.tagline || 'launch'}`,
    text: '',
    permalink: p.url,
    link: p.website || '',
    community: 'Launch',
    points: Number(p.votesCount) || 0,
    comments: Number(p.commentsCount) || 0,
    createdAt: Date.parse(p.featuredAt || p.createdAt),
  }));
}

// Platform from a pasted URL, for posts added by hand.
export function platformOf(url) {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  if (/(^|\.)linkedin\.com$|^lnkd\.in$/.test(host)) return 'linkedin';
  if (/^(x|twitter)\.com$/.test(host)) return 'x';
  if (/(^|\.)reddit\.com$/.test(host)) return 'reddit';
  if (host === 'news.ycombinator.com') return 'hn';
  if (host === 'dev.to') return 'devto';
  if (/(^|\.)medium\.com$/.test(host)) return 'medium';
  if (/producthunt\.com$/.test(host)) return 'ph';
  return host ? 'other' : '';
}

export function utmCampaign(...urls) {
  for (const u of urls) {
    try {
      const c = new URL(u).searchParams.get('utm_campaign');
      if (c) return c;
    } catch { /* not a URL */ }
  }
  return '';
}

// Terms that tie a post to a product: name, keywords, domains, site host, repo names.
export function productTerms(product, sites = []) {
  const site = sites.find((s) => s.id === product.siteId);
  const terms = [
    product.label,
    ...(product.keywords || []),
    ...(product.domains || []).map((d) => d.name),
    site && !site.demo ? String(site.host || '').replace(/^www\./, '') : '',
    ...(product.repos || []).flatMap((r) => [r, r.split('/').pop()]),
    ...(product.extensionIds || []),
  ];
  return [...new Set(terms.map((t) => String(t || '').toLowerCase().trim()).filter((t) => t.length >= 4))];
}

export function matchProduct(post, products, sites) {
  if (post.product) return post.product;
  const hay = `${post.title} ${post.text} ${post.link}`.toLowerCase();
  const hit = products.find((p) => productTerms(p, sites).some((t) => hay.includes(t)));
  return hit?.id || '';
}

// Sessions likely sent by one post: its platform's referrers on the post day and
// the next two, split evenly between this platform's posts in the same window.
export function attribute(posts, daily) {
  return posts.map((p) => {
    const family = PLATFORMS[p.platform]?.family;
    const campaign = utmCampaign(p.link, p.permalink);
    if (campaign && daily.campaigns) {
      const exact = daily.campaigns.get(campaign.toLowerCase()) || 0;
      return { ...p, sessions: exact, attribution: 'utm' };
    }
    if (!family) return { ...p, sessions: null, attribution: '' };
    const days = Array.from({ length: WINDOW_DAYS }, (_, i) => isoDay(p.createdAt + i * DAY));
    let total = 0;
    for (const day of days) {
      const sessions = daily.byFamily.get(`${day}|${family}`) || 0;
      if (!sessions) continue;
      const sharing = posts.filter((o) => o.platform === p.platform && o.product === p.product && !utmCampaign(o.link, o.permalink)
        && day >= isoDay(o.createdAt) && day <= isoDay(o.createdAt + (WINDOW_DAYS - 1) * DAY)).length || 1;
      total += sessions / sharing;
    }
    return { ...p, sessions: Math.round(total), attribution: 'timing' };
  });
}

export function normalizeAccounts(input = []) {
  const out = [];
  for (const a of input) {
    const platform = String(a?.platform || '');
    const handle = cleanHandle(a?.handle);
    if (!PLATFORMS[platform]?.fetch) throw new ValidationError(`${PLATFORMS[platform]?.label || platform || 'That platform'} can’t be fetched; add its posts by URL instead.`);
    if (!/^[\w.-]{2,40}$/.test(handle)) throw new ValidationError(`“${a?.handle}” isn’t a ${PLATFORMS[platform].label} username.`);
    if (!out.some((x) => x.platform === platform && x.handle.toLowerCase() === handle.toLowerCase())) out.push({ platform, handle });
  }
  return out;
}

/* ---------- service ---------- */

export function createPosts({ dbPath, store, mentions, auth, fetchImpl = fetch, now = Date.now, log = console }) {
  let db = null;
  let timers = [];
  let syncing = null;
  const status = { lastSync: 0, errors: {} };
  const cache = createCache();

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    return db;
  }

  async function accounts() {
    return (await store.get()).posts?.accounts || [];
  }

  async function request(url, init = {}, as = 'json') {
    const res = await fetchImpl(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      const err = new Error(res.status === 404 ? 'No such user' : `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return as === 'text' ? res.text() : res.json();
  }

  const fetchers = {
    async reddit(handle) {
      const token = await mentions.redditToken();
      if (!token) throw new Error('Add a Reddit app in Settings → Mentions first.');
      const json = await request(`https://oauth.reddit.com/user/${encodeURIComponent(handle)}/submitted?limit=100&sort=new&raw_json=1`, { headers: { Authorization: `Bearer ${token}` } });
      return parseRedditSubmitted(json, handle);
    },
    async hn(handle) {
      return parseHnStories(await request(`https://hn.algolia.com/api/v1/search_by_date?tags=story,author_${encodeURIComponent(handle)}&hitsPerPage=200`), handle);
    },
    async devto(handle) {
      return parseDevto(await request(`https://dev.to/api/articles?username=${encodeURIComponent(handle)}&per_page=100`), handle);
    },
    async medium(handle) {
      return parseMediumRss(await request(`https://medium.com/feed/@${encodeURIComponent(handle)}`, {}, 'text'), handle);
    },
    async ph(handle) {
      const { ph } = await mentions.credentials();
      if (!ph.token) throw new Error('Add a Product Hunt token in Settings → Mentions first.');
      const query = 'query($u: String!) { user(username: $u) { madePosts(first: 50) { edges { node { id name tagline url website votesCount commentsCount createdAt featuredAt } } } } }';
      const json = await request('https://api.producthunt.com/v2/api/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ph.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { u: handle } }),
      });
      if (json.errors?.length) throw new Error(json.errors[0].message);
      return parsePhMadePosts(json, handle);
    },
  };

  function save(items) {
    const t = now();
    const upsert = open().prepare(`INSERT INTO posts (id, platform, handle, title, text, permalink, link, community, points, comments, created_at, manual, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, points = excluded.points, comments = excluded.comments, updated_at = excluded.updated_at`);
    let added = 0;
    for (const p of items) {
      if (!Number.isFinite(p.createdAt)) continue;
      if (!open().prepare('SELECT 1 FROM posts WHERE id = ?').get(p.id)) added += 1;
      upsert.run(p.id, p.platform, p.handle, p.title, p.text, p.permalink, p.link, p.community, p.points, p.comments, p.createdAt, t);
    }
    return added;
  }

  async function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      const result = { added: {}, errors: {} };
      for (const { platform, handle } of await accounts()) {
        const key = `${platform}:${handle}`;
        try {
          result.added[key] = save(await fetchers[platform](handle));
          delete status.errors[key];
        } catch (err) {
          result.errors[key] = status.errors[key] = err.message;
        }
      }
      status.lastSync = now();
      cache.clear();
      return result;
    })();
    try {
      return await syncing;
    } finally {
      syncing = null;
    }
  }

  async function saveAccounts(input) {
    const list = normalizeAccounts(input);
    await store.update((s) => {
      s.posts = { ...(s.posts || {}), accounts: list };
    });
    sync().catch(() => {});
    return { accounts: list };
  }

  async function addManual(input = {}) {
    const url = String(input.url || '').trim();
    const platform = platformOf(url);
    if (!platform) throw new ValidationError('Paste the post’s full URL.');
    const date = String(input.date || '').trim() || isoDay(now());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError('Pick the date it was posted.');
    const title = String(input.title || '').trim().slice(0, 200) || url;
    const num = (v) => (v === '' || v === undefined || v === null ? null : Math.max(0, Math.round(Number(v)) || 0));
    const id = `manual:${platform}:${url.replace(/[?#].*$/, '').replace(/\/$/, '')}`;
    open().prepare(`INSERT OR REPLACE INTO posts (id, platform, handle, title, text, permalink, link, community, points, comments, created_at, product, manual, updated_at)
      VALUES (?, ?, '', ?, '', ?, ?, '', ?, ?, ?, ?, 1, ?)`)
      .run(id, platform, title, url, String(input.link || '').trim(), num(input.points), num(input.comments), Date.parse(`${date}T12:00:00Z`), String(input.product || '') || null, now());
    cache.clear();
    return { id, platform };
  }

  function setProduct(id, product) {
    open().prepare('UPDATE posts SET product = ? WHERE id = ?').run(product || null, id);
    cache.clear();
    return { ok: true };
  }

  function hide(id) {
    const row = open().prepare('SELECT manual FROM posts WHERE id = ?').get(id);
    if (row?.manual) open().prepare('DELETE FROM posts WHERE id = ?').run(id);
    else open().prepare('UPDATE posts SET hidden = 1 WHERE id = ?').run(id);
    cache.clear();
    return { ok: true };
  }

  // GA4 sessions per day per source family (+ per utm_campaign) for one site.
  async function siteDaily(site, start, end) {
    return cache.wrap(`ga:${site.id}:${start}:${end}`, 15 * 60_000, false, async () => {
      const report = await runReport({
        token: await auth.token(),
        propertyId: site.propertyId,
        body: {
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionCampaignName' }],
          metrics: [{ name: 'sessions' }],
          dimensionFilter: hostFilter(site.host, { includeSubdomains: site.includeSubdomains }),
          limit: 10000,
        },
      });
      const byFamily = new Map();
      const campaigns = new Map();
      for (const r of report.rows) {
        const day = `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`;
        const key = `${day}|${sourceFamily(r.sessionSource)}`;
        const n = Number(r.sessions) || 0;
        byFamily.set(key, (byFamily.get(key) || 0) + n);
        const c = String(r.sessionCampaignName || '').toLowerCase();
        if (c && c !== '(not set)' && c !== '(direct)' && c !== '(organic)' && c !== '(referral)') campaigns.set(c, (campaigns.get(c) || 0) + n);
      }
      return { byFamily, campaigns };
    });
  }

  async function overview({ rangeKey = '90d', product = '', platform = '' } = {}) {
    const range = historyRange(rangeKey, now());
    const from = Date.parse(`${range.start}T00:00:00Z`);
    const to = Date.parse(`${range.end}T00:00:00Z`) + DAY;
    const saved = await store.get();
    const products = saved.products || [];
    const sites = await store.sites();
    const rows = open().prepare('SELECT * FROM posts WHERE hidden = 0 AND created_at >= ? AND created_at < ? ORDER BY created_at DESC').all(from, to);
    let items = rows.map((r) => {
      const post = { id: r.id, platform: r.platform, handle: r.handle, title: r.title, text: r.text, permalink: r.permalink, link: r.link, community: r.community, points: r.points, comments: r.comments, createdAt: r.created_at, manual: Boolean(r.manual), assigned: Boolean(r.product), product: r.product || '' };
      return { ...post, product: matchProduct(post, products, sites) };
    });

    // Traffic, per product site; a GA4 failure blanks sessions, never the list.
    const errors = { ...status.errors };
    const withTraffic = [];
    for (const p of products) {
      const site = sites.find((s) => s.id === p.siteId && !s.demo && s.propertyId);
      const mine = items.filter((i) => i.product === p.id);
      if (!site || !mine.length) continue;
      try {
        const end = isoDay(Math.min(Date.parse(`${range.end}T00:00:00Z`), now()));
        withTraffic.push(...attribute(mine, await siteDaily(site, range.start, end)));
      } catch (err) {
        errors[`ga4:${p.id}`] = err.message;
      }
    }
    const traffic = new Map(withTraffic.map((p) => [p.id, p]));
    items = items.map((i) => traffic.get(i.id) || { ...i, sessions: null, attribution: '' });
    const filtered = items.filter((i) => (!product || i.product === product) && (!platform || i.platform === platform));

    const sum = (list, key) => list.reduce((a, b) => a + (b[key] || 0), 0);
    const byPlatform = Object.keys(PLATFORMS).map((key) => {
      const list = filtered.filter((i) => i.platform === key);
      return { key, label: PLATFORMS[key].label, posts: list.length, points: sum(list, 'points'), comments: sum(list, 'comments'), sessions: sum(list, 'sessions') };
    }).filter((p) => p.posts);
    const { ph } = await mentions.credentials();
    const redditReady = Boolean(await mentions.redditToken().catch(() => ''));
    return {
      range,
      accounts: await accounts(),
      platforms: Object.entries(PLATFORMS).map(([key, p]) => ({
        key, label: p.label, fetch: p.fetch, handle: p.handle || '',
        ready: key === 'reddit' ? redditReady : key === 'ph' ? Boolean(ph.token) : p.fetch,
      })),
      products: products.map((p) => ({ id: p.id, label: p.label })),
      totals: { posts: filtered.length, points: sum(filtered, 'points'), comments: sum(filtered, 'comments'), sessions: sum(filtered, 'sessions') },
      byPlatform,
      items: filtered.slice(0, 500),
      lastSync: status.lastSync,
      syncing: Boolean(syncing),
      errors,
    };
  }

  // Your posts as chart markers, under the product they belong to.
  async function annotations({ from, to, scopes }) {
    const saved = await store.get();
    const products = saved.products || [];
    const sites = await store.sites();
    const start = from ? Date.parse(`${from}T00:00:00Z`) : 0;
    const end = to ? Date.parse(`${to}T00:00:00Z`) + DAY : now() + DAY;
    return open().prepare('SELECT * FROM posts WHERE hidden = 0 AND created_at >= ? AND created_at < ?').all(start, end).flatMap((r) => {
      const post = { title: r.title, text: r.text, link: r.link, product: r.product };
      const p = products.find((x) => x.id === matchProduct(post, products, sites));
      const productScopes = p ? [p.siteId && `site:${p.siteId}`, ...p.repos.map((x) => `repo:${x}`), ...p.extensionIds.map((x) => `ext:${x}`)].filter(Boolean) : [];
      const scope = scopes?.length ? productScopes.find((s) => scopes.includes(s)) : productScopes[0];
      if (scopes?.length && !scope) return [];
      return [{
        id: `post:${r.id}`,
        date: isoDay(r.created_at),
        label: `Your ${PLATFORMS[r.platform]?.label || r.platform} post: ${r.title}`,
        kind: 'post',
        source: 'posts',
        url: r.permalink,
        ...(scope ? { scope } : {}),
      }];
    });
  }

  return {
    sync,
    overview,
    annotations,
    saveAccounts,
    addManual,
    setProduct,
    hide,
    start() {
      if (timers.length) return;
      const safe = () => sync().catch((err) => log.error('[posts]', err.message));
      timers.push(setTimeout(safe, 60_000));
      timers.push(setInterval(safe, 6 * 60 * 60_000));
      for (const timer of timers) timer.unref?.();
    },
    stop() {
      timers.forEach((timer) => clearInterval(timer));
      timers = [];
      db?.close();
      db = null;
    },
  };
}

export function postRoutes({ posts }) {
  return [
    ['GET', /^\/api\/posts$/, async ({ query }) => posts.overview({ rangeKey: query.get('range') || '90d', product: query.get('product') || '', platform: query.get('platform') || '' })],
    ['POST', /^\/api\/posts\/sync$/, async () => posts.sync()],
    ['POST', /^\/api\/posts\/accounts$/, async ({ body }) => posts.saveAccounts(body.accounts || [])],
    ['POST', /^\/api\/posts\/manual$/, async ({ body }) => posts.addManual(body)],
    ['POST', /^\/api\/posts\/product$/, async ({ body }) => posts.setProduct(String(body.id || ''), String(body.product || ''))],
    ['POST', /^\/api\/posts\/hide$/, async ({ body }) => posts.hide(String(body.id || ''))],
  ];
}
