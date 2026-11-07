import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextGoal, progress, currentValue, guessPurpose } from '../server/page-goals.mjs';

const today = '2026-11-07';
const q = (query, clicks, impressions, position) => ({ query, clicks, impressions, position });
const row = (path, patch = {}) => ({ path, visits: 0, engagementRate: 0.5, google: null, bing: null, ...patch });
const goal = (r, ctx = {}) => nextGoal(r, { days: 90, today, ...ctx });

test('search pages climb one rung at a time', () => {
  assert.equal(goal(row('/blog/x')).next.key, 'search:shown');
  // Shown a handful of times a month: aim it at a real search before chasing a position.
  const rare = goal(row('/founder', { google: { clicks: 0, impressions: 3, position: 7, queries: [] } })).next;
  assert.deepEqual([rare.key, rare.from, rare.to], ['search:demand', 3, 300]);
  const at = (pos) => goal(row('/blog/x', { google: { clicks: 3, impressions: 9000, position: pos, queries: [q('raycast windows', 3, 9000, pos)] } })).next;
  assert.deepEqual([at(34).key, at(34).to], ['search:page2', 20]);
  assert.deepEqual([at(14.8).key, at(14.8).to, at(14.8).query], ['search:page1', 10, 'raycast windows']);
  assert.deepEqual([at(8.2).key, at(8.2).to], ['search:top3', 3]);
  assert.match(at(14.8).gain, /^about 59 more clicks a month \(60 at position 10\)$/);
  assert.equal(at(14.8).checkBy, '2026-12-19');
  // Top 3 but rarely clicked: win the click before anything else.
  const ctr = goal(row('/blog/x', { google: { clicks: 9, impressions: 900, position: 2, queries: [q('raycast windows', 9, 900, 2)] } })).next;
  assert.deepEqual([ctr.key, ctr.from, ctr.to], ['search:ctr', 0.01, 0.16]);
  // Top 3 and clicked: go after its next search.
  const second = goal(row('/blog/x', { google: { clicks: 150, impressions: 3900, position: 2, queries: [q('raycast windows', 150, 900, 2), q('raycast alternative', 2, 3000, 13)] } })).next;
  assert.deepEqual([second.key, second.query, second.from], ['search:page1', 'raycast alternative', 13]);
  // Its searches are too small to be worth climbing: aim at a real one.
  const tiny = goal(row('/vs/alfred', { google: { clicks: 0, impressions: 200, position: 25, queries: [q('alfred alternatief', 0, 200, 25)] } })).next;
  assert.equal(tiny.key, 'search:demand');
  // Already earning, but near the ceiling of its searches: go after a bigger one.
  const ceiling = goal(row('/blog/dock', { google: { clicks: 120, impressions: 600, position: 1.5, queries: [q('dock for windows', 100, 400, 1.2), q('windows dock', 20, 200, 3.2)] } })).next;
  assert.equal(ceiling.key, 'search:bigger');
});

test('purpose: guessed from the page, conversions and reading judged against the site', () => {
  assert.equal(guessPurpose(row('/docs/setup')), 'help');
  assert.equal(guessPurpose(row('/download'), { converts: true }), 'convert');
  assert.equal(guessPurpose(row('/download')), 'search');
  const convert = goal(row('/download', { visits: 300 }), { siteRate: 0.08, conversion: { visitors: 300, goalUsers: 12, rate: 0.04 }, outcome: 'Downloaded' });
  assert.deepEqual([convert.purpose, convert.serving, convert.next.key, convert.next.to], ['convert', 'partly', 'convert:rate', 0.08]);
  assert.match(convert.next.title, /site’s average: 8.0% Downloaded/);
  const help = goal(row('/docs/setup', { visits: 120, engagementRate: 0.3 }), { siteEngagement: 0.55 });
  assert.deepEqual([help.purpose, help.serving, help.next.to], ['help', 'no', 0.55]);
  // Chosen purpose without enough visitors to judge: getting found comes first.
  const thin = goal(row('/download', { visits: 5 }), { purpose: 'convert', siteRate: 0.08, conversion: { visitors: 5, goalUsers: 0, rate: 0 } });
  assert.deepEqual([thin.purpose, thin.chosen, thin.next.key], ['convert', true, 'search:shown']);
  assert.match(thin.note, /getting found comes first/);
});

test('progress toward a saved goal', () => {
  const target = { metric: 'position', query: 'raycast windows', from: 14.8, to: 10 };
  const r = row('/blog/x', { google: { queries: [q('raycast windows', 10, 900, 11.2)] } });
  assert.deepEqual(progress(target, currentValue(target, r)), { now: 11.2, reached: false, share: 0.75 });
  assert.equal(progress(target, 9.6).reached, true);
  assert.deepEqual(progress({ metric: 'rate', from: 0.04, to: 0.08 }, 0.06), { now: 0.06, reached: false, share: 0.5 });
  assert.equal(progress(target, null), null);
});
