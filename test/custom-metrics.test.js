import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
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

async function setup(rows, env = { CLOUDFLARE_API_TOKEN: 'cf-good' }) {
  const dir = await mkdtemp(join(tmpdir(), 'studio-metrics-'));
  const store = createStore(dir);
  await store.saveSite({ id: 'site1', host: 'example.org' });
  const d1 = fakeD1(rows);
  const metrics = createCustomMetrics({ store, env, fetchImpl: d1.fetchImpl, now: () => NOW });
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
  const { dir, metrics, store } = await setup([], {});
  try {
    await metrics.save(definition());
    let [m] = (await metrics.forSite('site1', '28d')).metrics;
    assert.equal(m.error.kind, 'needs-metric-token');

    await metrics.saveSecret('d1', 'cf-bad');
    assert.equal((await store.get()).sources.cloudflareToken, 'cf-bad');
    [m] = (await metrics.forSite('site1', '28d')).metrics;
    assert.equal(m.error.kind, 'metric-auth');

    await metrics.saveSecret('d1', 'cf-good');
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
    await assert.rejects(metrics.save(definition({ siteId: 'nope' })), /Pick the site/);
    await assert.rejects(metrics.save(definition({ source: { type: 'd1', accountId: 'x', databaseId: DB } })), /Account ID/);
    await assert.rejects(metrics.save(definition({ sql: 'DROP TABLE pings' })), /Only SELECT/);
    await assert.rejects(metrics.save(definition({ source: { type: 'mongo' } })), /source type/);

    const p = await metrics.preview(definition(), '7d');
    assert.equal(p.total, 5);
    assert.deepEqual(p.sample, [{ date: '2026-11-04', value: 5 }]);
    assert.equal((await metrics.list()).length, 0, 'preview saves nothing');

    const saved = await metrics.save(definition({ summary: 'latest', unit: 'installs' }));
    const status = await metrics.status();
    assert.equal(status.connectors[0].secret.source, 'env');
    assert.equal(status.metrics[0].summary, 'latest');
    await metrics.remove(saved.id);
    assert.equal((await metrics.list()).length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
