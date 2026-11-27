// Custom metrics: daily numbers from your own stores (daily pings, signups,
// revenue…) charted next to GA4. Every source answers a query with rows of
// one shape — `day, value[, dimension]` — so screens never care where a number
// came from.
//
// Metrics come from Settings (stored in studio.json) or from a site's
// .sitelens.yml `metrics:` (read-only here; edit the file).
//
// Where a metric reads from:
//  - { dataSource: <id> }: a saved data source (data-sources.mjs): Postgres,
//    Supabase, Neon, MySQL, PlanetScale, Turso, D1 or a SQLite file.
//  - { type: 'd1', accountId, databaseId }: the older inline D1 form, still how
//    .sitelens.yml names a source. Token: Settings, else CLOUDFLARE_API_TOKEN.
//    Saved metrics in this form move to a D1 data source on first load.
//
// Queries are SELECT-only and get the window as bound parameters:
// {{start}} / {{end}} are 'YYYY-MM-DD' (end exclusive), {{start_ms}} / {{end_ms}}
// epoch milliseconds, {{start_s}} / {{end_s}} epoch seconds. One query covers
// the range and the period before it, so the delta costs nothing extra.

import { randomUUID, createHash } from 'node:crypto';
import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';
import { KINDS, runD1, runOn, listTables, normalizeDataSource, publicDataSource, kindsForBrowser } from './data-sources.mjs';

