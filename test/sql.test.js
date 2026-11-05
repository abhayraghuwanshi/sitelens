import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sql from '../server/sql.mjs';

const bq = { billingProject: 'pay-proj', dataProject: 'bigquery-public-data', dataset: 'ga4_obfuscated_sample_ecommerce' };
const range = sql.warehouseRange('28d', { endDate: '2021-01-31' });

test('warehouseRange ends yesterday by default, or at a fixed end date', () => {
  assert.equal(range.start, '20210104');
  assert.equal(range.end, '20210131');
  const now = new Date(2026, 9, 30, 15);
  const rolling = sql.warehouseRange('7d', { now });
  assert.equal(rolling.end, '20261029');
  assert.equal(rolling.start, '20261023');
  assert.equal(sql.warehouseRange('nonsense', { now }).days, 28);
});

test('events table is the wildcard in the data project and prunes on _TABLE_SUFFIX', () => {
  assert.equal(sql.eventsTable(bq), '`bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`');
  const { sql: text } = sql.eventsCatalogSql(bq, range);
  assert.match(text, /_TABLE_SUFFIX BETWEEN '20210104' AND '20210131'/);
});

test('identifiers with injection attempts are rejected', () => {
  assert.throws(() => sql.eventsTable({ ...bq, dataset: 'x`; DROP TABLE y; --' }), /Invalid BigQuery identifier/);
  assert.throws(() => sql.eventsCatalogSql(bq, { ...range, start: "2021' OR 1=1" }), /Invalid range/);
});

test('user values travel as parameters, never inline', () => {
  const nasty = "/x' OR '1'='1";
  const built = sql.pathsSql(bq, range, { startPath: nasty, depth: 99, top: 1 });
  assert.ok(!built.sql.includes(nasty));
  assert.equal(built.params.start_path, nasty);
  assert.equal(built.params.depth, 8, 'depth is clamped');
  assert.equal(built.params.top, 3, 'top is clamped');
  const breakdown = sql.paramBreakdownSql(bq, range, nasty, nasty);
  assert.ok(!breakdown.sql.includes(nasty));
  assert.deepEqual([breakdown.params.event_name, breakdown.params.param_key], [nasty, nasty]);
});

test('stream filter is a parameter and only appears when configured', () => {
  assert.ok(!sql.eventsCatalogSql(bq, range).sql.includes('stream_id'));
  const withStream = sql.eventsCatalogSql({ ...bq, streamId: '123' }, range);
  assert.match(withStream.sql, /stream_id = @stream_id/);
  assert.equal(withStream.params.stream_id, '123');
});

test('funnel chains each step after the previous one and counts in one pass', () => {
  const built = sql.funnelSql(bq, range, [
    { kind: 'page', value: '/' },
    { kind: 'event', value: 'add_to_cart' },
    { kind: 'event', value: 'purchase' },
  ]);
  assert.deepEqual([built.params.k0, built.params.k1, built.params.k2], ['page:/', 'event:add_to_cart', 'event:purchase']);
  assert.match(built.sql, /k = @k1 AND ts > t0/);
  assert.match(built.sql, /k = @k2 AND ts > t1/);
  assert.match(built.sql, /FROM f2\s*$/);
  assert.throws(() => sql.funnelSql(bq, range, [{ kind: 'page', value: '/' }]), /2–8 steps/);
});

test('a materialized sessions table replaces the raw-event scan', () => {
  const rolled = { ...bq, streamId: '9', sessionsTable: 'pay-proj.sitelens_x.sessions' };
  const built = sql.cohortsSql(rolled, range);
  assert.match(built.sql, /FROM `pay-proj.sitelens_x.sessions`/);
  assert.ok(!built.sql.includes('events_*'));
  assert.ok(!('stream_id' in built.params), 'rollup was already built for one stream');
});

