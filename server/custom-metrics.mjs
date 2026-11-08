// Custom metrics: daily numbers from your own stores (daily pings, signups,
// revenue…) charted next to GA4. Every connector answers a query with rows of
// one shape — `day, value[, dimension]` — so screens never care where a number
// came from. New storage kinds are new entries in CONNECTORS, not new screens.
//
// Connectors:
//  - d1: Cloudflare D1 over REST, POST /accounts/{account}/d1/database/{db}/query
//    with { sql, params }. Token: Settings, else CLOUDFLARE_API_TOKEN in .env.
//
// Queries are SELECT-only and get the window as bound parameters:
// {{start}} / {{end}} are 'YYYY-MM-DD' (end exclusive), {{start_ms}} / {{end_ms}}
// epoch milliseconds, {{start_s}} / {{end_s}} epoch seconds. One query covers
// the range and the period before it, so the delta costs nothing extra.

import { randomUUID } from 'node:crypto';
import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';

const DAY = 86_400_000;
const TTL = 15 * 60_000;
const MAX_ROWS = 20_000;
const TOP_DIMENSIONS = 5;
const RANGE_DAYS = { today: 1, '7d': 7, '28d': 28, '90d': 90, '1y': 365 };
const SUMMARIES = ['sum', 'average', 'latest'];

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export const CONNECTORS = {
  d1: {
    label: 'Cloudflare D1',
    secret: { key: 'cloudflareToken', env: 'CLOUDFLARE_API_TOKEN', label: 'Cloudflare API token' },
    fields: [
      { key: 'accountId', label: 'Account ID', pattern: /^[a-f0-9]{32}$/, hint: '32 hex characters, on the right of the Cloudflare dashboard’s Workers & Pages page.' },
      { key: 'databaseId', label: 'Database ID', pattern: /^[a-f0-9-]{36}$/, hint: 'A UUID: Storage & Databases → D1 → your database, or `database_id` in wrangler.toml.' },
    ],
    async run({ source, sql, params, secret, fetchImpl }) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${source.accountId}/d1/database/${source.databaseId}/query`;
      let res;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params }),
          signal: AbortSignal.timeout(25_000),
        });
      } catch (err) {
        throw new EngineError(`Couldn’t reach Cloudflare: ${err.message}`, { status: 502, kind: 'metric-source' });
      }
      const data = await res.json().catch(() => ({}));
      const message = data.errors?.map((e) => e.message).filter(Boolean).join(' ') || `Cloudflare returned ${res.status}.`;
      if (res.status === 401 || res.status === 403 || data.errors?.some((e) => e.code === 10000)) {
        throw new EngineError(`Cloudflare rejected the token: ${message}`, {
          status: 502,
          kind: 'metric-auth',
          hint: 'Create a token at dash.cloudflare.com/profile/api-tokens with Account → D1 → Read for this account, then save it in Settings → Custom metrics or set CLOUDFLARE_API_TOKEN in .env.',
        });
      }
      if (!res.ok || data.success === false) throw new EngineError(`D1: ${message}`, { status: 502, kind: 'metric-query' });
      const result = Array.isArray(data.result) ? data.result[data.result.length - 1] : data.result;
      return result?.results || [];
    },
  },
};

// ---------- window, placeholders and SQL guard ----------

// UTC days ending today; `week` is Monday through today, `yesterday` the one day
// before today. The previous window has the same length and ends the day before.
export function metricRange(rangeKey = '28d', now = Date.now()) {
  if (rangeKey === 'yesterday') {
    const r = metricRange('today', now - DAY);
    return { ...r, key: 'yesterday' };
  }
  const today = Date.parse(`${isoDay(now)}T00:00:00Z`);
  const days = rangeKey === 'week' ? ((new Date(today).getUTCDay() + 6) % 7) + 1 : RANGE_DAYS[rangeKey] || 28;
  const start = today - (days - 1) * DAY;
  const dates = Array.from({ length: days }, (_, i) => isoDay(start + i * DAY));
  return { key: (RANGE_DAYS[rangeKey] || rangeKey === 'week') ? rangeKey : '28d', days, start: dates[0], end: dates[days - 1], dates, prevStart: isoDay(start - days * DAY) };
}

const PLACEHOLDER = /\{\{\s*(start|end)(_ms|_s)?\s*\}\}/g;

// Swaps {{start}}-style placeholders for positional `?` params, in order.
export function bindWindow(sql, { from, to }) {
  const params = [];
  const ms = { start: Date.parse(`${from}T00:00:00Z`), end: Date.parse(`${to}T00:00:00Z`) + DAY };
  const bound = sql.replace(PLACEHOLDER, (_, edge, unit) => {
    params.push(unit === '_ms' ? ms[edge] : unit === '_s' ? Math.floor(ms[edge] / 1000) : isoDay(ms[edge]));
    return '?';
  });
  return { sql: bound, params };
}

// One read-only statement. Comments and string literals are blanked first so
// a `;` or keyword inside them doesn't count.
export function checkSelect(sql) {
  const body = String(sql || '').trim().replace(/;\s*$/, '');
  if (!body) throw new EngineError('Write a query that returns day and value columns.', { kind: 'validation' });
  const bare = body.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
  if (bare.includes(';')) throw new EngineError('Use a single statement.', { kind: 'validation' });
  if (!/^\s*(select|with)\b/i.test(bare)) throw new EngineError('Only SELECT queries can feed a metric.', { kind: 'validation' });
  if (/\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|reindex)\b|\breplace\s+into\b/i.test(bare)) {
    throw new EngineError('The query may only read: no INSERT, UPDATE, DELETE, PRAGMA or schema changes.', { kind: 'validation' });
  }
  return body;
}

// ---------- rows → series ----------

function toDay(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return isoDay(v < 1e11 ? v * 1000 : v);
  const s = String(v ?? '');
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? isoDay(parsed) : '';
}

// Accepts `day` (or `date`), `value`, and an optional `dimension`.
export function normalizeRows(rows) {
  if (!Array.isArray(rows)) throw new EngineError('The source returned no rows.', { kind: 'metric-query' });
  if (rows.length > MAX_ROWS) throw new EngineError(`The query returned ${rows.length} rows; group by day so it returns at most ${MAX_ROWS}.`, { kind: 'metric-query' });
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  const dayCol = cols.find((c) => /^(day|date)$/i.test(c));
  const valueCol = cols.find((c) => /^value$/i.test(c));
  const dimCol = cols.find((c) => /^dimension$/i.test(c));
  if (!dayCol || !valueCol) {
    throw new EngineError(`The query must return columns named day and value (it returned ${cols.join(', ') || 'none'}).`, {
      kind: 'metric-query',
      hint: 'Alias them, e.g. SELECT date(created_at) AS day, count(*) AS value … GROUP BY 1.',
    });
  }
  return rows.flatMap((r) => {
    const day = toDay(r[dayCol]);
    const value = Number(r[valueCol]);
    if (!day || !Number.isFinite(value)) return [];
    return [{ day, value, ...(dimCol && r[dimCol] != null && r[dimCol] !== '' ? { dimension: String(r[dimCol]) } : {}) }];
  });
}

function totalOf(values, mode) {
  const known = values.filter(Number.isFinite);
  if (!known.length) return null;
  if (mode === 'latest') return known[known.length - 1];
  const sum = known.reduce((a, b) => a + b, 0);
  return mode === 'average' ? sum / known.length : sum;
}

// Daily totals for the range (missing days are 0 for sums, gaps otherwise),
// the top dimensions, and totals for this and the previous period.
export function buildSeries(rows, range, summary = 'sum') {
  const fill = summary === 'sum' ? 0 : NaN;
  const byDay = new Map();
  const byDim = new Map();
  let prev = [];
  const prevByDay = new Map();
  for (const r of rows) {
    if (r.day >= range.start && r.day <= range.end) {
      byDay.set(r.day, (byDay.get(r.day) || 0) + r.value);
      if (r.dimension) {
        const d = byDim.get(r.dimension) || new Map();
        d.set(r.day, (d.get(r.day) || 0) + r.value);
        byDim.set(r.dimension, d);
      }
    } else if (r.day >= range.prevStart && r.day < range.start) {
      prevByDay.set(r.day, (prevByDay.get(r.day) || 0) + r.value);
    }
  }
  prev = [...prevByDay.keys()].sort().map((d) => prevByDay.get(d));
  const values = range.dates.map((d) => (byDay.has(d) ? byDay.get(d) : fill));
  const dimensions = [...byDim.entries()]
    .map(([name, days]) => ({ name, values: range.dates.map((d) => days.get(d) ?? fill), total: totalOf([...days.values()], summary) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_DIMENSIONS);
  return { dates: range.dates, values, dimensions, total: totalOf(values, summary), previous: totalOf(prev, summary) };
}

// ---------- definitions ----------

export function normalizeMetric(input = {}, siteIds = []) {
  const connector = CONNECTORS[input.source?.type];
  if (!connector) throw new EngineError(`Pick a source type (${Object.keys(CONNECTORS).join(', ')}).`, { kind: 'validation' });
  const siteId = text(input.siteId);
  if (!siteIds.includes(siteId)) throw new EngineError('Pick the site this metric belongs to.', { kind: 'validation' });
  const label = text(input.label, 80);
  if (!label) throw new EngineError('Give the metric a name, like “Daily pings”.', { kind: 'validation' });
  const source = { type: input.source.type };
  for (const f of connector.fields) {
    const value = text(input.source[f.key]).toLowerCase();
    if (!f.pattern.test(value)) throw new EngineError(`${f.label} doesn’t look right: ${f.hint}`, { kind: 'validation' });
    source[f.key] = value;
  }
  return {
    id: /^[a-z0-9]{8}$/.test(input.id || '') ? input.id : randomUUID().replace(/-/g, '').slice(0, 8),
    siteId,
    label,
    unit: text(input.unit, 24),
    summary: SUMMARIES.includes(input.summary) ? input.summary : 'sum',
    source,
    sql: checkSelect(text(input.sql, 8000)),
  };
}

// ---------- service ----------

export function createCustomMetrics({ store, env = process.env, fetchImpl = fetch, now = () => Date.now() }) {
  const cache = createCache();

  async function secretFor(type) {
    const { secret } = CONNECTORS[type];
    const s = await store.get();
    const value = s.sources?.[secret.key] || env[secret.env] || '';
    if (!value) {
      throw new EngineError(`No ${secret.label} yet.`, {
        status: 409,
        kind: 'needs-metric-token',
        hint: `Add it in Settings → Custom metrics, or set ${secret.env} in .env and restart Studio.`,
      });
    }
    return value;
  }

  async function list() {
    const s = await store.get();
    const siteIds = new Set((await store.sites()).map((x) => x.id));
    return (s.metrics || []).filter((m) => siteIds.has(m.siteId));
  }

  async function status() {
    const s = await store.get();
    return {
      connectors: Object.entries(CONNECTORS).map(([type, c]) => ({
        type,
        label: c.label,
        fields: c.fields.map(({ key, label, hint }) => ({ key, label, hint })),
        secret: { label: c.secret.label, env: c.secret.env, source: s.sources?.[c.secret.key] ? 'settings' : env[c.secret.env] ? 'env' : '' },
      })),
      metrics: await list(),
    };
  }

  async function saveSecret(type, value) {
    const connector = CONNECTORS[type];
    if (!connector) throw new EngineError('Unknown source type.', { kind: 'validation' });
    const token = text(value, 400);
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (token) s.sources[connector.secret.key] = token;
      else delete s.sources[connector.secret.key];
    });
    cache.clear();
    return { ok: true };
  }

  async function save(input) {
    const metric = normalizeMetric(input, (await store.sites()).map((x) => x.id));
    await store.update((s) => {
      s.metrics = [...(s.metrics || [])];
      const i = s.metrics.findIndex((m) => m.id === metric.id);
      if (i >= 0) s.metrics[i] = metric;
      else s.metrics.push(metric);
    });
    cache.clear(metric.id);
    return metric;
  }

  async function remove(id) {
    await store.update((s) => {
      s.metrics = (s.metrics || []).filter((m) => m.id !== id);
    });
    cache.clear(id);
    return { ok: true };
  }

  async function run(metric, rangeKey, { fresh = false } = {}) {
    const range = metricRange(rangeKey, now());
    const key = `${metric.id}:${range.key}:${range.end}:${JSON.stringify([metric.source, metric.sql, metric.summary])}`;
    return cache.wrap(key, TTL, fresh, async () => {
      const bound = bindWindow(metric.sql, { from: range.prevStart, to: range.end });
      const rows = normalizeRows(await CONNECTORS[metric.source.type].run({
        source: metric.source, ...bound, secret: await secretFor(metric.source.type), fetchImpl,
      }));
      return { range, rows: rows.length, ...buildSeries(rows, range, metric.summary) };
    });
  }

  // An unsaved definition, for the editor's Test button: the series plus a few raw rows.
  async function preview(input, rangeKey = '28d') {
    const metric = normalizeMetric({ ...input, id: 'preview0' }, (await store.sites()).map((x) => x.id));
    const range = metricRange(rangeKey, now());
    const bound = bindWindow(metric.sql, { from: range.prevStart, to: range.end });
    const raw = await CONNECTORS[metric.source.type].run({ source: metric.source, ...bound, secret: await secretFor(metric.source.type), fetchImpl });
    const rows = normalizeRows(raw);
    return { range, rows: rows.length, sample: raw.slice(0, 8), ...buildSeries(rows, range, metric.summary) };
  }

  // Every metric of a site; one failing source doesn't hide the others.
  async function forSite(siteId, rangeKey, opts) {
    const metrics = (await list()).filter((m) => m.siteId === siteId);
    return {
      metrics: await Promise.all(metrics.map(async (m) => {
        const def = { id: m.id, label: m.label, unit: m.unit, summary: m.summary, source: m.source.type };
        try {
          return { ...def, ...(await run(m, rangeKey, opts)) };
        } catch (err) {
          return { ...def, error: { message: err.message, kind: err.kind || 'metric-source', hint: err.hint || '' } };
        }
      })),
    };
  }

  return { status, list, save, remove, saveSecret, preview, forSite, run };
}

export function customMetricRoutes({ metrics, siteOr404 }) {
  return [
    ['GET', /^\/api\/metrics$/, async () => metrics.status()],
    ['POST', /^\/api\/metrics$/, async ({ body }) => metrics.save(body)],
    ['POST', /^\/api\/metrics\/preview$/, async ({ body }) => metrics.preview(body, body.range)],
    ['POST', /^\/api\/metrics\/token$/, async ({ body }) => metrics.saveSecret(body.type, body.token)],
    ['DELETE', /^\/api\/metrics\/([a-z0-9]{8})$/, async ({ match }) => metrics.remove(match[1])],
    ['GET', /^\/api\/sites\/([\w-]+)\/metrics$/, async ({ match, query }) =>
      metrics.forSite((await siteOr404(match[1])).id, query.get('range') || '28d', { fresh: query.has('fresh') })],
  ];
}
