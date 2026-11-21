import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warehouseRange } from '../server/sql.mjs';
import * as demo from '../server/demo-warehouse.mjs';

const range = warehouseRange('28d');

test('the demo world is deterministic', () => {
  const a = demo.demoFunnel(range, [{ kind: 'page', value: '/pricing' }, { kind: 'page', value: '/signup' }]);
  const b = demo.demoFunnel(range, [{ kind: 'page', value: '/pricing' }, { kind: 'page', value: '/signup' }]);
  assert.deepEqual(a, b);
});

test('funnel steps never grow and respect order', () => {
  const row = demo.demoFunnel(range, [
    { kind: 'page', value: '/pricing' },
    { kind: 'page', value: '/signup' },
    { kind: 'event', value: 'signup_start' },
    { kind: 'event', value: 'sign_up' },
  ]);
  assert.ok(row.step_0 > 0);
  assert.ok(row.step_0 >= row.step_1 && row.step_1 >= row.step_2 && row.step_2 >= row.step_3);
  assert.ok(row.step_3 > 0);
  // sign_up only follows signup_start, so the reverse order is impossible.
  const reversed = demo.demoFunnel(range, [{ kind: 'event', value: 'sign_up' }, { kind: 'event', value: 'signup_start' }]);
  assert.equal(reversed.step_1, 0);
});

test('paths: every step has edges and exits are exact per page', () => {
  const { rows, exits, total } = demo.demoPaths(range, { depth: 3, top: 5 });
  assert.ok(total > 0);
  assert.deepEqual([...new Set(rows.map((r) => r.step))], [0, 1, 2]);
  for (const step of [0, 1, 2]) assert.ok(rows.filter((r) => r.step === step).length <= 5);
  const signup = exits.find((e) => e.page === '/signup');
  assert.equal(signup.exits, signup.views, '/signup has no onward links in the demo site');
  const startFiltered = demo.demoPaths(range, { startPath: '/pricing' });
  assert.ok(startFiltered.rows.filter((r) => r.step === 0).every((r) => r.from_path === '/pricing'));
});

test('cohorts: week 0 is the largest cell of each cohort', () => {
  const rows = demo.demoCohorts(warehouseRange('90d'));
  const byCohort = Map.groupBy(rows, (r) => r.cohort);
  assert.ok(byCohort.size >= 12);
  for (const cells of byCohort.values()) {
    const w0 = cells.find((c) => c.week_offset === 0).users;
    assert.ok(cells.every((c) => c.users <= w0));
  }
});

test('event parameters break down by value', () => {
  const catalog = demo.demoEventsCatalog(range);
  assert.equal(catalog[0].event_name, 'page_view');
  const detail = demo.demoEventDetail(range, 'file_download');
  assert.ok(detail.keys.some((k) => k.key === 'download_os' && k.distinct_values === 3));
  const values = demo.demoParamBreakdown(range, 'file_download', 'download_os').map((v) => v.value).sort();
  assert.deepEqual(values, ['linux', 'macos', 'windows']);
});

test('routes: one row per came-from and path, newest paths included', () => {
  const routes = demo.demoRoutes(range, { outcome: 'sign_up', limit: 10 });
  assert.ok(routes.length > 0 && routes.length <= 10);
  assert.ok(routes.every((r) => r.path.length > 0 && r.sessions > 0 && r.converted <= r.sessions));
  assert.ok(routes[0].sessions >= routes.at(-1).sessions);
});

test('segments: ordered steps per group never grow', () => {
  const steps = [
    { kind: 'page', value: '/pricing' },
    { kind: 'page', value: '/signup' },
    { kind: 'event', value: 'sign_up' },
  ];
  const segments = demo.demoSegments(range, { by: 'country', steps, outcome: 'sign_up' });
  assert.ok(segments.length > 0);
  for (const row of segments) {
    assert.equal(row.steps.length, 3);
    for (let i = 1; i < row.steps.length; i++) assert.ok(row.steps[i] <= row.steps[i - 1]);
    assert.ok(row.converted <= row.sessions);
  }
  assert.equal(demo.demoSegments(range, { by: 'source', steps: [steps[0]], outcome: 'sign_up' }).length, 0);
});

test('sessions list filters by page and converting event', () => {
  const list = demo.demoSessionsList(range, { path: '/signup', converted: 'sign_up', limit: 10 });
  assert.ok(list.length > 0 && list.length <= 10);
  assert.ok(list.every((s) => s.pages.includes('/signup') && s.conversions > 0));
  assert.ok(list[0].started_at >= list.at(-1).started_at, 'newest first');
});

test('daily session summary reports returning visits and configured goal completions', () => {
  const day = warehouseRange('yesterday');
  const summary = demo.demoSessionsSummary(day, ['page:/']);
  assert.ok(summary.sessions > 0);
  assert.ok(summary.people > 0);
  assert.ok(summary.returning >= 0 && summary.returning <= summary.sessions);
  assert.ok(summary.goals.some((g) => g.key === 'page:/' && g.completions >= g.people && g.people > 0));
});
