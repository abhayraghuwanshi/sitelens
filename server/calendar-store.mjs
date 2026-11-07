// Local daily history for the calendar (and the MCP server): GA4 and Search
// Console numbers per site per day in .data/calendar.db, fetched once and then
// kept current with small deltas.
//
//  - Totals (sessions, users, views; clicks, impressions): the first sync pulls
//    ~14 months in one report per source. After that only the days that can
//    still change are re-fetched: GA4 revises the last 3 days, Search Console
//    fills in over about 5.
//  - Breakdowns (sessions by source and landing page, clicks by query): fetched
//    per day on first use and kept, the top 100 rows per day. The daily sync
//    adds the past week's, so history builds up going forward.
//  - A site whose property, host, subdomain setting or Search Console property
//    changes starts over: rows from the old setup would mix two definitions.
//
// When Google can't be reached, reads fall back to what's stored. Reads whose
// range is already stored answer from it at once; the delta that brings it up
// to date runs behind them (and every 30 minutes on its own).

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';
import { querySearchAnalytics, hostPageFilter } from '../shared/sitelens/gsc.js';
import { normDate, localDay } from './alerts.mjs';
import { markStale, wantsWait, detached } from './cache.mjs';

const DAY = 86_400_000;
export const HISTORY_DAYS = 425;
const GA_SETTLE = 3;
const SC_SETTLE = 5;
const FRESH_MS = 30 * 60_000;
const TOP = 100;
const CHUNK_DAYS = 31;

