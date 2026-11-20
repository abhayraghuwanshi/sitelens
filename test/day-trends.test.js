import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainDay } from '../server/day-trends.mjs';

const DATE = '2026-11-15';
const weeks = ['2026-11-08', '2026-11-01', '2026-10-25', '2026-10-18'];
const row = (date, query, clicks, impressions, position) => ({ date, query, clicks, impressions, position });

test('fewer searches at the same position is a trend, not your page', () => {
  const rows = [...weeks.map((d) => row(d, 'dock for windows', 20, 400, 4)), row(DATE, 'dock for windows', 8, 160, 4.2)];
  const r = explainDay(rows, DATE);
  assert.equal(r.queries[0].why, 'demand');
  assert.equal(r.lead, 'demand');
  assert.match(r.verdict, /^Down 12 search clicks against a usual Sunday, mostly because fewer people searched/);
  assert.equal(Math.round(r.demandShift * 100), -60);
});

test('a worse position is "you ranked lower"; same searches and rank but fewer clicks is the click rate', () => {
  const rank = explainDay([...weeks.map((d) => row(d, 'a', 10, 200, 3)), row(DATE, 'a', 2, 190, 9)], DATE);
  assert.equal(rank.queries[0].why, 'rank');
  assert.match(rank.verdict, /you ranked lower/);
  const ctr = explainDay([...weeks.map((d) => row(d, 'a', 10, 200, 3)), row(DATE, 'a', 3, 210, 3.4)], DATE);
  assert.equal(ctr.queries[0].why, 'ctr');
});

test('new and gone searches; a usual day says so', () => {
  const r = explainDay([...weeks.map((d) => row(d, 'old', 5, 50, 5)), row(DATE, 'fresh', 6, 40, 3)], DATE);
  assert.deepEqual(r.queries.map((q) => [q.query, q.why]).sort(), [['fresh', 'new'], ['old', 'gone']]);
  const same = explainDay([...weeks.map((d) => row(d, 'a', 10, 200, 3)), row(DATE, 'a', 11, 205, 3)], DATE);
  assert.match(same.verdict, /^Search was about usual/);
});

test('the usual is the same weekday only, averaged over the weeks that have data', () => {
  const r = explainDay([row('2026-11-14', 'a', 99, 999, 1), row('2026-11-08', 'a', 10, 100, 3), row('2026-11-01', 'a', 20, 300, 3), row(DATE, 'a', 15, 200, 3)], DATE);
  assert.equal(r.weeks, 2);
  assert.equal(r.total.usualClicks, 15);
  assert.equal(r.total.usualImpressions, 200);
});
