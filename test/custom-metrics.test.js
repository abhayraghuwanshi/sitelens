import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { parseSiteConfig } from '../server/site-config.mjs';
import { createCustomMetrics, metricRange, bindWindow, checkSelect, normalizeRows, buildSeries } from '../server/custom-metrics.mjs';

const NOW = Date.parse('2026-11-04T15:00:00Z'); // a Wednesday
const ACCOUNT = 'a'.repeat(32);
const DB = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
const SQL = 'SELECT date(created_at) AS day, count(*) AS value, version AS dimension FROM pings WHERE created_at >= {{start}} AND created_at < {{end}} GROUP BY 1, 3';

function fakeD1(rows) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) });
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (init.headers.Authorization !== 'Bearer cf-good') return json(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] });
    return json(200, { success: true, errors: [], result: [{ results: rows, success: true, meta: {} }] });
  };
  return { calls, fetchImpl };
}

async function setup(rows, env = { CLOUDFLARE_API_TOKEN: 'cf-good' }, siteConfig = null) {
  const dir = await mkdtemp(join(tmpdir(), 'studio-metrics-'));
  const store = createStore(dir);
  await store.saveSite({ id: 'site1', host: 'example.org' });
  const d1 = fakeD1(rows);
  const metrics = createCustomMetrics({ store, siteConfig, env, fetchImpl: d1.fetchImpl, now: () => NOW });
  return { dir, store, metrics, ...d1 };
}

const definition = (extra = {}) => ({ siteId: 'site1', label: 'Daily pings', source: { type: 'd1', accountId: ACCOUNT, databaseId: DB }, sql: SQL, ...extra });

test('metricRange: UTC days ending today, previous window of the same length', () => {
  const r = metricRange('7d', NOW);
  assert.equal(r.start, '2026-10-29');
  assert.equal(r.end, '2026-11-04');
  assert.equal(r.prevStart, '2026-10-22');
  assert.equal(r.dates.length, 7);
  assert.equal(metricRange('week', NOW).start, '2026-11-02'); // Monday
  assert.equal(metricRange('nope', NOW).key, '28d');
});

test('bindWindow: placeholders become positional params in order', () => {
  const b = bindWindow('SELECT 1 WHERE a >= {{start}} AND a < {{ end }} AND t >= {{start_ms}} AND s < {{end_s}}', { from: '2026-11-01', to: '2026-11-02' });
  assert.equal(b.sql, 'SELECT 1 WHERE a >= ? AND a < ? AND t >= ? AND s < ?');
  assert.deepEqual(b.params, ['2026-11-01', '2026-11-03', Date.parse('2026-11-01T00:00:00Z'), Date.parse('2026-11-03T00:00:00Z') / 1000]);
});

test('checkSelect: one read-only statement', () => {
  assert.equal(checkSelect('select 1;'), 'select 1');
  assert.ok(checkSelect("WITH x AS (SELECT replace(v, 'a', 'b') AS v FROM t) SELECT * FROM x"));
  assert.ok(checkSelect("SELECT ';' AS semi, updated_at FROM t -- drop table t;"));
  assert.throws(() => checkSelect('DELETE FROM pings'), /Only SELECT/);
  assert.throws(() => checkSelect('SELECT 1; DROP TABLE pings'), /single statement/);
  assert.throws(() => checkSelect('WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x'), /may only read/);
  assert.throws(() => checkSelect('  '), /day and value/);
});

test('normalizeRows: day/value/dimension, with forgiving day formats', () => {
  const rows = normalizeRows([
    { day: '2026-11-01', value: '3', dimension: '1.2.0' },
    { day: '20261102', value: 2 },
    { day: Date.parse('2026-11-03T08:00:00Z') / 1000, value: 1, dimension: '' },
    { day: 'garbage', value: 9 },
  ]);
  assert.deepEqual(rows, [
    { day: '2026-11-01', value: 3, dimension: '1.2.0' },
    { day: '2026-11-02', value: 2 },
    { day: '2026-11-03', value: 1 },
  ]);
  assert.throws(() => normalizeRows([{ d: '2026-11-01', n: 1 }]), /columns named day and value \(it returned d, n\)/);
});

