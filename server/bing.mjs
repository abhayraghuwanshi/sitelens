// Bing Webmaster Tools: search clicks, impressions, queries, pages and crawl
// health for sites verified in Bing, plus URL submission. One API key (Bing
// Webmaster → Settings → API access) from Settings or BING_WEBMASTER_KEY.
//
// Bing keeps about six months of history, so every fetch upserts the daily
// traffic and crawl rows into .data/bing.db and the charts read from there:
// history keeps growing past Bing's window. Queries and pages are live.
//
// Bing's index also feeds DuckDuckGo, Copilot and ChatGPT search, so this is
// the nearest measurable proxy for visibility in AI answers.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EngineError } from './engines.mjs';
import { historyRange } from './github.mjs';
import { createCache } from './cache.mjs';

const BASE = 'https://ssl.bing.com/webmaster/api.svc/json';
const DAY = 86_400_000;
const HOUR = 3_600_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS traffic (site_url TEXT NOT NULL, date TEXT NOT NULL, clicks INTEGER, impressions INTEGER, PRIMARY KEY (site_url, date));
CREATE TABLE IF NOT EXISTS crawl (site_url TEXT NOT NULL, date TEXT NOT NULL, crawled INTEGER, errors INTEGER, in_index INTEGER, in_links INTEGER,
  code4xx INTEGER, code5xx INTEGER, blocked INTEGER, dns INTEGER, timeouts INTEGER, malware INTEGER, PRIMARY KEY (site_url, date));
