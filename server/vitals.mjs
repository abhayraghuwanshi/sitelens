// Site health: an uptime probe every 5 minutes, PageSpeed Insights (lab + CrUX
// field data) daily, and the CrUX History API for p75 trends. Everything lands
// in .data/vitals.db. Nothing needs an API key: PSI runs on the Google sign-in
// token, and CrUX history comes from the public CrUX BigQuery dataset (monthly)
// billed to a site's BigQuery project. An optional key (Settings or
// GOOGLE_API_KEY) switches both to the keyed APIs and weekly CrUX history.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SourceError } from './github.mjs';

const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CRUX_HISTORY = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const CHECK_EVERY = 5 * MINUTE;
const KEEP_CHECKS = 31 * DAY;
const STRATEGIES = ['mobile', 'desktop'];
// The CrUX dataset updates monthly; re-query BigQuery at most this often.
const CRUX_BQ_EVERY = 7 * DAY;
const CRUX_BQ_SQL = `
SELECT CAST(date AS STRING) AS date, origin, device, p75_lcp, p75_inp, p75_cls
FROM \`chrome-ux-report.materialized.device_summary\`
WHERE origin IN UNNEST(@origins) AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 13 MONTH)
ORDER BY date`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS checks (
  host TEXT NOT NULL, at INTEGER NOT NULL, ok INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, error TEXT DEFAULT NULL,
  PRIMARY KEY (host, at)
);
CREATE TABLE IF NOT EXISTS psi (
  host TEXT NOT NULL, at INTEGER NOT NULL, strategy TEXT NOT NULL,
  score REAL, lcp REAL, cls REAL, tbt REAL, fcp REAL, inp REAL,
  field TEXT DEFAULT NULL, error TEXT DEFAULT NULL,
  PRIMARY KEY (host, at, strategy)
);
CREATE TABLE IF NOT EXISTS crux (host TEXT PRIMARY KEY, at INTEGER NOT NULL, data TEXT DEFAULT NULL, error TEXT DEFAULT NULL);
`;

// Core Web Vitals thresholds (web.dev): [good up to, poor above].
export const THRESHOLDS = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  tbt: [200, 600],
  ttfb: [800, 1800],
};

export function rate(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t || value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const v = Number(value);
  return v <= t[0] ? 'good' : v <= t[1] ? 'needs-improvement' : 'poor';
}

// Uptime over [from, to): share of successful checks plus the gaps we know about.
export function uptimeStats(rows, from, to) {
  const inRange = rows.filter((r) => r.at >= from && r.at < to);
  const up = inRange.filter((r) => r.ok).length;
  const latencies = inRange.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  return {
    checks: inRange.length,
    up,
    down: inRange.length - up,
    pct: inRange.length ? up / inRange.length : null,
    avgMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    p95Ms: latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : null,
  };
}

// Fixed-width buckets for the timeline: state 'up' | 'partial' | 'down' | 'none'.
export function bucketChecks(rows, from, to, size) {
  const n = Math.max(1, Math.ceil((to - from) / size));
  const buckets = Array.from({ length: n }, (_, i) => ({ at: from + i * size, checks: 0, up: 0, msSum: 0 }));
  for (const r of rows) {
    const i = Math.floor((r.at - from) / size);
    if (i < 0 || i >= n) continue;
    const b = buckets[i];
    b.checks += 1;
    if (r.ok) {
      b.up += 1;
      b.msSum += r.ms;
    }
  }
  return buckets.map(({ at, checks, up, msSum }) => ({
    at,
    checks,
    up,
    state: !checks ? 'none' : up === checks ? 'up' : up === 0 ? 'down' : 'partial',
    avgMs: up ? Math.round(msSum / up) : null,
  }));
}

// PSI v5 → lab metrics from Lighthouse + CrUX field p75s (URL, else origin).
export function parsePsi(json) {
  const lh = json.lighthouseResult || {};
  const audits = lh.audits || {};
  const num = (id) => (Number.isFinite(audits[id]?.numericValue) ? audits[id].numericValue : null);
  const score = lh.categories?.performance?.score;
  const urlField = json.loadingExperience?.metrics && json.loadingExperience.origin_fallback !== true;
  const fieldSource = urlField ? json.loadingExperience : json.originLoadingExperience?.metrics ? json.originLoadingExperience : null;
  return {
    score: Number.isFinite(score) ? Math.round(score * 100) : null,
    lcp: num('largest-contentful-paint'),
    cls: num('cumulative-layout-shift'),
    tbt: num('total-blocking-time'),
    fcp: num('first-contentful-paint'),
    inp: num('interaction-to-next-paint'),
    field: fieldSource ? parseField(fieldSource, urlField ? 'url' : 'origin') : null,
  };
}

function parseField(exp, scope) {
  const m = exp.metrics;
  const p = (key, scale = 1) => (Number.isFinite(m[key]?.percentile) ? m[key].percentile / scale : null);
  return {
    scope,
    lcp: p('LARGEST_CONTENTFUL_PAINT_MS'),
    inp: p('INTERACTION_TO_NEXT_PAINT'),
    // PSI reports CLS ×100.
    cls: p('CUMULATIVE_LAYOUT_SHIFT_SCORE', 100),
    fcp: p('FIRST_CONTENTFUL_PAINT_MS'),
    ttfb: p('EXPERIMENTAL_TIME_TO_FIRST_BYTE'),
  };
}

// CrUX History → [{ date, lcp, inp, cls }] weekly p75s (date = period end).
export function parseCruxHistory(json) {
  const record = json.record || {};
  const periods = record.collectionPeriods || [];
  const series = (name) => record.metrics?.[name]?.percentilesTimeseries?.p75s || [];
  const lcp = series('largest_contentful_paint');
  const inp = series('interaction_to_next_paint');
  const cls = series('cumulative_layout_shift');
  const value = (v) => (v === null || v === undefined || v === 'NaN' ? null : Number(v));
  return periods.map((p, i) => ({
    date: ymd(p.lastDate),
    lcp: value(lcp[i]),
    inp: value(inp[i]),
    cls: value(cls[i]),
  }));
}

// CrUX BigQuery rows → [{ date, lcp, inp, cls }] monthly p75s. One row per month:
// the site's own origin before its www/apex twin, phone before desktop before tablet.
export function parseCruxBigQuery(rows, origin) {
  const rank = (r) => (r.origin === origin ? 0 : 3) + Math.max(0, ['phone', 'desktop', 'tablet'].indexOf(r.device));
  const best = new Map();
  for (const r of rows) {
    const current = best.get(r.date);
    if (!current || rank(r) < rank(current)) best.set(r.date, r);
  }
  const value = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  return [...best.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, lcp: value(r.p75_lcp), inp: value(r.p75_inp), cls: value(r.p75_cls) }));
}

export const twinOrigin = (host) => `https://${host.startsWith('www.') ? host.slice(4) : `www.${host}`}`;

