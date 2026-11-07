import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCalendarStore, addDays, chunks, staleDays, topPerDay, fingerprint, HISTORY_DAYS } from '../server/calendar-store.mjs';

const HOUR = 3_600_000;
const NOW = new Date(2026, 10, 2, 15, 0, 0).getTime(); // Mon 2 Nov 2026, local 15:00
const SITE = { id: 'a', label: 'A', host: 'a.com', propertyId: '123', searchSite: 'sc-domain:a.com' };

// Fake GA4/GSC that answer from a per-day table and record every request.
function fakeGoogle() {
  const calls = [];
  let fail = false;
  const ga = (from, to) => {
    const rows = [];
    for (let d = from; d <= to; d = addDays(d, 1)) rows.push({ date: d.replaceAll('-', ''), sessions: 10, activeUsers: 8, screenPageViews: 20, sessionSource: 'google', landingPage: '/' });
    return rows;
  };
  return {
    calls,
    setFail: (v) => (fail = v),
    report: async ({ body }) => {
      const { startDate, endDate } = body.dateRanges[0];
      calls.push({ api: 'ga4', dims: body.dimensions.map((d) => d.name).join(','), from: startDate, to: endDate });
      if (fail) throw new Error('offline');
      return { rows: ga(startDate, endDate) };
    },
    search: async ({ body }) => {
      calls.push({ api: 'gsc', dims: body.dimensions.join(','), from: body.startDate, to: body.endDate });
      if (fail) throw new Error('offline');
      const rows = [];
      // Search Console has reported through three days ago.
      const last = addDays('2026-11-02', -3);
      for (let d = body.startDate; d <= body.endDate && d <= last; d = addDays(d, 1)) rows.push({ key: d, keys: body.dimensions.length === 2 ? [d, 'foo'] : [d], clicks: 5, impressions: 50 });
      return rows;
    },
  };
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'studio-calstore-'));
  const google = fakeGoogle();
  let t = NOW;
  const history = createCalendarStore({ dbPath: join(dir, 'calendar.db'), auth: { token: async () => 't' }, report: google.report, search: google.search, now: () => t, log: {} });
  return { dir, google, history, tick: (ms) => (t += ms), done: async () => { history.stop(); await rm(dir, { recursive: true, force: true }); } };
}

test('pure helpers: chunks, staleDays, topPerDay, fingerprint', () => {
  assert.deepEqual(chunks('2026-10-01', '2026-10-05', 2), [['2026-10-01', '2026-10-02'], ['2026-10-03', '2026-10-04'], ['2026-10-05', '2026-10-05']]);
  const fetched = new Map([['2026-10-01', 0], ['2026-10-31', NOW - 2 * HOUR], ['2026-11-01', NOW - 60_000]]);
  // Settled days are never refetched; recent ones only when older than 30 minutes; missing ones always.
  assert.deepEqual(staleDays(fetched, { from: '2026-10-01', to: '2026-11-05', today: '2026-11-02', settle: 3, now: NOW }).filter((d) => d < '2026-10-03' || d > '2026-10-29'),
    ['2026-10-02', '2026-10-30', '2026-10-31', '2026-11-02']);
  assert.deepEqual(topPerDay([{ date: 'd', value: 1 }, { date: 'd', value: 3 }, { date: 'e', value: 2 }], 1), [{ date: 'd', value: 3 }, { date: 'e', value: 2 }]);
  assert.notEqual(fingerprint(SITE), fingerprint({ ...SITE, includeSubdomains: true }));
});

