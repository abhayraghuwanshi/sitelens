import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngines } from '../server/engines.mjs';

const engines = createEngines({ auth: {}, bigquery: {} });

test('daily warehouse summary returns demo goal and returning-visit data', async () => {
  const result = await engines.daySummary({ id: 'demo', demo: true }, new Date().toISOString().slice(0, 10), ['page:/']);
  assert.equal(result.source, 'demo');
  assert.ok(result.summary.sessions > 0);
  assert.ok(result.summary.returning <= result.summary.sessions);
  assert.ok(result.summary.goals.some((g) => g.key === 'page:/'));
});

test('daily warehouse summary rejects invalid dates and goal keys', async () => {
  const site = { id: 'demo', demo: true };
  await assert.rejects(engines.daySummary(site, '2026-02-31'), /Pick a date/);
  await assert.rejects(engines.daySummary(site, '2026-01-01', ['event:invalid name']), /Goal keys/);
});

test('a day of visitors comes back shaped like Live people, pages and own events in order', async () => {
  const day = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const result = await engines.daySessions({ id: 'demo', demo: true }, day);
  assert.ok(result.people.length > 0);
  const p = result.people[0];
  assert.ok(p.first <= p.last);
  assert.ok(p.pages.every((pg) => pg.path.startsWith('/')));
  assert.ok(p.did.every((d) => !/^(page_view|session_start|first_visit|user_engagement|scroll)$/.test(d.name)));
  assert.ok(result.people.some((x) => !x.new), 'some visitors are returning');
});

test('dayPerson collapses reloads and marks goals', async () => {
  const { dayPerson } = await import('../server/engines.mjs');
  const p = dayPerson({
    user_id: 'u123456789', session_id: 7, started_at: 1_000_000, ended_at: 61_000_000, device: 'desktop', system: 'Phones and tablets', visit_source: 'google', returning: true,
    steps: [{ k: 'page:/a', ts: 1_000_000 }, { k: 'page:/a', ts: 2_000_000 }, { k: 'event:sign_up', ts: 3_000_000 }, { k: 'page:/b', ts: 4_000_000 }],
  });
  assert.deepEqual(p.pages.map((x) => x.path), ['/a', '/b']);
  assert.deepEqual(p.did.map((d) => [d.name, d.kind]), [['sign_up', 'goal']]);
  assert.equal(p.new, false);
  assert.equal(p.os, '');
  assert.equal(p.last - p.first, 60_000);
});