test('console placeholders expand; sessions placeholder wraps the session CTE', () => {
  const plain = sql.expandConsoleSql(bq, range, 'SELECT 1 FROM {{events}} WHERE _TABLE_SUFFIX BETWEEN {{start}} AND {{end}};');
  assert.match(plain.sql, /events_\*` WHERE _TABLE_SUFFIX BETWEEN '20210104' AND '20210131'$/);
  const sessions = sql.expandConsoleSql(bq, range, 'SELECT COUNT(*) FROM {{sessions}}');
  assert.match(sessions.sql, /^WITH sessions AS/);
  assert.match(sessions.sql, /FROM sessions$/);
  assert.throws(() => sql.expandConsoleSql(bq, range, '   '), /Write a query/);
});

test('rollup creates a partitioned table in the billing project', () => {
  const built = sql.rollupSql({ ...bq, dataset: 'analytics_412345' }, range);
  assert.deepEqual(built.target, { project: 'pay-proj', dataset: 'sitelens_412345', table: 'sessions' });
  assert.match(built.sql, /^CREATE OR REPLACE TABLE `pay-proj.sitelens_412345.sessions`\nPARTITION BY session_date/);
});

test('table plan prefers daily tables and falls back to intraday per day', () => {
  const r = sql.warehouseRange('7d', { endDate: '2026-10-29' });
  const plan = sql.planSuffixes([
    'events_20261023', 'events_intraday_20261023', // both: daily wins
    'events_intraday_20261024', 'events_intraday_20261029',
    'events_intraday_20261030', // outside range
    'pseudonymous_users_20261024', 'events_20261001',
  ], r);
  assert.deepEqual(plan.suffixes, ['20261023', 'intraday_20261024', 'intraday_20261029']);
  assert.equal(plan.dailyDays, 1);
  assert.equal(plan.intradayDays, 2);

  const text = sql.eventsCatalogSql(bq, { ...r, ...plan }).sql;
  assert.match(text, /_TABLE_SUFFIX IN \('20261023', 'intraday_20261024', 'intraday_20261029'\)/);
  assert.throws(() => sql.eventsCatalogSql(bq, { ...r, suffixes: ["1' OR '1"] }), /Invalid table suffix/);
  assert.match(sql.expandConsoleSql(bq, { ...r, ...plan }, 'SELECT 1 FROM {{events}} WHERE {{range}}').sql, /WHERE \(_TABLE_SUFFIX IN/);
});

test('leavers name only plain goal events, and group by device and system', () => {
  const built = sql.leaversSql(bq, range, { steps: ['downloads_section_view', 'download_cta_click'], outcome: 'file_download' });
  assert.match(built.sql, /event_name IN \('downloads_section_view', 'download_cta_click'\)/);
  assert.match(built.sql, /event_name = 'file_download'/);
  for (const group of sql.LEAVER_GROUPS) assert.ok(built.sql.includes(`'${group}'`), group);
  assert.throws(() => sql.leaversSql(bq, range, { steps: ["x'; DROP"], outcome: 'file_download' }), /step events/);
  assert.throws(() => sql.leaversSql(bq, range, { steps: ['a'], outcome: '' }), /outcome/);
});

test('a leave-out rule filters sessions by country and engagement, and leavers too', () => {
  const rule = { countries: ['Singapore', 'China'], unengagedOnly: true };
  const withRule = { ...bq, leaveOut: rule };
  assert.equal(sql.leftOutWhere(bq), '');
  assert.equal(sql.leftOutWhere(withRule), "IFNULL(country, '') IN ('Singapore', 'China') AND NOT IFNULL(engaged, FALSE)");
  assert.equal(sql.leftOutWhere({ ...withRule, leaveOut: { ...rule, unengagedOnly: false } }), "IFNULL(country, '') IN ('Singapore', 'China')");
  // A materialized table may predate the engaged column: country only.
  assert.equal(sql.leftOutWhere({ ...withRule, sessionsTable: 'p.d.t' }), "IFNULL(country, '') IN ('Singapore', 'China')");
  assert.match(sql.cohortsSql(withRule, range).sql, /\) WHERE NOT \(IFNULL\(country, ''\) IN \('Singapore', 'China'\) AND NOT IFNULL\(engaged, FALSE\)\)/);
  assert.ok(!sql.cohortsSql(bq, range).sql.includes('WHERE NOT ('));
  const leavers = sql.leaversSql(withRule, range, { steps: ['a_step'], outcome: 'done' }).sql;
  assert.match(leavers, /s AS \(SELECT \* FROM raw WHERE NOT \(IFNULL\(country, ''\) IN/);
  assert.match(sql.leftOutSql(withRule, range).sql, /COUNTIF\(IFNULL\(country, ''\) IN \('Singapore', 'China'\) AND NOT IFNULL\(engaged, FALSE\)\) AS left_out/);
  // Names that could break out of the SQL string never reach it.
  assert.equal(sql.leftOutWhere({ ...bq, leaveOut: { countries: ["x') OR TRUE --"] } }), '');
});
