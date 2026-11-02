import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rate, uptimeStats, bucketChecks, incidents, parsePsi, parseCruxHistory, parseCruxBigQuery, twinOrigin, describeFetchError, createVitals } from '../server/vitals.mjs';

const MIN = 60_000;
const HOUR = 60 * MIN;

test('rate: Core Web Vitals thresholds, inclusive at the good edge', () => {
  assert.equal(rate('lcp', 2500), 'good');
  assert.equal(rate('lcp', 2501), 'needs-improvement');
  assert.equal(rate('lcp', 4001), 'poor');
  assert.equal(rate('inp', 200), 'good');
  assert.equal(rate('inp', 500), 'needs-improvement');
  assert.equal(rate('inp', 501), 'poor');
  assert.equal(rate('cls', 0.1), 'good');
  assert.equal(rate('cls', 0.25), 'needs-improvement');
  assert.equal(rate('cls', 0.3), 'poor');
  assert.equal(rate('tbt', 650), 'poor');
  assert.equal(rate('lcp', null), null);
  assert.equal(rate('nope', 1), null);
});

test('uptime: share of good checks, latency only from successful ones', () => {
  const rows = [
    { at: 0, ok: true, ms: 100 },
    { at: 5 * MIN, ok: true, ms: 300 },
    { at: 10 * MIN, ok: false, ms: 15_000 },
    { at: 15 * MIN, ok: true, ms: 200 },
    { at: 2 * HOUR, ok: true, ms: 999 }, // out of range
  ];
  const s = uptimeStats(rows, 0, HOUR);
  assert.equal(s.checks, 4);
  assert.equal(s.down, 1);
  assert.equal(s.pct, 0.75);
  assert.equal(s.avgMs, 200);
  assert.equal(uptimeStats([], 0, HOUR).pct, null);
});

test('buckets: up / partial / down / none', () => {
  const rows = [
    { at: 1 * MIN, ok: true, ms: 100 },
    { at: 61 * MIN, ok: true, ms: 100 },
    { at: 62 * MIN, ok: false, ms: 0 },
    { at: 121 * MIN, ok: false, ms: 0 },
  ];
  const b = bucketChecks(rows, 0, 4 * HOUR, HOUR);
  assert.deepEqual(b.map((x) => x.state), ['up', 'partial', 'down', 'none']);
  assert.equal(b[0].avgMs, 100);
});

test('incidents: consecutive failures merge, newest first, open ones unresolved', () => {
  const rows = [
    { at: 0, ok: false, error: 'HTTP 503', status: 503 },
    { at: 5, ok: false, error: 'HTTP 503', status: 503 },
    { at: 10, ok: true },
    { at: 15, ok: false, error: 'Timed out', status: 0 },
  ];
  const list = incidents(rows);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { start: 15, end: 15, checks: 1, error: 'Timed out', status: 0, resolvedAt: null });
  assert.equal(list[1].checks, 2);
  assert.equal(list[1].resolvedAt, 10);
});

test('parsePsi: lab audits, field p75s with CLS unscaled, origin fallback', () => {
  const json = {
    lighthouseResult: {
      categories: { performance: { score: 0.83 } },
      audits: { 'largest-contentful-paint': { numericValue: 2900.4 }, 'cumulative-layout-shift': { numericValue: 0.04 }, 'total-blocking-time': { numericValue: 120 } },
    },
    loadingExperience: { id: 'https://x.com/', origin_fallback: true, metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1 } } },
    originLoadingExperience: { id: 'https://x.com', metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2100 }, INTERACTION_TO_NEXT_PAINT: { percentile: 180 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12 } } },
  };
  const p = parsePsi(json);
  assert.equal(p.score, 83);
  assert.equal(p.lcp, 2900.4);
  assert.equal(p.inp, null);
  assert.deepEqual({ ...p.field, fcp: undefined, ttfb: undefined }, { scope: 'origin', lcp: 2100, inp: 180, cls: 0.12, fcp: undefined, ttfb: undefined });
  assert.equal(parsePsi({}).field, null);
});

test('parseCruxHistory: weekly p75s keyed by period end, strings and NaN handled', () => {
  const series = parseCruxHistory({
    record: {
      collectionPeriods: [{ firstDate: { year: 2026, month: 9, day: 1 }, lastDate: { year: 2026, month: 9, day: 28 } }, { lastDate: { year: 2026, month: 10, day: 5 } }],
      metrics: {
        largest_contentful_paint: { percentilesTimeseries: { p75s: [2400, null] } },
        cumulative_layout_shift: { percentilesTimeseries: { p75s: ['0.05', 'NaN'] } },
      },
    },
  });
  assert.deepEqual(series, [
    { date: '2026-09-28', lcp: 2400, inp: null, cls: 0.05 },
    { date: '2026-10-05', lcp: null, inp: null, cls: null },
  ]);
});

