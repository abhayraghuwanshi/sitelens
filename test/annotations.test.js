import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createAnnotations, filterAnnotations, githubReleases, extensionVersions, annotationRoutes } from '../server/annotations.mjs';
import { placeAnnotations } from '../web/src/charts/annotations.js';

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'studio-notes-'));
}

function releasesDb(dir) {
  const path = join(dir, 'github.db');
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE repos (id INTEGER PRIMARY KEY, name TEXT, hidden BOOLEAN DEFAULT 0);
    CREATE TABLE releases (repo_id INTEGER, id INTEGER, tag_name TEXT, name TEXT, published_at TEXT, prerelease BOOLEAN DEFAULT 0, draft BOOLEAN DEFAULT 0);
    INSERT INTO repos (id, name) VALUES (1, 'me/app');
    INSERT INTO repos (id, name, hidden) VALUES (2, 'me/secret', 1);
    INSERT INTO releases VALUES (1, 10, 'v1.0.0', 'First', '2026-10-01T12:00:00Z', 0, 0);
    INSERT INTO releases VALUES (1, 11, 'v1.1.0-rc', NULL, '2026-10-10T08:00:00Z', 1, 0);
    INSERT INTO releases VALUES (1, 12, 'v2.0.0', NULL, NULL, 0, 1);
    INSERT INTO releases VALUES (2, 13, 'v9', NULL, '2026-10-05T00:00:00Z', 0, 0);
  `);
  db.close();
  return path;
}

test('githubReleases: published, visible releases in range, scoped to the repo', async () => {
  const dir = await tempDir();
  try {
    const path = releasesDb(dir);
    const all = githubReleases(path);
    assert.deepEqual(all.map((a) => a.label).sort(), ['app v1.0.0', 'app v1.1.0-rc (pre-release)']);
    assert.equal(all[0].scope, 'repo:me/app');
    assert.equal(all[0].kind, 'release');
    assert.match(all.find((a) => a.date === '2026-10-01').url, /releases\/tag\/v1\.0\.0$/);
    assert.equal(githubReleases(path, { from: '2026-10-05', to: '2026-10-31' }).length, 1);
    assert.deepEqual(githubReleases(join(dir, 'missing.db')), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('extensionVersions: marks the first day of each new version, not the baseline', () => {
  const out = extensionVersions([{
    id: 'a'.repeat(32), label: 'Cooldesk',
    history: [{ date: '2026-10-01', version: '1.0' }, { date: '2026-10-02', version: '1.0' }, { date: '2026-10-03', version: '1.1' }, { date: '2026-10-04' }],
  }]);
  assert.equal(out.length, 1);
  assert.deepEqual({ date: out[0].date, label: out[0].label, scope: out[0].scope, kind: out[0].kind },
    { date: '2026-10-03', label: 'Cooldesk v1.1', scope: `ext:${'a'.repeat(32)}`, kind: 'extension' });
});

test('filterAnnotations: range, scope (globals always pass), dedupe and sort', () => {
  const items = [
    { id: '1', date: '2026-10-05', label: 'b', scope: 'site:x' },
    { id: '2', date: '2026-10-02', label: 'global' },
    { id: '3', date: '2026-10-03', label: 'other', scope: 'site:y' },
    { id: '1', date: '2026-10-05', label: 'b', scope: 'site:x' },
    { id: '4', date: '2026-09-01', label: 'old' },
    { id: '5', date: 'bad', label: 'nope' },
  ];
  assert.deepEqual(filterAnnotations(items, { from: '2026-10-01', to: '2026-10-31', scopes: ['site:x'] }).map((a) => a.id), ['2', '1']);
  assert.deepEqual(filterAnnotations(items).map((a) => a.id), ['4', '2', '3', '1']);
});

test('annotations: notes round-trip, custom sources merge, a failing source is skipped', async () => {
  const dir = await tempDir();
  try {
    const store = createStore(dir);
    const annotations = createAnnotations({ store, log: {} });
    annotations.registerSource('vercel', async () => [{ id: 'dep-1', date: '2026-10-04', label: 'Deploy', kind: 'deploy', source: 'vercel', scope: 'site:x' }]);
    annotations.registerSource('broken', async () => { throw new Error('boom'); });

    const [get, post, del] = annotationRoutes({ annotations });
    const note = await post[2]({ body: { date: '2026-10-03', label: '  Posted on Reddit ', scope: 'site:x' } });
    assert.equal(note.label, 'Posted on Reddit');
    await post[2]({ body: { date: '2026-10-06', label: 'Global note' } });
    await assert.rejects(post[2]({ body: { date: '10/3', label: 'x' } }), /date/);
    await assert.rejects(post[2]({ body: { date: '2026-10-03', label: 'x', scope: 'nope' } }), /Scope/);

    const query = new URLSearchParams({ from: '2026-10-01', to: '2026-10-31', scope: 'site:x' });
    const { annotations: list } = await get[2]({ query });
    assert.deepEqual(list.map((a) => a.label), ['Posted on Reddit', 'Deploy', 'Global note']);
    assert.equal(list[0].kind, 'note');

    const other = await get[2]({ query: new URLSearchParams({ scope: 'site:y' }) });
    assert.deepEqual(other.annotations.map((a) => a.label), ['Global note']);

    await del[2]({ match: [null, note.id] });
    await assert.rejects(del[2]({ match: [null, 'dep-1'] }), /Only notes/);
    assert.equal((await store.get()).annotations.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('placeAnnotations: groups by matching chart date; hourly charts use the first hour', () => {
  const a = { id: 'a', date: '2026-10-02', label: 'A' };
  const b = { id: 'b', date: '2026-10-02', label: 'B' };
  const c = { id: 'c', date: '2026-12-25', label: 'off chart' };
  assert.deepEqual(placeAnnotations([a, b, c], ['2026-10-01', '2026-10-02']), [{ i: 1, items: [a, b] }]);
  assert.deepEqual(placeAnnotations([a], ['20261002', '20261002']), [{ i: 0, items: [a] }]);
  assert.deepEqual(placeAnnotations([a], []), []);
});