test('buildSeries: fills days, ranks dimensions, totals both periods', () => {
  const range = metricRange('7d', NOW);
  const s = buildSeries([
    { day: '2026-10-25', value: 4 },
    { day: '2026-10-30', value: 5, dimension: 'b' },
    { day: '2026-11-04', value: 2, dimension: 'a' },
    { day: '2026-11-04', value: 1, dimension: 'b' },
  ], range);
  assert.deepEqual(s.values, [0, 5, 0, 0, 0, 0, 3]);
  assert.equal(s.total, 8);
  assert.equal(s.previous, 4);
  assert.deepEqual(s.dimensions.map((d) => [d.name, d.total]), [['b', 6], ['a', 2]]);

  const avg = buildSeries([{ day: '2026-11-03', value: 10 }, { day: '2026-11-04', value: 20 }], range, 'average');
  assert.equal(avg.total, 15);
  assert.ok(Number.isNaN(avg.values[0]));
  assert.equal(buildSeries([{ day: '2026-11-03', value: 10 }, { day: '2026-11-04', value: 20 }], range, 'latest').total, 20);
});

test('save → forSite queries D1 with the bound window and the token', async () => {
  const { dir, metrics, calls } = await setup([{ day: '2026-11-03', value: 7, dimension: '1.0' }, { day: '2026-10-20', value: 3 }]);
  try {
    const saved = await metrics.save(definition());
    assert.match(saved.id, /^[a-z0-9]{8}$/);
    const { metrics: [m] } = await metrics.forSite('site1', '7d');
    assert.equal(m.label, 'Daily pings');
    assert.equal(m.total, 7);
    assert.equal(m.previous, null); // 2026-10-20 is before the previous window
    assert.equal(calls[0].url, `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB}/query`);
    assert.equal(calls[0].auth, 'Bearer cf-good');
    assert.match(calls[0].body.sql, /created_at >= \? AND created_at < \?/);
    assert.deepEqual(calls[0].body.params, ['2026-10-22', '2026-11-05']);

    await metrics.forSite('site1', '7d');
    assert.equal(calls.length, 1, 'cached');
    await metrics.forSite('site1', '7d', { fresh: true });
    assert.equal(calls.length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a failing source reports its error without hiding the others', async () => {
  const { dir, metrics } = await setup([], {});
  try {
    const ds = await metrics.saveDataSource({ platform: 'd1', config: { accountId: ACCOUNT, databaseId: DB } });
    assert.equal(ds.secret, 'missing');
    await metrics.save(definition({ source: { dataSource: ds.id } }));
    let [m] = (await metrics.forSite('site1', '28d')).metrics;
    assert.equal(m.error.kind, 'needs-metric-token');
    assert.equal(m.source, 'Cloudflare D1');

    await metrics.saveDataSource({ id: ds.id, platform: 'd1', config: { accountId: ACCOUNT, databaseId: DB }, secret: 'cf-bad' });
    [m] = (await metrics.forSite('site1', '28d')).metrics;
    assert.equal(m.error.kind, 'metric-auth');

    await metrics.saveDataSource({ id: ds.id, platform: 'd1', config: { accountId: ACCOUNT, databaseId: DB }, secret: 'cf-good' });
    [m] = (await metrics.forSite('site1', '28d')).metrics;
    assert.equal(m.error, undefined);
    assert.equal(m.total, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validation, preview and removal', async () => {
  const { dir, metrics } = await setup([{ date: '2026-11-04', value: 5 }]);
  try {
    const ds = await metrics.saveDataSource({ platform: 'd1', name: 'Pings', config: { accountId: ACCOUNT, databaseId: DB } });
    assert.equal(ds.secret, 'env', 'falls back to CLOUDFLARE_API_TOKEN');
    const def = (extra) => definition({ source: { dataSource: ds.id }, ...extra });
    await assert.rejects(metrics.save(def({ siteId: 'nope' })), /Pick the site/);
    await assert.rejects(metrics.save(def({ sql: 'DROP TABLE pings' })), /Only SELECT/);
    await assert.rejects(metrics.save(def({ source: { dataSource: 'zzzzzzzz' } })), /Pick a data source/);
    await assert.rejects(metrics.save(def({ source: { type: 'mongo' } })), /Pick a data source/);

    const p = await metrics.preview(def(), '7d');
    assert.equal(p.total, 5);
    assert.deepEqual(p.sample, [{ date: '2026-11-04', value: 5 }]);
    assert.equal((await metrics.list()).length, 0, 'preview saves nothing');

    const saved = await metrics.save(def({ summary: 'latest', unit: 'installs' }));
    const status = await metrics.status();
    assert.equal(status.dataSources[0].name, 'Pings');
    assert.ok(status.platforms.some((x) => x.key === 'supabase'));
    assert.equal(status.metrics[0].summary, 'latest');
    await assert.rejects(metrics.removeDataSource(ds.id), /uses this data source/);
    await metrics.remove(saved.id);
    assert.equal((await metrics.list()).length, 0);
    await metrics.removeDataSource(ds.id);
    assert.equal((await metrics.status()).dataSources.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('saved inline D1 metrics move to one D1 data source with the saved token', async () => {
  const { dir, store, metrics, calls } = await setup([{ day: '2026-11-04', value: 2 }], {});
  try {
    await store.update((s) => {
      s.sources = { cloudflareToken: 'cf-good' };
      s.metrics = [
        { id: 'aaaaaaaa', siteId: 'site1', label: 'A', unit: '', summary: 'sum', source: { type: 'd1', accountId: ACCOUNT, databaseId: DB }, sql: SQL },
        { id: 'bbbbbbbb', siteId: 'site1', label: 'B', unit: '', summary: 'sum', source: { type: 'd1', accountId: ACCOUNT, databaseId: DB }, sql: SQL },
      ];
    });
    const status = await metrics.status();
    assert.equal(status.dataSources.length, 1);
    assert.equal(status.dataSources[0].secret, 'saved');
    assert.ok(status.metrics.every((m) => m.source.dataSource === status.dataSources[0].id));
    assert.equal(JSON.stringify(status).includes('cf-good'), false, 'the secret never leaves the server');
    const run = (await metrics.forSite('site1', '7d')).metrics;
    assert.equal(run[0].total, 2);
    assert.equal(calls[0].auth, 'Bearer cf-good');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('data source forms: connection strings checked, secret kept when left blank, names unique', async () => {
  const { dir, store, metrics } = await setup([]);
  try {
    await assert.rejects(metrics.saveDataSource({ platform: 'supabase', secret: 'mysql://u:p@h/db' }), /postgresql:\/\//);
    await assert.rejects(metrics.saveDataSource({ platform: 'neon' }), /connection string/);
    await assert.rejects(metrics.saveDataSource({ platform: 'nope' }), /Pick a platform/);
    const ds = await metrics.saveDataSource({ platform: 'supabase', name: 'App', secret: 'postgresql://reader:s3cret@db.example.supabase.co:5432/postgres' });
    assert.equal(ds.where, 'reader@db.example.supabase.co/postgres');
    assert.equal(ds.kind, 'postgres');
    await metrics.saveDataSource({ id: ds.id, platform: 'supabase', name: 'App db', secret: '' });
    const kept = (await store.get()).dataSources[0];
    assert.equal(kept.name, 'App db');
    assert.match(kept.secret, /s3cret/);
    await assert.rejects(metrics.saveDataSource({ platform: 'mysql', name: 'app DB', secret: 'mysql://u:p@h/db' }), /already called/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bindWindow: $1, $2… for Postgres', () => {
  const b = bindWindow('SELECT 1 WHERE a >= {{start}} AND a < {{end}}', { from: '2026-11-01', to: '2026-11-02' }, (i) => `$${i}`);
  assert.equal(b.sql, 'SELECT 1 WHERE a >= $1 AND a < $2');
});

test('SQLite file: tables for the editor, then a metric read-only', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { dir, metrics } = await setup([]);
  try {
    const path = join(dir, 'app.db');
    const db = new DatabaseSync(path);
    db.exec("CREATE TABLE signups (id INTEGER PRIMARY KEY, created_at TEXT, plan TEXT); INSERT INTO signups (created_at, plan) VALUES ('2026-11-03 10:00', 'free'), ('2026-11-03 11:00', 'pro'), ('2026-11-04 09:00', 'free');");
    db.close();
    const test = await metrics.testDataSource({ platform: 'sqlite', config: { path } });
    assert.deepEqual(test.tables.map((t) => t.name), ['signups']);
    assert.deepEqual(test.tables[0].columns.map((c) => c.name), ['id', 'created_at', 'plan']);
    const ds = await metrics.saveDataSource({ platform: 'sqlite', name: 'Local', config: { path } });
    assert.equal(ds.secret, 'none');
    const p = await metrics.preview({ siteId: 'site1', label: 'Signups', source: { dataSource: ds.id },
      sql: 'SELECT date(created_at) AS day, count(*) AS value, plan AS dimension FROM signups WHERE created_at >= {{start}} AND created_at < {{end}} GROUP BY 1, 3' }, '7d');
    assert.equal(p.total, 3);
    assert.deepEqual(p.dimensions.map((d) => d.name), ['free', 'pro']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Turso over HTTP: libsql:// becomes https, typed args and cells', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-metrics-'));
  const store = createStore(dir);
  await store.saveSite({ id: 'site1', host: 'example.org' });
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ results: [{ type: 'ok', response: { type: 'execute', result: { cols: [{ name: 'day' }, { name: 'value' }], rows: [[{ type: 'text', value: '2026-11-04' }, { type: 'integer', value: '9' }]] } } }, { type: 'ok' }] }) };
  };
  const metrics = createCustomMetrics({ store, env: {}, fetchImpl, now: () => NOW });
  try {
    const ds = await metrics.saveDataSource({ platform: 'turso', config: { url: 'libsql://app-me.turso.io' }, secret: 'tok' });
    const p = await metrics.preview({ siteId: 'site1', label: 'X', source: { dataSource: ds.id }, sql: 'SELECT day, value FROM t WHERE ts >= {{start_ms}} AND day < {{end}}' }, '7d');
    assert.equal(p.total, 9);
    assert.equal(calls[0].url, 'https://app-me.turso.io/v2/pipeline');
    assert.equal(calls[0].auth, 'Bearer tok');
    assert.deepEqual(calls[0].body.requests[0].stmt.args, [{ type: 'integer', value: String(Date.parse('2026-10-22T00:00:00Z')) }, { type: 'text', value: '2026-11-05' }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('hosted: no SQLite files, and no private database hosts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-metrics-'));
  const store = createStore(dir);
  await store.saveSite({ id: 'site1', host: 'example.org' });
  const metrics = createCustomMetrics({ store, env: {}, hosted: true, now: () => NOW });
  try {
    assert.equal((await metrics.status()).platforms.some((p) => p.key === 'sqlite'), false);
    await assert.rejects(metrics.saveDataSource({ platform: 'sqlite', config: { path: '/etc/app.db' } }), /desktop app only/);
    await assert.rejects(metrics.testDataSource({ platform: 'postgres', secret: 'postgresql://u:p@127.0.0.1:5432/db' }), /private or internal/);
    await assert.rejects(metrics.testDataSource({ platform: 'mysql', secret: 'mysql://u:p@10.0.0.4/db' }), /private or internal/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('metrics from a site’s .sitelens.yml are listed and run, but not editable here', async () => {
  const { config, errors } = parseSiteConfig(`version: 1
metrics:
  - label: New installs
    unit: installs
    d1: { account: ${ACCOUNT}, database: ${DB} }
    sql: SELECT date AS day, sum(first_run) AS value FROM pings WHERE date >= {{start}} AND date < {{end}} GROUP BY 1
`);
  assert.deepEqual(errors, []);
  const siteConfig = { applied: async (site) => (site.id === 'site1' ? config : null) };
  const { dir, metrics, calls } = await setup([{ day: '2026-11-04', value: 3 }], undefined, siteConfig);
  try {
    const [m] = await metrics.list();
    assert.equal(m.from, 'file');
    assert.equal(m.siteId, 'site1');
    assert.deepEqual(m.source, { type: 'd1', accountId: ACCOUNT, databaseId: DB });
    assert.equal((await metrics.list())[0].id, m.id, 'the id is stable');
    const [run] = (await metrics.forSite('site1', '7d')).metrics;
    assert.equal(run.total, 3);
    assert.equal(run.from, 'file');
    await assert.rejects(metrics.remove(m.id), /\.sitelens\.yml/);
    await assert.rejects(metrics.save({ ...m, label: 'Renamed' }), /\.sitelens\.yml/);
    assert.equal(calls[0].body.params.length, 2, 'the window is bound');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a file’s inline D1 metric uses the token of a saved D1 data source for the same database', async () => {
  const { config } = parseSiteConfig(`version: 1
metrics:
  - label: New installs
    d1: { account: ${ACCOUNT}, database: ${DB} }
    sql: SELECT date AS day, 1 AS value FROM pings WHERE date >= {{start}} AND date < {{end}}
`);
  const siteConfig = { applied: async (site) => (site.id === 'site1' ? config : null) };
  const { dir, store, metrics, calls } = await setup([{ day: '2026-11-04', value: 1 }], {}, siteConfig);
  try {
    await store.update((s) => { s.sources = { cloudflareToken: 'cf-bad' }; });
    await metrics.saveDataSource({ platform: 'd1', config: { accountId: ACCOUNT, databaseId: DB }, secret: 'cf-good' });
    const [m] = (await metrics.forSite('site1', '7d')).metrics;
    assert.equal(m.error, undefined);
    assert.equal(calls[0].auth, 'Bearer cf-good');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a D1 data source saved without a token takes the Cloudflare token saved before', async () => {
  const { dir, store, metrics } = await setup([], {});
  try {
    await store.update((s) => { s.sources = { cloudflareToken: 'cf-old' }; });
    const ds = await metrics.saveDataSource({ platform: 'd1', config: { accountId: ACCOUNT, databaseId: DB } });
    assert.equal(ds.secret, 'saved');
    assert.equal((await store.get()).dataSources[0].secret, 'cf-old');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