test('describeFetchError: TLS, DNS and timeouts are named', () => {
  assert.equal(describeFetchError({ cause: { code: 'CERT_HAS_EXPIRED' } }), 'TLS error: CERT_HAS_EXPIRED');
  assert.equal(describeFetchError({ cause: { code: 'ENOTFOUND' } }), 'DNS lookup failed');
  assert.equal(describeFetchError({ name: 'TimeoutError' }), 'Timed out');
});

function fakeStore(sites, sources = {}) {
  const state = { sources, sites };
  return {
    get: async () => state,
    update: async (fn) => fn(state),
    sites: async () => [{ id: 'demo', demo: true, host: 'example.com' }, ...state.sites],
  };
}

test('vitals: checks, PSI with key, CrUX history and summary end to end', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vitals-'));
  let clock = 1_800_000_000_000;
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    calls.push(u);
    if (u === 'https://up.test/') return new Response('ok', { status: 200 });
    if (u === 'https://down.test/') return new Response('no', { status: 503 });
    if (u.startsWith('https://www.googleapis.com/pagespeedonline')) {
      assert.match(u, /key=k123/);
      const mobile = u.includes('strategy=mobile');
      return Response.json({
        lighthouseResult: { categories: { performance: { score: mobile ? 0.7 : 0.95 } }, audits: { 'largest-contentful-paint': { numericValue: 3000 }, 'total-blocking-time': { numericValue: 700 }, 'cumulative-layout-shift': { numericValue: 0.01 } } },
      });
    }
    if (u.startsWith('https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord')) {
      assert.equal(JSON.parse(init.body).origin, 'https://up.test');
      return Response.json({ record: { collectionPeriods: [{ lastDate: { year: 2026, month: 10, day: 25 } }], metrics: { interaction_to_next_paint: { percentilesTimeseries: { p75s: [150] } } } } });
    }
    throw new Error(`unexpected ${u}`);
  };
  const store = fakeStore([{ id: 'a', host: 'up.test' }, { id: 'b', host: 'down.test' }, { id: 'c', host: 'UP.test' }], { googleApiKey: 'k123' });
  const vitals = createVitals({ dbPath: join(dir, 'vitals.db'), store, env: {}, fetchImpl, now: () => clock });
  try {
    const first = await vitals.checkAll();
    assert.equal(first.length, 2, 'hosts deduped, demo skipped');
    clock += 5 * MIN;
    await vitals.checkAll();
    await vitals.audit('up.test');

    const { sites, key } = await vitals.summary();
    assert.equal(key.source, 'settings');
    const up = sites.find((s) => s.id === 'a');
    assert.equal(up.uptime.day.pct, 1);
    assert.equal(up.score, 70);
    assert.deepEqual(up.vitals.lcp, { value: 3000, source: 'lab', metric: 'lcp', rating: 'needs-improvement' });
    assert.deepEqual(up.vitals.inp, { value: 150, source: 'field', rating: 'good' }, 'CrUX history beats lab TBT');
    const down = sites.find((s) => s.id === 'b');
    assert.equal(down.uptime.day.pct, 0);
    assert.equal(down.uptime.last.error, 'HTTP 503');
    assert.ok(sites.find((s) => s.id === 'demo').demo);

    const d = await vitals.detail({ id: 'b', host: 'down.test' }, '24h');
    assert.equal(d.incidents.length, 1);
    assert.equal(d.incidents[0].checks, 2);
    assert.equal(d.buckets.length, 97);
  } finally {
    vitals.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('vitals: without a key PSI uses the Google token and CrUX is skipped; quota errors get a hint', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vitals-'));
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    assert.ok(!u.includes('chromeuxreport'), 'no CrUX call without a key');
    assert.equal(init.headers?.Authorization, 'Bearer ya29.t');
    return Response.json({ error: { message: 'Quota exceeded' } }, { status: 429 });
  };
  const vitals = createVitals({ dbPath: join(dir, 'vitals.db'), store: fakeStore([{ id: 'a', host: 'up.test' }]), env: {}, getToken: async () => 'ya29.t', fetchImpl });
  try {
    const r = await vitals.audit('up.test');
    assert.equal(r.crux.skipped, true);
    assert.match(r.psi[0].error, /your Google Cloud project is used up/);
    const { sites } = await vitals.summary();
    assert.equal(sites.find((s) => s.id === 'a').vitals.lcp, null);
  } finally {
    vitals.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('vitals: a failed PSI run keeps the last good numbers and reports the failure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vitals-'));
  let clock = 1_800_000_000_000;
  let fail = false;
  const fetchImpl = async () => (fail
    ? Response.json({ error: { message: 'boom' } }, { status: 500 })
    : Response.json({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'largest-contentful-paint': { numericValue: 1200 } } } }));
  const vitals = createVitals({ dbPath: join(dir, 'vitals.db'), store: fakeStore([{ id: 'a', host: 'up.test' }]), env: {}, fetchImpl, now: () => clock });
  try {
    await vitals.audit('up.test');
    clock += 60_000;
    fail = true;
    await vitals.audit('up.test');
    const d = await vitals.detail({ id: 'a', host: 'up.test' }, '7d');
    assert.equal(d.latest.mobile.score, 90);
    assert.equal(d.latest.mobile.lastError.message, 'boom');
    assert.equal(d.vitals.lcp.rating, 'good');
  } finally {
    vitals.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('parseCruxBigQuery: one row per month, own origin and phone first', () => {
  const rows = [
    { date: '2026-09-01', origin: 'https://www.a.test', device: 'phone', p75_lcp: 9000, p75_inp: 900, p75_cls: 0.9 },
    { date: '2026-09-01', origin: 'https://a.test', device: 'desktop', p75_lcp: 1500, p75_inp: 80, p75_cls: 0.02 },
    { date: '2026-09-01', origin: 'https://a.test', device: 'phone', p75_lcp: 2100, p75_inp: 150, p75_cls: 0.05 },
    { date: '2026-08-01', origin: 'https://www.a.test', device: 'desktop', p75_lcp: 1800, p75_inp: null, p75_cls: 0.1 },
  ];
  assert.deepEqual(parseCruxBigQuery(rows, 'https://a.test'), [
    { date: '2026-08-01', lcp: 1800, inp: null, cls: 0.1 },
    { date: '2026-09-01', lcp: 2100, inp: 150, cls: 0.05 },
  ]);
  assert.equal(twinOrigin('a.test'), 'https://www.a.test');
  assert.equal(twinOrigin('www.a.test'), 'https://a.test');
});

test('vitals: without a key CrUX history comes from BigQuery on the sign-in, at most weekly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vitals-'));
  let clock = 1_800_000_000_000;
  const queries = [];
  const bigquery = {
    async query(q) {
      queries.push(q);
      return { rows: [{ date: '2026-09-01', origin: 'https://up.test', device: 'phone', p75_lcp: 2100, p75_inp: 150, p75_cls: 0.05 }] };
    },
  };
  const fetchImpl = async (url) => {
    assert.ok(!String(url).includes('chromeuxreport'), 'no CrUX API call without a key');
    return Response.json({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: {} } });
  };
  const store = fakeStore([{ id: 'a', host: 'up.test', bq: { billingProject: 'proj-1', dataProject: 'proj-1' } }]);
  const vitals = createVitals({ dbPath: join(dir, 'vitals.db'), store, env: {}, getToken: async () => 'ya29.t', bigquery, fetchImpl, now: () => clock });
  try {
    const r = await vitals.audit('up.test');
    assert.equal(r.crux.source, 'bigquery');
    assert.equal(queries[0].project, 'proj-1');
    assert.deepEqual(queries[0].params.origins, ['https://up.test', 'https://www.up.test']);
    const d = await vitals.detail({ id: 'a', host: 'up.test' }, '7d');
    assert.equal(d.crux.source, 'bigquery');
    assert.equal(d.vitals.lcp.value, 2100);
    assert.equal(d.vitals.lcp.source, 'field');

    clock += 2 * 24 * 3600_000;
    assert.equal((await vitals.audit('up.test')).crux.cached, true);
    await vitals.audit('up.test', { force: true });
    assert.equal(queries.length, 2);
  } finally {
    vitals.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('vitals: an origin missing from CrUX says so; no BigQuery project gives a setup hint', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vitals-'));
  const fetchImpl = async () => Response.json({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: {} } });
  const bigquery = { query: async () => ({ rows: [] }) };
  const withBq = createVitals({ dbPath: join(dir, 'a.db'), store: fakeStore([{ id: 'a', host: 'up.test', bq: { billingProject: 'p' } }]), env: {}, bigquery, fetchImpl });
  const withoutBq = createVitals({ dbPath: join(dir, 'b.db'), store: fakeStore([{ id: 'a', host: 'up.test' }]), env: {}, bigquery, fetchImpl });
  try {
    assert.match((await withBq.audit('up.test')).crux.error, /enough Chrome users each month/);
    assert.match((await withoutBq.audit('up.test')).crux.error, /Set up BigQuery on a site/);
  } finally {
    withBq.stop();
    withoutBq.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