const ymd = (d) => (d ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : '');

// "Error: fetch failed" hides the useful part in err.cause.
export function describeFetchError(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'Timed out';
  const cause = err?.cause;
  const code = cause?.code || err?.code || '';
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) return `TLS error: ${code}`;
  if (code === 'ENOTFOUND') return 'DNS lookup failed';
  if (code === 'ECONNREFUSED') return 'Connection refused';
  if (code) return code;
  return cause?.message || err?.message || 'Request failed';
}

export const hostsOf = (sites) => [...new Set(sites.filter((s) => !s.demo && s.host).map((s) => s.host.toLowerCase()))];

export function createVitals({ dbPath, store, env = process.env, getToken = async () => '', bigquery = null, fetchImpl = fetch, now = Date.now, timeoutMs = 15_000 }) {
  let db = null;
  let timers = [];
  const running = new Set();

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    // Added after the first release: where the CrUX history came from.
    if (!db.prepare('PRAGMA table_info(crux)').all().some((c) => c.name === 'source')) db.exec('ALTER TABLE crux ADD COLUMN source TEXT DEFAULT NULL');
    return db;
  }

  async function apiKey() {
    const { sources } = await store.get();
    if (sources?.googleApiKey) return { key: sources.googleApiKey, source: 'settings' };
    if (env.GOOGLE_API_KEY) return { key: env.GOOGLE_API_KEY, source: 'env' };
    return { key: '', source: '' };
  }

  async function hosts() {
    return hostsOf(await store.sites());
  }

  async function check(host) {
    const started = now();
    let row;
    try {
      const res = await fetchImpl(`https://${host}/`, {
        redirect: 'follow',
        headers: { 'User-Agent': 'SiteLens-Studio-uptime/1.0' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Read (and drop) the body so the latency covers the whole document.
      await res.arrayBuffer().catch(() => {});
      row = { ok: res.status < 400, status: res.status, ms: now() - started, error: res.status < 400 ? null : `HTTP ${res.status}` };
    } catch (err) {
      row = { ok: false, status: 0, ms: now() - started, error: describeFetchError(err) };
    }
    open().prepare('INSERT OR REPLACE INTO checks (host, at, ok, status, ms, error) VALUES (?, ?, ?, ?, ?, ?)')
      .run(host, started, row.ok ? 1 : 0, row.status, row.ms, row.error);
    return { host, at: started, ...row };
  }

  async function checkAll() {
    const list = await hosts();
    const results = await Promise.all(list.map((h) => check(h)));
    open().prepare('DELETE FROM checks WHERE at < ?').run(now() - KEEP_CHECKS);
    return results;
  }

  async function psi(host, strategy) {
    const { key } = await apiKey();
    const url = new URL(PSI);
    url.searchParams.set('url', `https://${host}/`);
    url.searchParams.set('strategy', strategy);
    url.searchParams.set('category', 'performance');
    const headers = {};
    if (key) url.searchParams.set('key', key);
    else {
      const token = await getToken().catch(() => '');
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const at = now();
    let row;
    try {
      const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(120_000) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(googleError(res.status, json, key ? 'key' : headers.Authorization ? 'oauth' : 'none'));
      row = { ...parsePsi(json), error: null };
    } catch (err) {
      row = { score: null, lcp: null, cls: null, tbt: null, fcp: null, inp: null, field: null, error: err.message };
    }
    open().prepare('INSERT OR REPLACE INTO psi (host, at, strategy, score, lcp, cls, tbt, fcp, inp, field, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(host, at, strategy, row.score, row.lcp, row.cls, row.tbt, row.fcp, row.inp, row.field ? JSON.stringify(row.field) : null, row.error);
    return { strategy, at, ...row };
  }

  // The project CrUX BigQuery queries are billed to: the first site with BigQuery set up.
  async function billingProject() {
    const site = (await store.sites()).find((s) => !s.demo && (s.bq?.billingProject || s.bq?.dataProject));
    return site ? site.bq.billingProject || site.bq.dataProject : '';
  }

  function saveCrux(host, at, data, error, source) {
    open().prepare('INSERT OR REPLACE INTO crux (host, at, data, error, source) VALUES (?, ?, ?, ?, ?)')
      .run(host, at, data ? JSON.stringify(data) : null, error, source);
    return { at, data, error, source };
  }

  async function cruxBigQuery(host, { force = false } = {}) {
    if (!bigquery) return { skipped: true };
    const project = await billingProject();
    if (!project) return saveCrux(host, now(), null, 'CrUX history comes from BigQuery’s public CrUX dataset on your Google sign-in. Set up BigQuery on a site in Settings so Studio has a project to run the query in.', 'bigquery');
    const previous = open().prepare('SELECT at, error, source FROM crux WHERE host = ?').get(host);
    if (!force && previous?.source === 'bigquery' && previous.at > now() - CRUX_BQ_EVERY && !previous.error?.startsWith('BigQuery:')) {
      return { skipped: true, cached: true };
    }
    const at = now();
    const origin = `https://${host}`;
    try {
      const { rows } = await bigquery.query({ project, sql: CRUX_BQ_SQL, params: { origins: [origin, twinOrigin(host)] }, location: 'US', maxBytes: 2e9 });
      const series = parseCruxBigQuery(rows, origin);
      return saveCrux(host, at, series.length ? series : null,
        series.length ? null : 'No monthly history yet: CrUX’s BigQuery dataset only lists origins with enough Chrome users each month. Solid badges come from PageSpeed’s current 28-day CrUX data.', 'bigquery');
    } catch (err) {
      return saveCrux(host, at, null, `BigQuery: ${err.message}`, 'bigquery');
    }
  }

  async function crux(host, options) {
    const { key } = await apiKey();
    if (!key) return cruxBigQuery(host, options);
    const at = now();
    let data = null;
    let error = null;
    try {
      const res = await fetchImpl(`${CRUX_HISTORY}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: `https://${host}`, metrics: ['largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift'] }),
        signal: AbortSignal.timeout(30_000),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 404) error = 'Not enough Chrome users yet — CrUX only publishes origins with sufficient traffic.';
      else if (!res.ok) throw new Error(googleError(res.status, json, 'key'));
      else data = parseCruxHistory(json);
    } catch (err) {
      error = err.message;
    }
    return saveCrux(host, at, data, error, 'api');
  }

  // PSI (both strategies) + CrUX for one host. One run per host at a time.
  async function audit(host, { force = false } = {}) {
    if (running.has(host)) throw new SourceError('A PageSpeed run for this site is already in progress.', { kind: 'validation' });
    running.add(host);
    try {
      const results = [];
      for (const strategy of STRATEGIES) results.push(await psi(host, strategy));
      const history = await crux(host, { force });
      return { psi: results, crux: history };
    } finally {
      running.delete(host);
    }
  }

  // Daily: audit hosts whose last PSI run is older than a day.
  async function auditStale() {
    const last = open().prepare('SELECT MAX(at) AS at FROM psi WHERE host = ?');
    for (const host of await hosts()) {
      if (running.has(host)) continue;
      if ((last.get(host)?.at || 0) > now() - DAY) continue;
      await audit(host).catch(() => {});
    }
  }

  function hostRows(host, from) {
    return open().prepare('SELECT at, ok, status, ms, error FROM checks WHERE host = ? AND at >= ? ORDER BY at').all(host, from)
      .map((r) => ({ ...r, ok: Boolean(r.ok) }));
  }

  // Latest good run per strategy; a newer failure rides along as lastError so it
  // never blanks the last known numbers.
  function latestPsi(host) {
    const good = open().prepare('SELECT * FROM psi WHERE host = ? AND strategy = ? AND error IS NULL ORDER BY at DESC LIMIT 1');
    const newest = open().prepare('SELECT * FROM psi WHERE host = ? AND strategy = ? ORDER BY at DESC LIMIT 1');
    const out = {};
    for (const strategy of STRATEGIES) {
      const last = newest.get(host, strategy);
      if (!last) continue;
      const ok = last.error ? good.get(host, strategy) : last;
      out[strategy] = ok ? { ...psiRow(ok), lastError: last.error ? { at: last.at, message: last.error } : null } : psiRow(last);
    }
    return out;
  }

  function cruxFor(host) {
    const r = open().prepare('SELECT at, data, error, source FROM crux WHERE host = ?').get(host);
    return r ? { at: r.at, series: r.data ? JSON.parse(r.data) : [], error: r.error, source: r.source || 'api' } : null;
  }

  // The three Core Web Vitals to show: field p75 (CrUX via PSI mobile, else the
  // CrUX history's latest week), else lab values from Lighthouse mobile.
  function headline(latest, cruxRecord) {
    const mobile = latest.mobile;
    const field = mobile?.field || latest.desktop?.field;
    const lastWeek = cruxRecord?.series?.at(-1);
    const pick = (metric, labKey = metric) => {
      if (field?.[metric] !== null && field?.[metric] !== undefined) return { value: field[metric], source: 'field' };
      if (lastWeek?.[metric] !== null && lastWeek?.[metric] !== undefined) return { value: lastWeek[metric], source: 'field' };
      // Lighthouse can't measure INP; TBT is its lab stand-in.
      if (labKey && mobile?.[labKey] !== null && mobile?.[labKey] !== undefined) return { value: mobile[labKey], source: 'lab', metric: labKey };
      return null;
    };
    const out = {};
    for (const [metric, lab] of [['lcp', 'lcp'], ['inp', 'tbt'], ['cls', 'cls']]) {
      const p = pick(metric, lab);
      out[metric] = p ? { ...p, rating: rate(p.metric || metric, p.value) } : null;
    }
    return out;
  }

  async function summary() {
    const sites = await store.sites();
    const t = now();
    const key = await apiKey();
    return {
      key: { source: key.source },
      checkEveryMinutes: CHECK_EVERY / MINUTE,
      sites: sites.map((site) => {
        if (site.demo) return demoSummary(site, t);
        if (!site.host) return { id: site.id, host: '', uptime: null, vitals: null };
        const host = site.host.toLowerCase();
        const rows = hostRows(host, t - 30 * DAY);
        const last = rows.at(-1) || null;
        const latest = latestPsi(host);
        const cruxRecord = cruxFor(host);
        return {
          id: site.id,
          host,
          uptime: {
            last,
            day: uptimeStats(rows, t - DAY, t + 1),
            week: uptimeStats(rows, t - 7 * DAY, t + 1),
            month: uptimeStats(rows, t - 30 * DAY, t + 1),
          },
          score: latest.mobile?.score ?? null,
          vitals: headline(latest, cruxRecord),
          auditedAt: latest.mobile?.at || latest.desktop?.at || null,
        };
      }),
    };
  }

  async function detail(site, rangeKey = '7d') {
    const days = rangeKey === '30d' ? 30 : rangeKey === '24h' ? 1 : 7;
    const t = now();
    if (site.demo) return demoDetail(site, t, days);
    if (!site.host) throw new SourceError('This site has no host to monitor.', { kind: 'validation' });
    const host = site.host.toLowerCase();
    const from = t - days * DAY;
    const rows = hostRows(host, from);
    const size = days === 1 ? 15 * MINUTE : days <= 7 ? HOUR : 6 * HOUR;
    const latest = latestPsi(host);
    const cruxRecord = cruxFor(host);
    const psiHistory = open().prepare('SELECT * FROM psi WHERE host = ? AND at >= ? ORDER BY at').all(host, t - 90 * DAY).map(psiRow);
    return {
      host,
      range: { key: rangeKey, days, from, to: t, bucketMs: size },
      uptime: uptimeStats(rows, from, t + 1),
      buckets: bucketChecks(rows, from, t + 1, size),
      incidents: incidents(rows),
      latest,
      vitals: headline(latest, cruxRecord),
      psiHistory,
      crux: cruxRecord,
      key: { source: (await apiKey()).source },
      running: running.has(host),
    };
  }

  return {
    get dbPath() {
      return dbPath;
    },
    apiKey,
    check,
    checkAll,
    audit,
    summary,
    detail,
    start() {
      if (timers.length) return;
      const safe = (fn) => () => fn().catch((err) => console.error('[vitals]', err.message));
      safe(checkAll)();
      timers.push(setInterval(safe(checkAll), CHECK_EVERY));
      // Let the server settle before the first (slow) PSI runs.
      timers.push(setTimeout(safe(auditStale), 2 * MINUTE));
      timers.push(setInterval(safe(auditStale), HOUR));
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

function psiRow(r) {
  return {
    strategy: r.strategy,
    at: r.at,
    score: r.score,
    lcp: r.lcp,
    cls: r.cls,
    tbt: r.tbt,
    fcp: r.fcp,
    inp: r.inp,
    field: r.field ? JSON.parse(r.field) : null,
    error: r.error,
  };
}

// Consecutive failed checks → one incident.
export function incidents(rows) {
  const out = [];
  let open = null;
  for (const r of rows) {
    if (!r.ok) {
      if (!open) open = { start: r.at, end: r.at, checks: 0, error: r.error, status: r.status };
      open.end = r.at;
      open.checks += 1;
    } else if (open) {
      out.push({ ...open, resolvedAt: r.at });
      open = null;
    }
  }
  if (open) out.push({ ...open, resolvedAt: null });
  return out.reverse().slice(0, 20);
}

function googleError(status, json, auth) {
  const message = json?.error?.message || `HTTP ${status}`;
  if (status === 429) {
    if (auth === 'key') return `Quota exceeded: ${message}`;
    if (auth === 'oauth') return 'PageSpeed quota for your Google Cloud project is used up for now; Studio retries on the next daily run.';
    return 'Google’s shared PageSpeed quota is used up. Sign in with Google (Settings) so PageSpeed runs on your own project’s quota.';
  }
  if (status === 403 && /has not been used|disabled/i.test(message)) {
    const api = /chromeuxreport/i.test(message) ? 'Chrome UX Report API' : 'PageSpeed Insights API';
    const link = message.match(/https:\/\/console\.developers\.google\.com\/\S+/)?.[0]?.replace(/[.,]$/, '');
    return `Enable the ${api} in your Google Cloud project${link ? ` (${link})` : ''}, then run PageSpeed again.`;
  }
  if (status === 400 && /API key not valid/i.test(message)) return 'The API key isn’t valid. Check it in Settings → Site health.';
  return message;
}

// The demo site gets stable, plausible numbers so the views have something to show.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function demoRows(t, days) {
  const rnd = seeded(42);
  const rows = [];
  const start = Math.floor((t - days * DAY) / CHECK_EVERY) * CHECK_EVERY;
  for (let at = start; at < t; at += CHECK_EVERY) {
    const outage = at > t - 3 * DAY - 40 * MINUTE && at < t - 3 * DAY;
    const ms = Math.round(180 + rnd() * 120 + (new Date(at).getUTCHours() > 14 ? 60 : 0));
    rows.push(outage ? { at, ok: false, status: 503, ms: 0, error: 'HTTP 503' } : { at, ok: true, status: 200, ms, error: null });
  }
  return rows;
}

function demoCrux(t) {
  return Array.from({ length: 25 }, (_, i) => ({
    date: new Date(t - (24 - i) * 7 * DAY).toISOString().slice(0, 10),
    lcp: 3100 - i * 32 + (i % 3) * 40,
    inp: 260 - i * 3,
    cls: Number((0.14 - i * 0.003).toFixed(3)),
  }));
}

const demoLatest = (t) => ({
  mobile: { strategy: 'mobile', at: t - 3 * HOUR, score: 78, lcp: 2900, cls: 0.06, tbt: 240, fcp: 1500, inp: null, field: { scope: 'origin', lcp: 2340, inp: 188, cls: 0.07, fcp: 1400, ttfb: 620 }, error: null },
  desktop: { strategy: 'desktop', at: t - 3 * HOUR, score: 96, lcp: 1100, cls: 0.02, tbt: 30, fcp: 600, inp: null, field: null, error: null },
});

function demoSummary(site, t) {
  const rows = demoRows(t, 30);
  const latest = demoLatest(t);
  return {
    id: site.id,
    host: site.host,
    demo: true,
    uptime: {
      last: rows.at(-1),
      day: uptimeStats(rows, t - DAY, t + 1),
      week: uptimeStats(rows, t - 7 * DAY, t + 1),
      month: uptimeStats(rows, t - 30 * DAY, t + 1),
    },
    score: latest.mobile.score,
    vitals: {
      lcp: { value: 2340, source: 'field', rating: rate('lcp', 2340) },
      inp: { value: 188, source: 'field', rating: rate('inp', 188) },
      cls: { value: 0.07, source: 'field', rating: rate('cls', 0.07) },
    },
    auditedAt: latest.mobile.at,
  };
}

function demoDetail(site, t, days) {
  const rows = demoRows(t, days);
  const from = t - days * DAY;
  const size = days === 1 ? 15 * MINUTE : days <= 7 ? HOUR : 6 * HOUR;
  const latest = demoLatest(t);
  const rnd = seeded(7);
  const psiHistory = Array.from({ length: 14 }, (_, i) => ({ ...latest.mobile, at: t - (13 - i) * DAY, score: Math.round(70 + rnd() * 14), lcp: Math.round(2600 + rnd() * 700) }));
  return {
    host: site.host,
    demo: true,
    range: { key: `${days}d`, days, from, to: t, bucketMs: size },
    uptime: uptimeStats(rows, from, t + 1),
    buckets: bucketChecks(rows, from, t + 1, size),
    incidents: incidents(rows),
    latest,
    vitals: demoSummary(site, t).vitals,
    psiHistory,
    crux: { at: t - 5 * HOUR, series: demoCrux(t), error: null },
    key: { source: 'demo' },
    running: false,
  };
}

// Routes in the server's [method, regex, handler] shape.
export function vitalsRoutes({ vitals, store, siteOr404, fetchImpl = fetch }) {
  return [
    ['GET', /^\/api\/vitals$/, async () => vitals.summary()],
    ['GET', /^\/api\/vitals\/sites\/([\w-]+)$/, async ({ match, query }) => vitals.detail(await siteOr404(match[1]), query.get('range') || '7d')],
    ['POST', /^\/api\/vitals\/sites\/([\w-]+)\/run$/, async ({ match }) => {
      const site = await siteOr404(match[1]);
      if (site.demo) throw new SourceError('The demo site uses sample numbers — run PageSpeed on one of your own sites.', { kind: 'validation' });
      const host = site.host.toLowerCase();
      const [up, result] = await Promise.all([vitals.check(host), vitals.audit(host, { force: true })]);
      return { uptime: up, ...result };
    }],
    ['POST', /^\/api\/vitals\/check$/, async () => ({ checks: await vitals.checkAll() })],
    ['POST', /^\/api\/vitals\/key$/, async ({ body }) => {
      const key = String(body.key ?? '').trim();
      if (key) {
        await verifyKey(key, fetchImpl);
        await store.update((s) => {
          s.sources = { ...(s.sources || {}), googleApiKey: key };
        });
        return { ok: true, source: 'settings' };
      }
      await store.update((s) => {
        if (s.sources) delete s.sources.googleApiKey;
      });
      return { ok: true, source: (await vitals.apiKey()).source };
    }],
  ];
}

// A cheap CrUX call on a busy origin proves the key works and the API is enabled.
async function verifyKey(key, fetchImpl) {
  const res = await fetchImpl(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: 'https://www.google.com', metrics: ['largest_contentful_paint'] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.ok) return;
  const json = await res.json().catch(() => ({}));
  throw new SourceError(googleError(res.status, json, 'key'), { kind: 'validation' });
}