test('totals: one history pull, then only the days that can still change', async () => {
  const { google, history, tick, done } = await setup();
  try {
    const first = await history.series(SITE, '2026-10-01', '2026-11-02');
    assert.equal(first.ga.get('2026-10-14').sessions, 10);
    assert.equal(first.sc.values.get('2026-10-30'), 5);
    assert.equal(first.sc.last, '2026-10-30');
    assert.deepEqual(google.calls.map((c) => [c.api, c.from, c.to]), [
      ['ga4', addDays('2026-11-02', -HISTORY_DAYS), '2026-11-02'],
      ['gsc', addDays('2026-11-02', -HISTORY_DAYS), '2026-11-02'],
    ]);

    // Within 30 minutes: straight from the store.
    await history.series(SITE, '2026-10-01', '2026-11-02');
    assert.equal(google.calls.length, 2);

    // Later: stored rows answer at once, and a delta from the first unsettled day runs behind them.
    tick(HOUR);
    await history.series(SITE, '2026-10-01', '2026-11-02');
    await history.idle();
    assert.deepEqual(google.calls.slice(2).map((c) => [c.api, c.from, c.to]), [['ga4', '2026-10-31', '2026-11-02'], ['gsc', '2026-10-29', '2026-11-02']]);

    // Older than the window: only the missing span is fetched.
    await history.series(SITE, '2025-01-01', '2025-01-31');
    assert.deepEqual(google.calls.slice(4).map((c) => [c.api, c.from]), [['ga4', '2025-01-01'], ['gsc', '2025-01-01']]);
  } finally {
    await done();
  }
});

test('offline: stored rows answer when Google fails; uncovered ranges still fail', async () => {
  const { google, history, tick, done } = await setup();
  try {
    await history.series(SITE, '2026-10-01', '2026-11-02');
    google.setFail(true);
    tick(HOUR);
    const r = await history.series(SITE, '2026-10-01', '2026-11-02');
    assert.equal(r.ga.get('2026-10-14').sessions, 10);
    assert.equal(r.sc.values.get('2026-10-14'), 5);
    await assert.rejects(history.series(SITE, '2024-01-01', '2024-01-31'), /offline/);
    assert.equal(history.status().sites[0].error, 'offline');
  } finally {
    await done();
  }
});

test('changing the site setup wipes its stored rows', async () => {
  const { google, history, done } = await setup();
  try {
    await history.series(SITE, '2026-10-01', '2026-11-02');
    await history.series({ ...SITE, propertyId: '999' }, '2026-10-01', '2026-11-02');
    assert.equal(google.calls.filter((c) => c.api === 'ga4' && c.from === addDays('2026-11-02', -HISTORY_DAYS)).length, 2);
    history.forget('a');
    assert.equal(history.status().sites.length, 0);
  } finally {
    await done();
  }
});

test('breakdowns: fetched once per day, recent days refreshed, top rows kept', async () => {
  const { google, history, tick, done } = await setup();
  try {
    const rows = await history.breakdown(SITE, 'source', '2026-10-01', '2026-11-02');
    assert.equal(rows.length, 33);
    assert.deepEqual({ ...rows[0] }, { date: '2026-10-01', key: 'google', value: 10 });
    assert.deepEqual(google.calls.map((c) => [c.dims, c.from, c.to]), [['date,sessionSource', '2026-10-01', '2026-10-31'], ['date,sessionSource', '2026-11-01', '2026-11-02']]);

    await history.breakdown(SITE, 'source', '2026-10-10', '2026-10-20');
    assert.equal(google.calls.length, 2);
    tick(HOUR);
    await history.breakdown(SITE, 'source', '2026-10-10', '2026-11-02');
    await history.idle();
    assert.deepEqual(google.calls.slice(2).map((c) => [c.from, c.to]), [['2026-10-31', '2026-11-02']]);

    const queries = await history.breakdown(SITE, 'query', '2026-10-28', '2026-10-30');
    assert.deepEqual(queries.map((r) => r.key), ['foo', 'foo', 'foo']);
    await assert.rejects(history.breakdown(SITE, 'nope', '2026-10-01', '2026-10-02'), /Unknown breakdown/);
  } finally {
    await done();
  }
});

test('syncAll: deltas and the past week of breakdowns for real sites only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-calstore-'));
  const google = fakeGoogle();
  const store = { sites: async () => [SITE, { id: 'demo', demo: true }] };
  const history = createCalendarStore({ dbPath: join(dir, 'calendar.db'), store, auth: { token: async () => 't' }, report: google.report, search: google.search, now: () => NOW, log: {} });
  try {
    const result = await history.syncAll();
    assert.deepEqual(result, [{ id: 'a', ok: true }]);
    assert.deepEqual(google.calls.filter((c) => c.dims.includes(',')).map((c) => [c.dims, c.from, c.to]), [
      ['date,sessionSource', '2026-10-26', '2026-11-01'],
      ['date,landingPage', '2026-10-26', '2026-11-01'],
      ['date,query', '2026-10-26', '2026-11-01'],
    ]);
  } finally {
    history.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
