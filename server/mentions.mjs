// Mentions: where people talk about your sites, repos and extensions.
//
//  - Hacker News: Algolia's public search API, no key. Queries run with
//    typoTolerance=false and every hit is checked for the literal term, because
//    Algolia's fuzzy matching otherwise turns "cooldesk" into "Coindesk".
//  - Reddit: the official OAuth API only (an app's client ID + secret from
//    reddit.com/prefs/apps, app-only "client_credentials" grant). Reddit's
//    unauthenticated JSON answers 403 and Studio doesn't work around that.
//  - Product Hunt: GraphQL v2 with a developer token. The API has no search, so
//    it watches named launches (post slugs): votes, comments, launch day.
//
// Search terms come from what Studio already tracks (site hosts, product names,
// repo URLs, extension IDs) plus keywords from Settings. Everything lands in
// .data/mentions.db. The first sync of a term backfills a year and is marked
// backfill so alerts only fire for mentions found after that.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ValidationError } from './store.mjs';
import { historyRange } from './github.mjs';

const HN = 'https://hn.algolia.com/api/v1/search_by_date';
const REDDIT_TOKEN = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API = 'https://oauth.reddit.com';
const PH = 'https://api.producthunt.com/v2/api/graphql';
const USER_AGENT = 'node:sitelens-studio:0.2 (local analytics dashboard)';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const BACKFILL = 365 * DAY;
export const SOURCES = { hn: 'Hacker News', reddit: 'Reddit', ph: 'Product Hunt' };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS mentions (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, kind TEXT NOT NULL,
  title TEXT, text TEXT, url TEXT, permalink TEXT, author TEXT, community TEXT,
  points INTEGER DEFAULT 0, comments INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL, first_seen INTEGER NOT NULL,
  term TEXT, scopes TEXT, backfill INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS mentions_created ON mentions (created_at);
CREATE TABLE IF NOT EXISTS synced_terms (source TEXT NOT NULL, term TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (source, term));
`;

const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&#x2F;/g, '/').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/* ---------- Pure helpers (unit-tested) ---------- */

// [{ term, scopes, origin }] from sites, products, extensions, each site's
// .sitelens.yml brand names (`declared`: { siteId: [names] }) and Settings keywords.
// Generic terms are skipped: a term must be 4+ characters.
export function deriveTerms({ sites = [], products = [], extensions = [], keywords = [], declared = {} }) {
  const terms = new Map();
  const add = (term, scopes, origin) => {
    const t = String(term || '').trim().toLowerCase();
    if (t.length < 4) return;
    const entry = terms.get(t) || { term: t, scopes: [], origins: [] };
    for (const s of scopes) if (s && !entry.scopes.includes(s)) entry.scopes.push(s);
    if (!entry.origins.includes(origin)) entry.origins.push(origin);
    terms.set(t, entry);
  };
  for (const site of sites) if (!site.demo && site.host) add(bareHost(site.host), [`site:${site.id}`], 'site');
  for (const p of products) {
    const scopes = [p.siteId && `site:${p.siteId}`, ...(p.repos || []).map((r) => `repo:${r}`), ...(p.extensionIds || []).map((e) => `ext:${e}`)];
    add(p.label, scopes, 'product');
    for (const k of p.keywords || []) add(k, scopes, 'product');
    for (const r of p.repos || []) add(`github.com/${r}`, [`repo:${r}`], 'repo');
  }
  for (const e of extensions) add(e.id, [`ext:${e.id}`], 'extension');
  for (const [siteId, names] of Object.entries(declared)) for (const n of names) add(n, [`site:${siteId}`], 'config');
  for (const k of keywords) add(k.term, k.scope ? [k.scope] : [], 'keyword');
  return [...terms.values()];
}

// True when the term appears literally (case-insensitive) in any of the texts.
export function containsTerm(term, ...texts) {
  const t = term.toLowerCase();
  return texts.some((x) => stripHtml(x).toLowerCase().includes(t) || String(x || '').toLowerCase().includes(t));
}

export function parseHnHits(json, term) {
  return (json.hits || []).flatMap((h) => {
    const story = h._tags?.includes('story');
    const title = stripHtml(h.title || h.story_title || '');
    const text = stripHtml(h.story_text || h.comment_text || '');
    if (!containsTerm(term, h.title, h.url, h.story_text, h.comment_text)) return [];
    return [{
      id: `hn:${h.objectID}`,
      source: 'hn',
      kind: story ? 'story' : 'comment',
      title: story ? title : `Comment on “${title || 'a story'}”`,
      text: text.slice(0, 500),
      url: h.url || h.story_url || '',
      permalink: `https://news.ycombinator.com/item?id=${h.objectID}`,
      author: h.author || '',
      community: '',
      points: Number(h.points) || 0,
      comments: Number(h.num_comments) || 0,
      createdAt: Number(h.created_at_i) * 1000 || Date.parse(h.created_at),
    }];
  });
}