const DAY = 86_400_000;
const TTL = 15 * 60_000;
const MAX_ROWS = 20_000;
const TOP_DIMENSIONS = 5;
const RANGE_DAYS = { today: 1, '7d': 7, '28d': 28, '90d': 90, '1y': 365 };
export const SUMMARIES = ['sum', 'average', 'latest'];

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Inline sources a .sitelens.yml can name (`d1: { account, database }`).
export const CONNECTORS = {
  d1: {
    label: 'Cloudflare D1',
    secret: { key: 'cloudflareToken', env: 'CLOUDFLARE_API_TOKEN', label: 'Cloudflare API token' },
    fields: [
      { key: 'accountId', yaml: 'account', label: 'Account ID', pattern: /^[a-f0-9]{32}$/, hint: '32 hex characters, on the right of the Cloudflare dashboard’s Workers & Pages page.' },
      { key: 'databaseId', yaml: 'database', label: 'Database ID', pattern: /^[a-f0-9-]{36}$/, hint: 'A UUID: Storage & Databases → D1 → your database, or `database_id` in wrangler.toml.' },
    ],
    run: ({ source, sql, params, secret, fetchImpl }) => runD1({ accountId: source.accountId, databaseId: source.databaseId, secret, sql, params, fetchImpl }),
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

// Swaps {{start}}-style placeholders for positional params, in order: `?` by
// default, `$1, $2…` for Postgres.
export function bindWindow(sql, { from, to }, marker = () => '?') {
  const params = [];
  const ms = { start: Date.parse(`${from}T00:00:00Z`), end: Date.parse(`${to}T00:00:00Z`) + DAY };
  const bound = sql.replace(PLACEHOLDER, (_, edge, unit) => {
    params.push(unit === '_ms' ? ms[edge] : unit === '_s' ? Math.floor(ms[edge] / 1000) : isoDay(ms[edge]));
    return marker(params.length);
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
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? isoDay(v.getTime()) : '';
  if (typeof v === 'bigint') v = Number(v);
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
    const value = Number(typeof r[valueCol] === 'bigint' ? Number(r[valueCol]) : r[valueCol]);
    if (!day || !Number.isFinite(value)) return [];
    return [{ day, value, ...(dimCol && r[dimCol] != null && r[dimCol] !== '' ? { dimension: String(r[dimCol]) } : {}) }];
  });
}

export function metricTotal(values, mode) {
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
    .map(([name, days]) => ({ name, values: range.dates.map((d) => days.get(d) ?? fill), total: metricTotal([...days.values()], summary) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_DIMENSIONS);
  return { dates: range.dates, values, dimensions, total: metricTotal(values, summary), previous: metricTotal(prev, summary) };
}

// ---------- definitions ----------

export function normalizeMetric(input = {}, siteIds = [], dataSourceIds = []) {
  const siteId = text(input.siteId);
  if (!siteIds.includes(siteId)) throw new EngineError('Pick the site this metric belongs to.', { kind: 'validation' });
  const label = text(input.label, 80);
  if (!label) throw new EngineError('Give the metric a name, like “Daily pings”.', { kind: 'validation' });
  let source;
  if (input.source?.dataSource) {
    if (!dataSourceIds.includes(input.source.dataSource)) throw new EngineError('Pick a data source, or add one first.', { kind: 'validation' });
    source = { dataSource: input.source.dataSource };
  } else {
    const connector = CONNECTORS[input.source?.type];
    if (!connector) throw new EngineError('Pick a data source, or add one first.', { kind: 'validation' });
    source = { type: input.source.type };
    for (const f of connector.fields) {
      const value = text(input.source[f.key]).toLowerCase();
      if (!f.pattern.test(value)) throw new EngineError(`${f.label} doesn’t look right: ${f.hint}`, { kind: 'validation' });
      source[f.key] = value;
    }
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

export function createCustomMetrics({ store, siteConfig = null, env = process.env, fetchImpl = fetch, now = () => Date.now(), hosted = env.STUDIO_HOSTED === '1' }) {
  const cache = createCache();
  const newId = () => randomUUID().replace(/-/g, '').slice(0, 8);
  const runOpts = { hosted, fetchImpl, env };

  // An inline source's token: a saved data source for the same database
  // first (so it can be changed in Databases), then the older saved token, then .env.
  async function legacySecret(source) {
    const { secret } = CONNECTORS[source.type];
    const s = await store.get();
    const match = (s.dataSources || []).find((d) => d.kind === source.type && d.secret && d.config.accountId === source.accountId && d.config.databaseId === source.databaseId);
    const value = match?.secret || s.sources?.[secret.key] || env[secret.env] || '';
    if (!value) {
      throw new EngineError(`No ${secret.label} yet.`, {
        status: 409,
        kind: 'needs-metric-token',
        hint: `Add a Cloudflare D1 data source for this database in Account → Connections → Databases, or set ${secret.env} in .env and restart Kauzl.`,
      });
    }
    return value;
  }

  // Saved metrics that still carry an inline D1 source move to one D1 data
  // source per database, with the token that was saved for all of them.
  let migrated = false;
  async function migrate() {
    if (migrated) return;
    migrated = true;
    const s = await store.get();
    if (!(s.metrics || []).some((m) => m.source?.type === 'd1')) return;
    await store.update((st) => {
      st.dataSources = [...(st.dataSources || [])];
      st.metrics = (st.metrics || []).map((m) => {
        if (m.source?.type !== 'd1') return m;
        let ds = st.dataSources.find((d) => d.kind === 'd1' && d.config.accountId === m.source.accountId && d.config.databaseId === m.source.databaseId);
        if (!ds) {
          ds = { id: newId(), kind: 'd1', platform: 'd1', name: 'Cloudflare D1', config: { accountId: m.source.accountId, databaseId: m.source.databaseId }, ...(st.sources?.cloudflareToken ? { secret: st.sources.cloudflareToken } : {}) };
          if (st.dataSources.some((d) => d.name === ds.name)) ds.name = `Cloudflare D1 · ${m.source.databaseId.slice(0, 8)}`;
          st.dataSources.push(ds);
        }
        return { ...m, source: { dataSource: ds.id } };
      });
    });
  }

  async function dataSources() {
    await migrate();
    return (await store.get()).dataSources || [];
  }

  // A file's metric keeps the same id while its label does, so links to it hold.
  const fileId = (siteId, label) => createHash('sha1').update(`${siteId}\n${label.toLowerCase()}`).digest('hex').slice(0, 8);

  async function fromFiles(sites) {
    if (!siteConfig) return [];
    const per = await Promise.all(sites.filter((x) => !x.demo).map(async (site) => {
      const config = await siteConfig.applied(site);
      return (config?.metrics || []).map((m) => ({ ...m, id: fileId(site.id, m.label), siteId: site.id, from: 'file' }));
    }));
    return per.flat();
  }

  async function list() {
    await migrate();
    const s = await store.get();
    const sites = await store.sites();
    const siteIds = new Set(sites.map((x) => x.id));
    return [...(s.metrics || []).filter((m) => siteIds.has(m.siteId)), ...(await fromFiles(sites))];
  }

  async function readOnly(id) {
    if ((await list()).some((m) => m.id === id && m.from === 'file')) {
      throw new EngineError('This metric comes from the site’s .sitelens.yml; change it there.', { status: 409, kind: 'validation' });
    }
  }

  async function status() {
    const sources = await dataSources();
    return {
      ...kindsForBrowser({ hosted }),
      dataSources: sources.map((d) => publicDataSource(d, env)),
      metrics: await list(),
    };
  }

  // ----- data sources -----

  async function saveDataSource(input) {
    const all = await dataSources();
    const previous = input.id ? all.find((d) => d.id === input.id) : null;
    if (input.id && !previous) throw new EngineError('That data source is gone.', { status: 404, kind: 'notfound' });
    const ds = normalizeDataSource(input, previous, { hosted });
    ds.id = previous?.id || newId();
    // A D1 source left without a token takes the Cloudflare token saved before data sources existed.
    if (ds.kind === 'd1' && !ds.secret) {
      const old = (await store.get()).sources?.cloudflareToken;
      if (old) ds.secret = old;
    }
    if (all.some((d) => d.id !== ds.id && d.name.toLowerCase() === ds.name.toLowerCase())) {
      throw new EngineError(`Another data source is already called “${ds.name}”.`, { kind: 'validation' });
    }
    await store.update((s) => {
      s.dataSources = [...(s.dataSources || [])];
      const i = s.dataSources.findIndex((d) => d.id === ds.id);
      if (i >= 0) s.dataSources[i] = ds;
      else s.dataSources.push(ds);
    });
    cache.clear();
    return publicDataSource(ds, env);
  }

  async function removeDataSource(id) {
    const used = (await list()).filter((m) => m.source?.dataSource === id);
    if (used.length) {
      throw new EngineError(`${used.length === 1 ? `“${used[0].label}” uses` : `${used.length} metrics use`} this data source. Remove or move ${used.length === 1 ? 'it' : 'them'} first.`, { status: 409, kind: 'validation' });
    }
    await store.update((s) => {
      s.dataSources = (s.dataSources || []).filter((d) => d.id !== id);
    });
    cache.clear();
    return { ok: true };
  }

  // Connection test from the form (unsaved; a blank secret keeps the saved one).
  async function testDataSource(input) {
    const previous = input.id ? (await dataSources()).find((d) => d.id === input.id) : null;
    const ds = normalizeDataSource(input, previous, { hosted });
    return { ok: true, tables: await listTables(ds, runOpts) };
  }

  async function tables(id) {
    const ds = (await dataSources()).find((d) => d.id === id);
    if (!ds) throw new EngineError('That data source is gone.', { status: 404, kind: 'notfound' });
    return { tables: await cache.wrap(`tables:${id}`, TTL, false, () => listTables(ds, runOpts)) };
  }

  // ----- metrics -----

  async function save(input) {
    const metric = normalizeMetric(input, (await store.sites()).map((x) => x.id), (await dataSources()).map((d) => d.id));
    await readOnly(metric.id);
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
    await readOnly(id);
    await store.update((s) => {
      s.metrics = (s.metrics || []).filter((m) => m.id !== id);
    });
    cache.clear(id);
    return { ok: true };
  }

  // Raw rows for a metric's query over the window, from wherever it reads.
  async function query(metric, from, to) {
    if (metric.source.dataSource) {
      const ds = (await dataSources()).find((d) => d.id === metric.source.dataSource);
      if (!ds) throw new EngineError('This metric’s data source was removed.', { status: 409, kind: 'metric-source', hint: 'Edit the metric and pick another one.' });
      const bound = bindWindow(metric.sql, { from, to }, KINDS[ds.kind].marker);
      return runOn(ds, bound.sql, bound.params, runOpts);
    }
    const bound = bindWindow(metric.sql, { from, to });
    return CONNECTORS[metric.source.type].run({ source: metric.source, ...bound, secret: await legacySecret(metric.source), fetchImpl });
  }

  const sourceLabel = async (source) => (source.dataSource
    ? (await dataSources()).find((d) => d.id === source.dataSource)?.name || 'Removed source'
    : CONNECTORS[source.type]?.label || source.type);

  async function run(metric, rangeKey, { fresh = false, window } = {}) {
    const range = window || metricRange(rangeKey, now());
    const key = `${metric.id}:${range.key}:${range.start}:${range.end}:${JSON.stringify([metric.source, metric.sql, metric.summary])}`;
    return cache.wrap(key, TTL, fresh, async () => {
      const rows = normalizeRows(await query(metric, range.prevStart, range.end));
      return { range, rows: rows.length, ...buildSeries(rows, range, metric.summary) };
    });
  }

  // An unsaved definition, for the editor's Test button: the series plus a few raw rows.
  async function preview(input, rangeKey = '28d') {
    const metric = normalizeMetric({ ...input, id: 'preview0' }, (await store.sites()).map((x) => x.id), (await dataSources()).map((d) => d.id));
    const range = metricRange(rangeKey, now());
    const raw = await query(metric, range.prevStart, range.end);
    const rows = normalizeRows(raw);
    return { range, rows: rows.length, sample: raw.slice(0, 8), ...buildSeries(rows, range, metric.summary) };
  }

  // Every metric of a site; one failing source doesn't hide the others.
  async function forSite(siteId, rangeKey, opts) {
    const metrics = (await list()).filter((m) => m.siteId === siteId);
    return {
      metrics: await Promise.all(metrics.map(async (m) => {
        const def = { id: m.id, label: m.label, unit: m.unit, summary: m.summary, source: await sourceLabel(m.source), ...(m.from ? { from: m.from } : {}) };
        try {
          return { ...def, ...(await run(m, rangeKey, opts)) };
        } catch (err) {
          return { ...def, error: { message: err.message, kind: err.kind || 'metric-source', hint: err.hint || '' } };
        }
      })),
    };
  }

  return { status, list, save, remove, preview, forSite, run, dataSources, saveDataSource, removeDataSource, testDataSource, tables };
}

export function customMetricRoutes({ metrics, siteOr404 }) {
  return [
    ['GET', /^\/api\/metrics$/, async () => metrics.status()],
    ['POST', /^\/api\/metrics$/, async ({ body }) => metrics.save(body)],
    ['POST', /^\/api\/metrics\/preview$/, async ({ body }) => metrics.preview(body, body.range)],
    ['POST', /^\/api\/data-sources$/, async ({ body }) => metrics.saveDataSource(body)],
    ['POST', /^\/api\/data-sources\/test$/, async ({ body }) => metrics.testDataSource(body)],
    ['GET', /^\/api\/data-sources\/([a-z0-9]{8})\/tables$/, async ({ match }) => metrics.tables(match[1])],
    ['DELETE', /^\/api\/data-sources\/([a-z0-9]{8})$/, async ({ match }) => metrics.removeDataSource(match[1])],
    ['DELETE', /^\/api\/metrics\/([a-z0-9]{8})$/, async ({ match }) => metrics.remove(match[1])],
    ['GET', /^\/api\/sites\/([\w-]+)\/metrics$/, async ({ match, query }) =>
      metrics.forSite((await siteOr404(match[1])).id, query.get('range') || '28d', { fresh: query.has('fresh') })],
  ];
}
