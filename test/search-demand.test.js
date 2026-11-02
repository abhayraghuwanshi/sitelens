import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregateDemand, normalizeGroups, defaultGroups, classifier } from '../server/search-demand.mjs';
import { createStore } from '../server/store.mjs';

const groups = [{ name: 'Brand', pattern: 'cool[\\s-]*desk|coldesk' }, { name: 'Category', pattern: 'raycast' }];

test('first matching group wins; unmatched queries fall into Other', () => {
  const groupOf = classifier(groups);
  assert.equal(groupOf('Cool Desk app'), 'Brand');
  assert.equal(groupOf('coldesk'), 'Brand');
  assert.equal(groupOf('cooldesk raycast'), 'Brand', 'order decides overlaps');
  assert.equal(groupOf('raycast alternative windows'), 'Category');
  assert.equal(groupOf('dock for windows'), 'Other');
});

test('aggregation: daily series, impression-weighted position, period deltas and movers', () => {
  const dates = ['2026-10-01', '2026-10-02'];
  const rows = [
    { date: '2026-10-01', query: 'cooldesk', impressions: 10, clicks: 5, position: 1 },
    { date: '2026-10-02', query: 'cooldesk', impressions: 30, clicks: 9, position: 3 },
    { date: '2026-10-02', query: 'raycast alternative', impressions: 100, clicks: 4, position: 6 },
    { date: '2026-10-02', query: 'dock for windows', impressions: 8, clicks: 0, position: 11 },
  ];
  const prevRows = [
    { query: 'raycast alternative', impressions: 40, clicks: 1, position: 8 },
    { query: 'old query', impressions: 20, clicks: 0, position: 9 },
  ];
  const d = aggregateDemand({ rows, prevRows, groups, dates, siteTotals: { impressions: 200 } });
  const brand = d.groups.find((g) => g.name === 'Brand');
  assert.deepEqual(brand.daily.impressions, [10, 30]);
  assert.equal(brand.position, (10 * 1 + 30 * 3) / 40, 'position weighted by impressions');
  const cat = d.groups.find((g) => g.name === 'Category');
  assert.equal(cat.previous.impressions, 40);
  assert.equal(d.groups.at(-1).name, 'Other');
  assert.equal(d.anonymized, 200 - 148);
  assert.deepEqual(d.newQueries.map((q) => q.query), ['cooldesk', 'dock for windows']);
  assert.deepEqual(d.rising.map((q) => [q.query, q.change]), [['raycast alternative', 60]]);
  assert.deepEqual(d.falling.map((q) => [q.query, q.change]), [['old query', -20]]);
});

test('group validation', () => {
  assert.throws(() => normalizeGroups([{ name: 'Bad', pattern: '(' }]), /not a valid pattern/);
  assert.throws(() => normalizeGroups([{ name: 'Other', pattern: 'x' }]), /unique and not "Other"/);
  assert.throws(() => normalizeGroups([{ name: 'A', pattern: 'x' }, { name: 'a', pattern: 'y' }]), /unique/);
  assert.throws(() => normalizeGroups(Array.from({ length: 9 }, (_, i) => ({ name: `g${i}`, pattern: 'x' }))), /Up to 8/);
  assert.deepEqual(defaultGroups({ host: 'www.cool-desk.com' }), [{ name: 'Brand', pattern: 'cool[\\s-]*desk' }]);
});

test('editing a site in Settings keeps its saved query groups', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-'));
  try {
    const store = createStore(dir);
    const site = await store.saveSite({ host: 'cool-desk.com', searchGroups: groups });
    await store.saveSite({ id: site.id, host: 'cool-desk.com', label: 'Renamed' });
    const saved = await store.site(site.id);
    assert.equal(saved.label, 'Renamed');
    assert.deepEqual(saved.searchGroups, groups);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