`;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const bare = (url) => String(url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

/* ---------- pure helpers (unit-tested) ---------- */

// WCF JSON dates: "/Date(1698710400000)/" or "/Date(1698710400000-0700)/".
export function parseBingDate(value) {
  const m = String(value || '').match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (m) return Number(m[1]);
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

// Bing reports a day at local midnight in its own zone; noon-shift before taking the date.
export const bingDay = (value) => {
  const t = parseBingDate(value);
  return t === null ? null : isoDay(t + 12 * HOUR);
};

// The Bing site for a Studio host: same host ignoring scheme and www; verified first, then https.
export function matchSiteUrl(host, bingSites) {
  const want = bare(host);
  const candidates = bingSites.filter((s) => bare(s.url) === want);
  candidates.sort((a, b) => Number(b.verified) - Number(a.verified) || Number(b.url.startsWith('https')) - Number(a.url.startsWith('https')));
  return candidates[0]?.url || '';
}

// Queries (or pages) over a date window: rows are per query per period.
export function aggregateQueries(rows, from, to, limit = 50) {
  const out = new Map();
  for (const r of rows) {
    const day = bingDay(r.Date);
    if (day && ((from && day < from) || (to && day > to))) continue;
    const key = r.Query;
    if (!key) continue;
    const a = out.get(key) || { query: key, clicks: 0, impressions: 0, weighted: 0 };
    const impressions = Number(r.Impressions) || 0;
    a.clicks += Number(r.Clicks) || 0;
    a.impressions += impressions;
    a.weighted += (Number(r.AvgImpressionPosition) || 0) * impressions;
    out.set(key, a);
  }
  return [...out.values()]
    .map(({ weighted, ...a }) => ({ ...a, ctr: a.impressions ? a.clicks / a.impressions : 0, position: a.impressions ? weighted / a.impressions : null }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

export function bingError(json, status) {
  const code = json?.ErrorCode;
  const message = String(json?.Message || '').replace(/^ERROR!!!\s*/, '');
  if (code === 3 || /InvalidApiKey/i.test(message)) return new EngineError('Bing rejected the API key.', { status: 401, kind: 'bing-key', hint: 'Create a new one in Bing Webmaster Tools → Settings → API access.' });
  if (/NotAuthorized|UserNotAuthorized|not verified/i.test(message)) return new EngineError('This site isn’t verified in Bing Webmaster Tools for the key’s account.', { status: 403, kind: 'bing-site', hint: 'Add and verify it at bing.com/webmasters (importing from Google Search Console takes one click).' });
  if (/ThrottleUser|quota/i.test(message)) return new EngineError('Bing’s API quota is used up for now.', { status: 429, kind: 'bing-quota', hint: 'It resets daily.' });
  return new EngineError(message ? `Bing: ${message}` : `Bing Webmaster API HTTP ${status}`, { status: 502, kind: 'bing' });
}

/* ---------- service ---------- */

export function createBing({ dbPath, store, env = process.env, fetchImpl = fetch, now = Date.now, log = console }) {
  let db = null;
  let timers = [];
  let lastError = '';
  const cache = createCache();

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    return db;
  }

  async function config() {
    const s = await store.get();
    const saved = s.sources?.bingApiKey || '';
    return { key: saved || env.BING_WEBMASTER_KEY || '', source: saved ? 'settings' : env.BING_WEBMASTER_KEY ? 'env' : '', siteMap: s.bing?.siteMap || {} };
  }

  async function call(method, params = {}, { key, body } = {}) {
    const apiKey = key ?? (await config()).key;
    if (!apiKey) throw new EngineError('Bing Webmaster Tools isn’t connected.', { status: 409, kind: 'needs-bing', hint: 'Add an API key in Settings → Integrations → Bing.' });
    const url = new URL(`${BASE}/${method}`);
    url.searchParams.set('apikey', apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetchImpl(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json; charset=utf-8' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ErrorCode) throw bingError(json, res.status);
    return json.d;
  }

  async function sites({ fresh = false, key } = {}) {
    const list = await cache.wrap(`sites:${key || ''}`, 10 * 60_000, fresh, async () => (await call('GetUserSites', {}, { key })) || []);
    return list.map((s) => ({ url: s.Url, verified: Boolean(s.IsVerified) }));
  }

  async function siteUrlFor(site) {
    const cfg = await config();
    if (cfg.siteMap[site.id]) return cfg.siteMap[site.id];
    return matchSiteUrl(site.host, await sites());
  }

  // Fetches Bing's daily traffic and crawl rows and keeps them.
  async function refresh(siteUrl, { fresh = false } = {}) {
    return cache.wrap(`refresh:${siteUrl}`, 3 * HOUR, fresh, async () => {
      const [traffic, crawl] = await Promise.all([
        call('GetRankAndTrafficStats', { siteUrl }),
        call('GetCrawlStats', { siteUrl }).catch(() => []),
      ]);
      const d = open();
      const upT = d.prepare('INSERT OR REPLACE INTO traffic (site_url, date, clicks, impressions) VALUES (?, ?, ?, ?)');
      for (const r of traffic || []) {
        const day = bingDay(r.Date);
        if (day) upT.run(siteUrl, day, Number(r.Clicks) || 0, Number(r.Impressions) || 0);
      }
      const upC = d.prepare(`INSERT OR REPLACE INTO crawl (site_url, date, crawled, errors, in_index, in_links, code4xx, code5xx, blocked, dns, timeouts, malware)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const r of crawl || []) {
        const day = bingDay(r.Date);
        if (day) upC.run(siteUrl, day, r.CrawledPages ?? null, r.CrawlErrors ?? null, r.InIndex ?? null, r.InLinks ?? null,
          r.Code4xx ?? null, r.Code5xx ?? null, r.BlockedByRobotsTxt ?? null, r.DnsFailures ?? null, r.ConnectionTimeout ?? null, r.ContainsMalware ?? null);
      }
      lastError = '';
      return { traffic: (traffic || []).length, crawl: (crawl || []).length };
    });
  }

  function storedRange(siteUrl, start, end) {
    const d = open();
    return {
      traffic: d.prepare('SELECT * FROM traffic WHERE site_url = ? AND date BETWEEN ? AND ? ORDER BY date').all(siteUrl, start, end),
      crawl: d.prepare('SELECT * FROM crawl WHERE site_url = ? AND date BETWEEN ? AND ? ORDER BY date').all(siteUrl, start, end),
      first: d.prepare('SELECT MIN(date) AS d FROM traffic WHERE site_url = ?').get(siteUrl)?.d || null,
      last: d.prepare('SELECT MAX(date) AS d FROM traffic WHERE site_url = ?').get(siteUrl)?.d || null,
    };
  }

  async function overview(site, rangeKey = '28d', { fresh = false } = {}) {
    if (site.demo) throw new EngineError('Bing isn’t available for the sample site.', { status: 409, kind: 'needs-bing' });
    const siteUrl = await siteUrlFor(site);
    if (!siteUrl) {
      throw new EngineError(`${site.host} isn’t in your Bing Webmaster Tools account.`, {
        status: 409, kind: 'bing-site', hint: 'Add it at bing.com/webmasters (import from Google Search Console works), then refresh.',
      });
    }
    await refresh(siteUrl, { fresh });
    // Bing lags 1–3 days: end the range at the last day it reported.
    const stored = storedRange(siteUrl, '0000-00-00', '9999-99-99');
    const endMs = stored.last ? Date.parse(`${stored.last}T00:00:00Z`) : now() - 2 * DAY;
    const range = historyRange(rangeKey, endMs);
    const prevEnd = isoDay(Date.parse(`${range.start}T00:00:00Z`) - DAY);
    const prevStart = isoDay(Date.parse(`${range.start}T00:00:00Z`) - range.days * DAY);
    const cur = storedRange(siteUrl, range.start, range.end);
    const prev = storedRange(siteUrl, prevStart, prevEnd);
    const byDay = new Map(cur.traffic.map((r) => [r.date, r]));
    const known = (day) => stored.first && day >= stored.first;
    const series = {
      clicks: range.dates.map((day) => (known(day) ? byDay.get(day)?.clicks || 0 : null)),
      impressions: range.dates.map((day) => (known(day) ? byDay.get(day)?.impressions || 0 : null)),
    };
    const total = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

    const [queryRows, pageRows, quota] = await Promise.all([
      cache.wrap(`queries:${siteUrl}`, HOUR, fresh, () => call('GetQueryStats', { siteUrl })).catch(() => []),
      cache.wrap(`pages:${siteUrl}`, HOUR, fresh, () => call('GetPageStats', { siteUrl })).catch(() => []),
      cache.wrap(`quota:${siteUrl}`, HOUR, fresh, () => call('GetUrlSubmissionQuota', { siteUrl })).catch(() => null),
    ]);
    const queries = aggregateQueries(queryRows || [], range.start, range.end);
    const prevQueries = aggregateQueries(queryRows || [], prevStart, prevEnd, 1000);
    const position = (list) => {
      const imp = list.reduce((a, q) => a + q.impressions, 0);
      return imp ? list.reduce((a, q) => a + (q.position || 0) * q.impressions, 0) / imp : null;
    };
    const clicks = total(cur.traffic, 'clicks');
    const impressions = total(cur.traffic, 'impressions');
    const prevClicks = total(prev.traffic, 'clicks');
    const prevImpressions = total(prev.traffic, 'impressions');
    const crawlByDay = new Map(cur.crawl.map((r) => [r.date, r]));
    const latestCrawl = cur.crawl.at(-1) || storedRange(siteUrl, '0000-00-00', '9999-99-99').crawl.at(-1) || null;
    return {
      siteUrl,
      range: { ...range, lastReported: stored.last, historyFrom: stored.first },
      current: { clicks, impressions, ctr: impressions ? clicks / impressions : null, position: position(aggregateQueries(queryRows || [], range.start, range.end, 1000)) },
      previous: prev.traffic.length ? { clicks: prevClicks, impressions: prevImpressions, ctr: prevImpressions ? prevClicks / prevImpressions : null, position: position(prevQueries) } : null,
      series,
      queries,
      pages: aggregateQueries(pageRows || [], range.start, range.end, 30).map(({ query, ...p }) => ({ page: query, ...p })),
      crawl: {
        series: {
          crawled: range.dates.map((day) => crawlByDay.get(day)?.crawled ?? null),
          errors: range.dates.map((day) => crawlByDay.get(day)?.errors ?? null),
          inIndex: range.dates.map((day) => crawlByDay.get(day)?.in_index ?? null),
        },
        latest: latestCrawl && {
          date: latestCrawl.date, inIndex: latestCrawl.in_index, inLinks: latestCrawl.in_links, crawled: latestCrawl.crawled, errors: latestCrawl.errors,
          code4xx: latestCrawl.code4xx, code5xx: latestCrawl.code5xx, blocked: latestCrawl.blocked, dns: latestCrawl.dns, timeouts: latestCrawl.timeouts, malware: latestCrawl.malware,
        },
        errorsInRange: total(cur.crawl, 'errors'),
        errorsBefore: total(prev.crawl, 'errors'),
      },
      quota: quota ? { daily: quota.DailyQuota ?? null, monthly: quota.MonthlyQuota ?? null } : null,
    };
  }

  // Small summary for the product journey; null when Bing isn't set up for the site.
  async function summary(site, rangeKey) {
    if (site.demo || !(await config()).key) return null;
    try {
      const o = await overview(site, rangeKey);
      return { clicks: o.current.clicks, previous: o.previous?.clicks ?? null, impressions: o.current.impressions, crawlErrors: o.crawl.errorsInRange, crawlErrorsBefore: o.crawl.errorsBefore };
    } catch (err) {
      if (err.kind === 'bing-site') return null;
      throw err;
    }
  }

  async function submit(site, urls) {
    const siteUrl = await siteUrlFor(site);
    if (!siteUrl) throw new EngineError(`${site.host} isn’t in your Bing Webmaster Tools account.`, { status: 409, kind: 'bing-site' });
    const host = bare(siteUrl);
    const list = [...new Set((urls || []).map((u) => String(u).trim()).filter(Boolean))].slice(0, 100);
    const bad = list.find((u) => {
      try {
        return bare(new URL(u).host) !== host;
      } catch {
        return true;
      }
    });
    if (!list.length) throw new EngineError('Paste at least one URL.', { kind: 'validation' });
    if (bad) throw new EngineError(`“${bad}” isn’t a full URL on ${host}.`, { kind: 'validation' });
    await call('SubmitUrlBatch', {}, { body: { siteUrl, urlList: list } });
    cache.clear(`quota:${siteUrl}`);
    const quota = await call('GetUrlSubmissionQuota', { siteUrl }).catch(() => null);
    return { submitted: list.length, quota: quota ? { daily: quota.DailyQuota ?? null, monthly: quota.MonthlyQuota ?? null } : null };
  }

  async function saveKey(value) {
    const key = String(value ?? '').trim();
    if (key) {
      if (!/^[A-Za-z0-9]{16,64}$/.test(key)) throw new EngineError('That doesn’t look like a Bing Webmaster API key.', { kind: 'validation' });
      await sites({ key, fresh: true });
    }
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (key) s.sources.bingApiKey = key;
      else delete s.sources.bingApiKey;
    });
    cache.clear();
    lastError = '';
    return status();
  }

  async function setMatch(siteId, siteUrl) {
    await store.update((s) => {
      const map = { ...(s.bing?.siteMap || {}) };
      if (siteUrl) map[siteId] = String(siteUrl);
      else delete map[siteId];
      s.bing = { ...(s.bing || {}), siteMap: map };
    });
    return { ok: true };
  }

  async function status() {
    const cfg = await config();
    if (!cfg.key) return { source: '', sites: [], matches: [], error: '' };
    let list = [];
    try {
      list = await sites();
    } catch (err) {
      lastError = err.message;
    }
    const studio = (await store.sites()).filter((s) => !s.demo && s.host);
    return {
      source: cfg.source,
      sites: list,
      matches: studio.map((s) => ({ siteId: s.id, label: s.label, host: s.host, siteUrl: cfg.siteMap[s.id] || matchSiteUrl(s.host, list), manual: Boolean(cfg.siteMap[s.id]) })),
      error: lastError,
    };
  }

  // Keeps history growing even when nobody opens the Bing view.
  async function syncAll() {
    if (!(await config()).key) return;
    for (const site of (await store.sites()).filter((s) => !s.demo && s.host)) {
      const siteUrl = await siteUrlFor(site).catch(() => '');
      if (siteUrl) await refresh(siteUrl, { fresh: true }).catch((err) => { lastError = err.message; });
    }
  }

  return {
    status, saveKey, setMatch, overview, summary, submit, syncAll,
    start() {
      if (timers.length) return;
      const safe = () => syncAll().catch((err) => log.error('[bing]', err.message));
      timers.push(setTimeout(safe, 90_000));
      timers.push(setInterval(safe, 12 * HOUR));
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

export function bingRoutes({ bing, siteOr404 }) {
  return [
    ['GET', /^\/api\/bing\/status$/, async () => bing.status()],
    ['POST', /^\/api\/bing\/key$/, async ({ body }) => bing.saveKey(body.key)],
    ['POST', /^\/api\/bing\/match$/, async ({ body }) => bing.setMatch(String(body.siteId || ''), body.siteUrl || '')],
    ['GET', /^\/api\/bing\/sites\/([\w-]+)$/, async ({ match, query }) => bing.overview(await siteOr404(match[1]), query.get('range') || '28d', { fresh: query.has('fresh') })],
    ['POST', /^\/api\/bing\/sites\/([\w-]+)\/submit$/, async ({ match, body }) => bing.submit(await siteOr404(match[1]), body.urls)],
  ];
}