export function parseRedditListing(json, term, { literal = true } = {}) {
  return (json.data?.children || []).flatMap(({ data: d }) => {
    if (!d?.id) return [];
    if (literal && !containsTerm(term, d.title, d.selftext, d.url)) return [];
    return [{
      id: `reddit:${d.name || `t3_${d.id}`}`,
      source: 'reddit',
      kind: 'story',
      title: stripHtml(d.title),
      text: stripHtml(d.selftext).slice(0, 500),
      url: d.is_self ? '' : d.url || '',
      permalink: `https://www.reddit.com${d.permalink}`,
      author: d.author || '',
      community: d.subreddit_name_prefixed || (d.subreddit ? `r/${d.subreddit}` : ''),
      points: Number(d.score) || 0,
      comments: Number(d.num_comments) || 0,
      createdAt: Math.round(Number(d.created_utc) * 1000),
    }];
  });
}

export function parsePhPost(json) {
  const p = json.data?.post;
  if (!p) return [];
  const launch = {
    id: `ph:${p.id}`,
    source: 'ph',
    kind: 'launch',
    title: `${p.name} — ${p.tagline || 'launch'}`,
    text: '',
    url: p.website || '',
    permalink: p.url,
    author: '',
    community: '',
    points: Number(p.votesCount) || 0,
    comments: Number(p.commentsCount) || 0,
    createdAt: Date.parse(p.featuredAt || p.createdAt),
  };
  const comments = (p.comments?.edges || []).map(({ node: c }) => ({
    id: `ph:c${c.id}`,
    source: 'ph',
    kind: 'comment',
    title: `Comment on ${p.name}`,
    text: stripHtml(c.body).slice(0, 500),
    url: '',
    permalink: c.url || p.url,
    author: c.user?.username || '',
    community: '',
    points: Number(c.votesCount) || 0,
    comments: 0,
    createdAt: Date.parse(c.createdAt),
  }));
  return [launch, ...comments];
}

// Mentions per day for a date list: [{ date, hn, reddit, ph }].
export function dailyCounts(items, dates) {
  const index = new Map(dates.map((d, i) => [d, i]));
  const rows = dates.map((date) => ({ date, hn: 0, reddit: 0, ph: 0 }));
  for (const m of items) {
    const i = index.get(isoDay(m.createdAt));
    if (i !== undefined) rows[i][m.source] += 1;
  }
  return rows;
}