export const DIMS = {
  source: { engine: 'ga4', field: 'sessionSource', settle: GA_SETTLE },
  page: { engine: 'ga4', field: 'landingPage', settle: GA_SETTLE },
  query: { engine: 'gsc', field: 'query', settle: SC_SETTLE },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS days (site TEXT NOT NULL, date TEXT NOT NULL, sessions INTEGER, users INTEGER, views INTEGER, PRIMARY KEY (site, date));
CREATE TABLE IF NOT EXISTS search_days (site TEXT NOT NULL, date TEXT NOT NULL, clicks INTEGER, impressions INTEGER, PRIMARY KEY (site, date));
CREATE TABLE IF NOT EXISTS breakdown (site TEXT NOT NULL, date TEXT NOT NULL, dim TEXT NOT NULL, key TEXT NOT NULL, value REAL, PRIMARY KEY (site, date, dim, key));
CREATE TABLE IF NOT EXISTS breakdown_days (site TEXT NOT NULL, date TEXT NOT NULL, dim TEXT NOT NULL, fetched_at INTEGER, PRIMARY KEY (site, date, dim));
CREATE TABLE IF NOT EXISTS sync (site TEXT PRIMARY KEY, fingerprint TEXT, ga_from TEXT, ga_settled TEXT, ga_at INTEGER, sc_from TEXT, sc_settled TEXT, sc_last TEXT, sc_at INTEGER, error TEXT);
`;

/* ---------- Pure helpers (unit-tested) ---------- */

export function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

// What a site's stored rows depend on; any change invalidates them.
export function fingerprint(site) {
  return JSON.stringify([site.propertyId || '', site.host || '', Boolean(site.includeSubdomains), site.searchSite || '']);
}

// Inclusive [from, to] split into spans of at most `size` days.
export function chunks(from, to, size = CHUNK_DAYS) {
  const out = [];
  for (let start = from; start <= to; start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    out.push([start, end < to ? end : to]);
  }
  return out;
}

// Days in [from, to] that need a (re)fetch: never fetched, or still able to
// change and fetched longer ago than `freshMs`.
export function staleDays(fetched, { from, to, today, settle, now, freshMs = FRESH_MS }) {
  const settledThrough = addDays(today, -settle);
  const out = [];
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
    const at = fetched.get(d);
    if (at === undefined || (d > settledThrough && now - at > freshMs)) out.push(d);
  }
  return out;
}

// Top `limit` rows per day by value.
export function topPerDay(rows, limit = TOP) {
  const byDay = new Map();
  for (const r of rows) {
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date).push(r);
  }
  return [...byDay.values()].flatMap((list) => list.sort((a, b) => b.value - a.value).slice(0, limit));
}

/* ---------- The store ---------- */

export function createCalendarStore({ dbPath, auth, report = runReport, search = querySearchAnalytics, store = null, now = () => Date.now(), log = console }) {
  let db = null;
  let timers = [];
  const running = new Map();

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    return db;
  }

  function tx(fn) {
    const d = open();
    d.exec('BEGIN');
    try {
      fn(d);
      d.exec('COMMIT');
    } catch (err) {
      d.exec('ROLLBACK');
      throw err;
    }
  }

  // One sync per site and kind at a time; callers share the in-flight one.
  function once(key, fn) {
    if (running.has(key)) return running.get(key);
    const p = fn().finally(() => running.delete(key));
    running.set(key, p);
    return p;
  }

  function state(site) {
    const d = open();
    const fp = fingerprint(site);
    const row = d.prepare('SELECT * FROM sync WHERE site = ?').get(site.id);
    if (row && row.fingerprint === fp) return row;
    tx((t) => {
      for (const table of ['days', 'search_days', 'breakdown', 'breakdown_days', 'sync']) t.prepare(`DELETE FROM ${table} WHERE site = ?`).run(site.id);
      t.prepare('INSERT INTO sync (site, fingerprint) VALUES (?, ?)').run(site.id, fp);
    });
    return d.prepare('SELECT * FROM sync WHERE site = ?').get(site.id);
  }

  function setState(site, fields) {
    const keys = Object.keys(fields);
    open().prepare(`UPDATE sync SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE site = ?`).run(...keys.map((k) => fields[k]), site.id);
  }

  /* --- fetchers --- */

  async function fetchTraffic(site, from, to) {
    const res = await report({
      token: await auth.token(),
      propertyId: site.propertyId,
      body: {
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: hostFilter(site.host, { includeSubdomains: site.includeSubdomains }),
        limit: 1000,
      },
    });
    return res.rows.map((r) => ({ date: normDate(r.date), sessions: r.sessions || 0, users: r.activeUsers || 0, views: r.screenPageViews || 0 }));
  }

  function searchBody(site, from, to, dimensions, rowLimit) {
    const filter = hostPageFilter(site.searchSite, site.host, { includeSubdomains: site.includeSubdomains });
    return { startDate: from, endDate: to, dimensions, rowLimit, ...(filter ? { dimensionFilterGroups: [{ groupType: 'and', filters: [filter] }] } : {}) };
  }

  async function fetchSearch(site, from, to) {
    const rows = await search({ token: await auth.token(), siteUrl: site.searchSite, body: searchBody(site, from, to, ['date'], 1000) });
    return rows.map((r) => ({ date: r.key, clicks: r.clicks || 0, impressions: r.impressions || 0 }));
  }

  async function fetchBreakdown(site, dim, from, to) {
    const spec = DIMS[dim];
    if (spec.engine === 'gsc') {
      const rows = await search({ token: await auth.token(), siteUrl: site.searchSite, body: searchBody(site, from, to, ['date', 'query'], 25_000) });
      return rows.map((r) => ({ date: r.keys[0], key: r.keys[1] || '', value: r.clicks || 0 }));
    }
    const res = await report({
      token: await auth.token(),
      propertyId: site.propertyId,
      body: {
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: 'date' }, { name: spec.field }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: hostFilter(site.host, { includeSubdomains: site.includeSubdomains }),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 100_000,
      },
    });
    return res.rows.map((r) => ({ date: normDate(r.date), key: r[spec.field] || '(not set)', value: r.sessions || 0 }));
  }

  /* --- totals --- */

  // GA4 omits days with no sessions, so a fetched span is replaced as a whole.
  function replaceSpan(table, site, from, to, rows, columns) {
    tx((t) => {
      t.prepare(`DELETE FROM ${table} WHERE site = ? AND date BETWEEN ? AND ?`).run(site.id, from, to);
      const insert = t.prepare(`INSERT OR REPLACE INTO ${table} (site, date, ${columns.join(', ')}) VALUES (?, ?, ${columns.map(() => '?').join(', ')})`);
      for (const r of rows) if (r.date >= from && r.date <= to) insert.run(site.id, r.date, ...columns.map((c) => r[c]));
    });
  }

  // Brings stored traffic up to date and back to `from`. Returns false when there's nothing to sync.
  function syncTraffic(site, { from = '', force = false } = {}) {
    if (!site.propertyId || site.demo) return Promise.resolve(false);
    return once(`ga:${site.id}`, async () => {
      const s = state(site);
      const today = localDay(now());
      const start = s.ga_from || addDays(today, -HISTORY_DAYS);
      const want = from && from < start ? from : start;
      if (!s.ga_from || want < s.ga_from) {
        const end = s.ga_from ? addDays(s.ga_from, -1) : today;
        replaceSpan('days', site, want, end, await fetchTraffic(site, want, end), ['sessions', 'users', 'views']);
        setState(site, { ga_from: want, ...(s.ga_from ? {} : { ga_settled: addDays(today, -GA_SETTLE), ga_at: now() }) });
        if (!s.ga_from) return true;
      }
      const fresh = s.ga_at && now() - s.ga_at < FRESH_MS && localDay(s.ga_at) === today;
      if (fresh && !force) return true;
      const deltaFrom = addDays(s.ga_settled || addDays(today, -GA_SETTLE), 1);
      replaceSpan('days', site, deltaFrom, today, await fetchTraffic(site, deltaFrom, today), ['sessions', 'users', 'views']);
      setState(site, { ga_settled: addDays(today, -GA_SETTLE), ga_at: now(), error: null });
      return true;
    });
  }

  function syncSearch(site, { from = '', force = false } = {}) {
    if (!site.searchSite || site.demo) return Promise.resolve(false);
    return once(`sc:${site.id}`, async () => {
      const s = state(site);
      const today = localDay(now());
      const start = s.sc_from || addDays(today, -HISTORY_DAYS);
      const want = from && from < start ? from : start;
      let last = s.sc_last || '';
      const note = (rows) => {
        for (const r of rows) if (r.date > last) last = r.date;
      };
      if (!s.sc_from || want < s.sc_from) {
        const end = s.sc_from ? addDays(s.sc_from, -1) : today;
        const rows = await fetchSearch(site, want, end);
        note(rows);
        replaceSpan('search_days', site, want, end, rows, ['clicks', 'impressions']);
        setState(site, { sc_from: want, sc_last: last || null, ...(s.sc_from ? {} : { sc_settled: settledSearch(today, last), sc_at: now() }) });
        if (!s.sc_from) return true;
      }
      const fresh = s.sc_at && now() - s.sc_at < FRESH_MS && localDay(s.sc_at) === today;
      if (fresh && !force) return true;
      const deltaFrom = addDays(s.sc_settled || addDays(today, -SC_SETTLE), 1);
      const rows = await fetchSearch(site, deltaFrom, today);
      note(rows);
      replaceSpan('search_days', site, deltaFrom, today, rows, ['clicks', 'impressions']);
      setState(site, { sc_settled: settledSearch(today, last), sc_last: last || null, sc_at: now() });
      return true;
    });
  }

  // A search day is final once it's both reported and past the settle window.
  function settledSearch(today, last) {
    const cutoff = addDays(today, -SC_SETTLE);
    return last && last < cutoff ? last : cutoff;
  }

  // Stored rows cover the request: answer from them now, and run `sync` behind
  // it when it has anything to do. The web app's follow-up (X-Studio-Wait) waits for it.
  async function behind(needed, sync, onError) {
    if (!needed) return;
    const p = detached(sync).then(() => true, (err) => (onError(err), false));
    // A follow-up whose sync failed stays stale, so the web app doesn't ask again.
    if (!wantsWait()) markStale(p);
    else if (!(await p)) markStale(Promise.resolve());
  }

  function due(at) {
    return !(at && now() - at < FRESH_MS && localDay(at) === localDay(now()));
  }

  // The calendar's shape: { ga: Map date → {sessions, users, views} | null, sc: { values, last } | { error } | null }.
  // A failed sync still answers from stored rows when they cover the range.
  async function series(site, from, to, { force = false } = {}) {
    let ga = null;
    if (site.propertyId) {
      const stored = site.demo ? {} : state(site);
      if (!force && stored.ga_from && from >= stored.ga_from) {
        await behind(due(stored.ga_at), () => syncTraffic(site), (err) => {
          setState(site, { error: err.message });
          log.warn?.(`  Calendar: ${site.label} served from local history (${err.message})`);
        });
      } else try {
        await syncTraffic(site, { from, force });
      } catch (err) {
        const s = state(site);
        setState(site, { error: err.message });
        if (!s.ga_from || from < s.ga_from) throw err;
        log.warn?.(`  Calendar: ${site.label} served from local history (${err.message})`);
      }
      ga = new Map(open().prepare('SELECT date, sessions, users, views FROM days WHERE site = ? AND date BETWEEN ? AND ?').all(site.id, from, to)
        .map((r) => [r.date, { sessions: r.sessions, users: r.users, views: r.views }]));
    }
    let sc = null;
    if (site.searchSite) {
      const stored = site.demo ? {} : state(site);
      if (!force && stored.sc_from && from >= stored.sc_from) {
        await behind(due(stored.sc_at), () => syncSearch(site), () => {});
      } else try {
        await syncSearch(site, { from, force });
      } catch (err) {
        const s = state(site);
        if (!s.sc_from || from < s.sc_from) return { ga, sc: { error: err.message } };
      }
      const s = state(site);
      const values = new Map(open().prepare('SELECT date, clicks FROM search_days WHERE site = ? AND date BETWEEN ? AND ?').all(site.id, from, to).map((r) => [r.date, r.clicks]));
      sc = { values, last: s.sc_last || '' };
    }
    return { ga, sc };
  }

  /* --- breakdowns --- */

  function ensureBreakdown(site, dim, from, to) {
    const spec = DIMS[dim];
    if (!spec) throw new Error(`Unknown breakdown: ${dim}`);
    if (site.demo || (spec.engine === 'gsc' ? !site.searchSite : !site.propertyId)) return Promise.resolve(false);
    return once(`bd:${site.id}:${dim}:${from}:${to}`, async () => {
      state(site);
      const today = localDay(now());
      const fetched = new Map(open().prepare('SELECT date, fetched_at FROM breakdown_days WHERE site = ? AND dim = ? AND date BETWEEN ? AND ?')
        .all(site.id, dim, from, to).map((r) => [r.date, r.fetched_at]));
      const missing = staleDays(fetched, { from, to, today, settle: spec.settle, now: now() });
      if (!missing.length) return true;
      for (const [a, b] of chunks(missing[0], missing.at(-1))) {
        const rows = topPerDay(await fetchBreakdown(site, dim, a, b));
        const t0 = now();
        tx((t) => {
          t.prepare('DELETE FROM breakdown WHERE site = ? AND dim = ? AND date BETWEEN ? AND ?').run(site.id, dim, a, b);
          const insert = t.prepare('INSERT OR REPLACE INTO breakdown (site, date, dim, key, value) VALUES (?, ?, ?, ?, ?)');
          for (const r of rows) if (r.date >= a && r.date <= b) insert.run(site.id, r.date, dim, r.key, r.value);
          const mark = t.prepare('INSERT OR REPLACE INTO breakdown_days (site, date, dim, fetched_at) VALUES (?, ?, ?, ?)');
          for (let d = a; d <= b && d <= today; d = addDays(d, 1)) mark.run(site.id, d, dim, t0);
        });
      }
      return true;
    });
  }

  // Rows { date, key, value } for [from, to], fetching what isn't stored yet.
  async function breakdown(site, dim, from, to) {
    const spec = DIMS[dim];
    if (!spec) throw new Error(`Unknown breakdown: ${dim}`);
    if (!site.demo) state(site); // a changed setup drops its old rows first
    const today = localDay(now());
    const fetched = new Map(open().prepare('SELECT date, fetched_at FROM breakdown_days WHERE site = ? AND dim = ? AND date BETWEEN ? AND ?')
      .all(site.id, dim, from, to).map((r) => [r.date, r.fetched_at]));
    const missing = staleDays(fetched, { from, to, today, settle: spec.settle, now: now() });
    // Every day stored before, only recent ones due again: refresh those behind the answer.
    if (missing.every((d) => fetched.has(d))) {
      await behind(missing.length > 0, () => ensureBreakdown(site, dim, from, to), (err) =>
        log.warn?.(`  Calendar: ${site.label} ${dim} breakdown served from local history (${err.message})`));
    } else try {
      await ensureBreakdown(site, dim, from, to);
    } catch (err) {
      const have = open().prepare('SELECT COUNT(*) AS n FROM breakdown_days WHERE site = ? AND dim = ? AND date BETWEEN ? AND ?').get(site.id, dim, from, to).n;
      if (!have) throw err;
      log.warn?.(`  Calendar: ${site.label} ${dim} breakdown served from local history (${err.message})`);
    }
    return open().prepare('SELECT date, key, value FROM breakdown WHERE site = ? AND dim = ? AND date BETWEEN ? AND ? ORDER BY date, value DESC').all(site.id, dim, from, to);
  }

  /* --- background --- */

  // Daily: totals deltas plus the past week's breakdowns for every real site.
  async function syncAll() {
    if (!store) return [];
    const results = [];
    const today = localDay(now());
    for (const site of (await store.sites()).filter((s) => !s.demo)) {
      const r = { id: site.id };
      try {
        await syncTraffic(site, { force: true });
        await syncSearch(site, { force: true });
        for (const dim of Object.keys(DIMS)) await ensureBreakdown(site, dim, addDays(today, -7), addDays(today, -1));
        r.ok = true;
      } catch (err) {
        r.error = err.message;
        if (err.kind !== 'auth') log.warn?.(`  Calendar sync ${site.label}: ${err.message}`);
      }
      results.push(r);
    }
    return results;
  }

  function forget(siteId) {
    tx((t) => {
      for (const table of ['days', 'search_days', 'breakdown', 'breakdown_days', 'sync']) t.prepare(`DELETE FROM ${table} WHERE site = ?`).run(siteId);
    });
  }

  function status() {
    const rows = open().prepare(`SELECT s.site, s.ga_from, s.ga_at, s.sc_from, s.sc_last, s.sc_at, s.error,
      (SELECT COUNT(*) FROM days d WHERE d.site = s.site) AS days,
      (SELECT COUNT(*) FROM breakdown_days b WHERE b.site = s.site) AS breakdown_days
      FROM sync s`).all();
    return { path: dbPath, sites: rows };
  }

  return {
    series,
    breakdown,
    syncTraffic,
    syncSearch,
    ensureBreakdown,
    syncAll,
    // Resolves once background syncs have finished (for tests).
    idle: () => Promise.allSettled([...running.values()]),
    forget,
    status,
    start() {
      if (timers.length) return;
      const safe = () => syncAll().catch((err) => log.warn?.(`  Calendar sync: ${err.message}`));
      timers.push(setTimeout(safe, 15_000));
      timers.push(setInterval(safe, FRESH_MS));
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