export function normalizeMentionSettings(input = {}) {
  const keywords = [];
  for (const k of input.keywords || []) {
    const term = String(k?.term ?? k ?? '').trim();
    if (!term) continue;
    if (term.length < 4) throw new ValidationError(`“${term}” is too short to search for; use 4+ characters.`);
    const scope = String(k?.scope || '').trim();
    if (scope && !/^(site|repo|ext):\S+$/.test(scope)) throw new ValidationError(`Unknown scope “${scope}”.`);
    keywords.push(scope ? { term, scope } : { term });
  }
  const phSlugs = [...new Set((input.phSlugs || []).map((s) => String(s).trim().toLowerCase()
    .replace(/^https?:\/\/(www\.)?producthunt\.com\/(posts|products)\//, '').replace(/[/?#].*$/, '')).filter(Boolean))];
  for (const slug of phSlugs) if (!/^[a-z0-9-]+$/.test(slug)) throw new ValidationError(`“${slug}” isn’t a Product Hunt post slug.`);
  return { keywords, phSlugs, minPoints: Math.max(0, Number(input.minPoints) || 0) };
}

/* ---------- Service ---------- */

export function createMentions({ dbPath, store, env = process.env, siteConfig = null, fetchImpl = fetch, now = Date.now, log = console }) {
  let db = null;
  let timers = [];
  let syncing = null;
  let redditToken = { value: '', expires: 0 };
  const status = { lastSync: 0, errors: {} };

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    return db;
  }

  async function settings() {
    return normalizeMentionSettings((await store.get()).mentions || {});
  }

  async function credentials() {
    const { sources = {} } = await store.get();
    return {
      reddit: {
        id: sources.redditClientId || env.REDDIT_CLIENT_ID || '',
        secret: sources.redditClientSecret || env.REDDIT_CLIENT_SECRET || '',
        source: sources.redditClientId ? 'settings' : env.REDDIT_CLIENT_ID ? 'env' : '',
      },
      ph: {
        token: sources.productHuntToken || env.PRODUCTHUNT_TOKEN || '',
        source: sources.productHuntToken ? 'settings' : env.PRODUCTHUNT_TOKEN ? 'env' : '',
      },
    };
  }

  async function terms() {
    const s = await store.get();
    const extensions = s.extensions || [];
    const sites = await store.sites();
    const declared = {};
    if (siteConfig) {
      for (const site of sites.filter((x) => !x.demo)) {
        const brand = (await siteConfig.applied(site))?.search?.brand;
        if (brand?.length) declared[site.id] = brand;
      }
    }
    return deriveTerms({ sites, products: s.products || [], extensions, keywords: (await settings()).keywords, declared });
  }

  async function getJson(url, init = {}) {
    const res = await fetchImpl(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) }, signal: AbortSignal.timeout(20_000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json.message || json.error_description || json.errors?.[0]?.message || json.error?.message || json.error || `HTTP ${res.status}`;
      const err = new Error(typeof message === 'string' ? message : `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function lastSynced(source, term) {
    return open().prepare('SELECT at FROM synced_terms WHERE source = ? AND term = ?').get(source, term)?.at || 0;
  }

  function save(items, { term, scopes, backfill }) {
    const t = now();
    const upsert = open().prepare(`INSERT INTO mentions (id, source, kind, title, text, url, permalink, author, community, points, comments, created_at, first_seen, term, scopes, backfill)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET points = excluded.points, comments = excluded.comments, title = excluded.title`);
    let added = 0;
    for (const m of items) {
      if (!Number.isFinite(m.createdAt)) continue;
      const before = open().prepare('SELECT 1 FROM mentions WHERE id = ?').get(m.id);
      upsert.run(m.id, m.source, m.kind, m.title, m.text, m.url, m.permalink, m.author, m.community, m.points, m.comments,
        m.createdAt, t, term, JSON.stringify(scopes), backfill ? 1 : 0);
      if (!before) added += 1;
    }
    return added;
  }

  function markSynced(source, term, at) {
    open().prepare('INSERT OR REPLACE INTO synced_terms (source, term, at) VALUES (?, ?, ?)').run(source, term, at);
  }

  async function syncHn(list) {
    let added = 0;
    for (const { term, scopes } of list) {
      const since = lastSynced('hn', term);
      const backfill = !since;
      const after = Math.floor(((since || now() - BACKFILL) - HOUR) / 1000);
      const url = new URL(HN);
      url.searchParams.set('query', term);
      url.searchParams.set('typoTolerance', 'false');
      url.searchParams.set('hitsPerPage', '100');
      url.searchParams.set('numericFilters', `created_at_i>${after}`);
      const started = now();
      added += save(parseHnHits(await getJson(url), term), { term, scopes, backfill });
      markSynced('hn', term, started);
    }
    return added;
  }

  async function redditAuth({ id, secret }) {
    if (redditToken.value && redditToken.expires > now() + MINUTE) return redditToken.value;
    const json = await getJson(REDDIT_TOKEN, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    redditToken = { value: json.access_token, expires: now() + (Number(json.expires_in) || 3600) * 1000 };
    return redditToken.value;
  }

  async function syncReddit(list, creds) {
    const token = await redditAuth(creds);
    let added = 0;
    for (const { term, scopes } of list) {
      const since = lastSynced('reddit', term);
      // Hosts search by link domain; everything else as an exact phrase.
      const isHost = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(term) && !term.startsWith('github.com/');
      const url = new URL(`${REDDIT_API}/search`);
      url.searchParams.set('q', isHost ? `site:${term}` : `"${term}"`);
      url.searchParams.set('sort', 'new');
      url.searchParams.set('limit', '100');
      url.searchParams.set('t', since ? 'month' : 'year');
      url.searchParams.set('raw_json', '1');
      const started = now();
      const items = parseRedditListing(await getJson(url, { headers: { Authorization: `Bearer ${token}` } }), term, { literal: !isHost });
      added += save(items, { term, scopes, backfill: !since });
      markSynced('reddit', term, started);
    }
    return added;
  }

  async function syncPh(slugs, { token }, list) {
    const query = `query($slug: String!) { post(slug: $slug) { id name tagline url website votesCount commentsCount createdAt featuredAt
      comments(first: 20) { edges { node { id body createdAt url votesCount user { username } } } } } }`;
    let added = 0;
    for (const slug of slugs) {
      const json = await getJson(PH, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { slug } }),
      });
      if (json.errors?.length) throw new Error(json.errors[0].message);
      if (!json.data?.post) throw new Error(`No Product Hunt post “${slug}”.`);
      const items = parsePhPost(json);
      // A launch belongs to the product whose name it carries, else no scope.
      const name = (json.data.post.name || '').toLowerCase();
      const scopes = list.find((t) => t.origins.includes('product') && t.term === name)?.scopes || [];
      const since = lastSynced('ph', slug);
      added += save(items, { term: `ph:${slug}`, scopes, backfill: !since });
      markSynced('ph', slug, now());
    }
    return added;
  }

  async function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      const list = await terms();
      const cfg = await settings();
      const creds = await credentials();
      const result = { added: {}, errors: {} };
      const attempt = async (source, fn) => {
        try {
          result.added[source] = await fn();
          delete status.errors[source];
        } catch (err) {
          const message = source === 'reddit' && [401, 403].includes(err.status)
            ? `Reddit refused the app credentials (${err.message}). Check the client ID and secret in Settings → Mentions.`
            : source === 'ph' && err.status === 401
              ? 'Product Hunt refused the token. Use a developer token from producthunt.com/v2/oauth/applications.'
              : err.message;
          result.errors[source] = status.errors[source] = message;
        }
      };
      if (list.length) await attempt('hn', () => syncHn(list));
      if (list.length && creds.reddit.id && creds.reddit.secret) await attempt('reddit', () => syncReddit(list, creds.reddit));
      if (cfg.phSlugs.length && creds.ph.token) await attempt('ph', () => syncPh(cfg.phSlugs, creds.ph, list));
      status.lastSync = now();
      return { at: status.lastSync, terms: list.length, ...result };
    })();
    try {
      return await syncing;
    } finally {
      syncing = null;
    }
  }

  function rows(from, to) {
    return open().prepare('SELECT * FROM mentions WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC').all(from, to).map(rowOut);
  }

  async function overview({ rangeKey = '28d', source = '', scope = '' } = {}) {
    const range = historyRange(rangeKey);
    const from = Date.parse(`${range.start}T00:00:00Z`);
    const to = Date.parse(`${range.end}T00:00:00Z`) + DAY;
    const { minPoints } = await settings();
    const all = rows(from, to).filter((m) => (!scope || m.scopes.includes(scope)) && (m.kind === 'comment' || m.points >= minPoints));
    const items = source ? all.filter((m) => m.source === source) : all;
    const dates = [];
    for (let t = from; t < to; t += DAY) dates.push(isoDay(t));
    const creds = await credentials();
    const cfg = await settings();
    return {
      range,
      items: items.slice(0, 300),
      daily: dailyCounts(all, dates),
      totals: Object.fromEntries(Object.keys(SOURCES).map((s) => [s, all.filter((m) => m.source === s).length])),
      top: [...all].filter((m) => m.kind !== 'comment').sort((a, b) => b.points - a.points).slice(0, 5),
      terms: await terms(),
      sources: {
        hn: { ready: true, error: status.errors.hn || '' },
        reddit: { ready: Boolean(creds.reddit.id && creds.reddit.secret), credentialSource: creds.reddit.source, error: status.errors.reddit || '' },
        ph: { ready: Boolean(creds.ph.token && cfg.phSlugs.length), hasToken: Boolean(creds.ph.token), credentialSource: creds.ph.source, slugs: cfg.phSlugs, error: status.errors.ph || '' },
      },
      lastSync: status.lastSync,
      syncing: Boolean(syncing),
    };
  }

  // Stories and launches posted in [from, to) under any of `scopes`, for the journey's cause drawer.
  async function between(from, to, scopes = []) {
    const { minPoints } = await settings();
    return rows(from, to).filter((m) => m.kind !== 'comment' && m.points >= minPoints && (!scopes.length || m.scopes.some((s) => scopes.includes(s))));
  }

  // New since `since` (first seen, not part of a backfill), for alerts.
  function newSince(since) {
    return open().prepare('SELECT * FROM mentions WHERE first_seen > ? AND backfill = 0 ORDER BY created_at').all(since).map(rowOut);
  }

  // Stories and launches as chart annotations, one per mention, under the first
  // requested scope it belongs to.
  async function annotations({ from, to, scopes }) {
    const { minPoints } = await settings();
    const start = from ? Date.parse(`${from}T00:00:00Z`) : 0;
    const end = to ? Date.parse(`${to}T00:00:00Z`) + DAY : now() + DAY;
    return rows(start, end).filter((m) => m.kind !== 'comment' && m.points >= minPoints).flatMap((m) => {
      const scope = scopes?.length ? m.scopes.find((s) => scopes.includes(s)) : m.scopes[0];
      if (scopes?.length && !scope) return [];
      return [{
        id: `mention:${m.id}`,
        date: isoDay(m.createdAt),
        label: `${SOURCES[m.source]}: ${m.title}${m.points ? ` (${m.points})` : ''}`,
        kind: 'mention',
        source: 'mentions',
        url: m.permalink,
        ...(scope ? { scope } : {}),
      }];
    });
  }

  async function saveSettings(input) {
    const cfg = normalizeMentionSettings(input);
    await store.update((s) => {
      s.mentions = cfg;
    });
    return cfg;
  }

  async function saveCredentials({ redditClientId, redditClientSecret, productHuntToken }) {
    const id = String(redditClientId ?? '').trim();
    const secret = String(redditClientSecret ?? '').trim();
    if (id && !secret) throw new ValidationError('Add the Reddit app’s secret too.');
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (redditClientId !== undefined) {
        if (id) Object.assign(s.sources, { redditClientId: id, redditClientSecret: secret });
        else {
          delete s.sources.redditClientId;
          delete s.sources.redditClientSecret;
        }
        redditToken = { value: '', expires: 0 };
      }
      if (productHuntToken !== undefined) {
        const token = String(productHuntToken).trim();
        if (token) s.sources.productHuntToken = token;
        else delete s.sources.productHuntToken;
      }
    });
    return sync();
  }

  return {
    get dbPath() {
      return dbPath;
    },
    sync,
    overview,
    between,
    // App-only Reddit token for other modules (My posts); '' when no app is configured.
    async redditToken() {
      const { reddit } = await credentials();
      return reddit.id && reddit.secret ? redditAuth(reddit) : '';
    },
    credentials,
    newSince,
    annotations,
    settings,
    saveSettings,
    saveCredentials,
    terms,
    start() {
      if (timers.length) return;
      const safe = () => sync().catch((err) => log.error('[mentions]', err.message));
      timers.push(setTimeout(safe, 45_000));
      timers.push(setInterval(safe, 30 * MINUTE));
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

function rowOut(r) {
  return {
    id: r.id,
    source: r.source,
    kind: r.kind,
    title: r.title,
    text: r.text,
    url: r.url,
    permalink: r.permalink,
    author: r.author,
    community: r.community,
    points: r.points,
    comments: r.comments,
    createdAt: r.created_at,
    firstSeen: r.first_seen,
    term: r.term,
    scopes: r.scopes ? JSON.parse(r.scopes) : [],
  };
}

export function mentionRoutes({ mentions }) {
  return [
    ['GET', /^\/api\/mentions$/, async ({ query }) =>
      mentions.overview({ rangeKey: query.get('range') || '28d', source: query.get('source') || '', scope: query.get('scope') || '' })],
    ['POST', /^\/api\/mentions\/sync$/, async () => mentions.sync()],
    ['GET', /^\/api\/mentions\/settings$/, async () => mentions.settings()],
    ['POST', /^\/api\/mentions\/settings$/, async ({ body }) => mentions.saveSettings(body)],
    ['POST', /^\/api\/mentions\/credentials$/, async ({ body }) => mentions.saveCredentials(body)],
  ];
}
