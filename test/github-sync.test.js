import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitHubSync, openWritable } from '../server/github-sync.mjs';
import { githubOverview, githubRepo } from '../server/github.mjs';

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// Fake GitHub REST API: two repos (one without push access), traffic, referrers, releases.
function fakeGitHub({ referrerCount = 10 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = String(url).replace('https://api.github.com', '');
    calls.push({ path, auth: init.headers.Authorization });
    const json = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'x-ratelimit-remaining': '4990', 'x-oauth-scopes': 'repo', ...headers } });
    if (path === '/user') return json({ login: 'me' });
    if (path.startsWith('/user/repos')) {
      return json([
        { id: 1, full_name: 'me/app', description: 'App', archived: false, fork: false, stargazers_count: 12, forks_count: 2, watchers_count: 12, open_issues_count: 1, permissions: { push: true } },
        { id: 2, full_name: 'other/readonly', permissions: { push: false } },
      ]);
    }
    if (path === '/repos/me/app/traffic/views') return json({ views: [{ timestamp: `${daysAgo(1)}T00:00:00Z`, count: 7, uniques: 3 }, { timestamp: `${today}T00:00:00Z`, count: 2, uniques: 1 }] });
    if (path === '/repos/me/app/traffic/clones') return json({ clones: [{ timestamp: `${daysAgo(1)}T00:00:00Z`, count: 4, uniques: 2 }] });
    if (path === '/repos/me/app/traffic/popular/referrers') return json([{ referrer: 'reddit.com', count: referrerCount, uniques: 5 }]);
    if (path === '/repos/me/app/traffic/popular/paths') return json([{ path: '/me/app', title: 'Overview', count: 9, uniques: 4 }]);
    if (path.startsWith('/repos/me/app/releases')) {
      return json([
        { id: 70, tag_name: 'v1', name: 'v1', published_at: '2026-10-01T00:00:00Z', prerelease: false, draft: false,
          assets: [{ id: 1, name: 'App.dmg', download_count: 30 }, { id: 2, name: 'App.msi', download_count: 70 }] },
        { id: 71, tag_name: 'v2-draft', draft: true, assets: [{ id: 3, name: 'x.exe', download_count: 500 }] },
      ]);
    }
    return new Response('{"message":"Not Found"}', { status: 404 });
  };
  return { fetchImpl, calls };
}

test('sync writes a ghstats-compatible database the GitHub views can read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ghsync-'));
  try {
    const { fetchImpl, calls } = fakeGitHub();
    const sync = createGitHubSync({ dbPath: join(dir, 'github.db'), getToken: async () => 'tok', fetchImpl, log: {} });
    const result = await sync.sync();
    assert.equal(result.repos, 1, 'repos without push access are skipped (traffic needs it)');
    assert.ok(calls.every((c) => c.auth === 'Bearer tok'));
    assert.ok(!calls.some((c) => c.path.includes('other/readonly')));
    assert.equal(sync.status().login, 'me');

    const o = githubOverview(sync.dbPath, '7d');
    const app = o.repos.find((r) => r.name === 'me/app');
    assert.equal(app.stars, 12);
    assert.equal(app.starsGained, 0, 'first-ever snapshot is the baseline, not +12');
    assert.equal(o.historyStart, daysAgo(13), 'coverage = the 14-day window before the first sync');
    assert.equal(app.views, 9);
    assert.equal(app.clones, 4);
    assert.equal(app.downloadsTotal, 100, 'draft release excluded');
    const d = githubRepo(sync.dbPath, 'me/app', '7d');
    assert.deepEqual(d.referrers.map((r) => [r.name, r.count]), [['reddit.com', 10]]);
    assert.deepEqual(d.platforms, { macos: 30, windows: 70, linux: 0, other: 0 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('referrer deltas follow ghstats: per-day increase of the rolling 14-day total, never negative', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ghsync-'));
  try {
    const dbPath = join(dir, 'github.db');
    const db = openWritable(dbPath);
    db.prepare('INSERT INTO repos (id, name) VALUES (1, ?)').run('me/app');
    db.prepare('INSERT INTO repo_referrers (repo_id, date, referrer, count, uniques) VALUES (1, ?, ?, 6, 3)').run(`${daysAgo(1)}T00:00:00Z`, 'reddit.com');
    db.close();
    const sync = createGitHubSync({ dbPath, getToken: async () => 'tok', fetchImpl: fakeGitHub({ referrerCount: 10 }).fetchImpl, log: {} });
    await sync.sync();
    const check = new DatabaseSync(dbPath, { readOnly: true });
    const rows = check.prepare("SELECT substr(date,1,10) d, count, count_delta FROM repo_referrers WHERE referrer = 'reddit.com' ORDER BY date").all();
    check.close();
    assert.deepEqual(rows.map((r) => [r.d, r.count, r.count_delta]), [[daysAgo(1), 6, 6], [today, 10, 4]]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('no token: sync explains how to connect', async () => {
  const sync = createGitHubSync({ dbPath: join(tmpdir(), 'never.db'), getToken: async () => '', fetchImpl: async () => { throw new Error('no network'); }, log: {} });
  await assert.rejects(sync.sync(), /Add a GitHub token/);
});

test('one-time import copies older ghstats history and keeps no link to it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ghsync-'));
  try {
    const src = join(dir, 'ghstats.db');
    const old = new DatabaseSync(src);
    old.exec(`CREATE TABLE repos (id INTEGER PRIMARY KEY, name TEXT, description TEXT, archived BOOLEAN, stars_synced BOOLEAN, fork BOOLEAN, hidden BOOLEAN);
      CREATE TABLE repo_stats (repo_id INTEGER, date TEXT, stars INTEGER DEFAULT 0, forks INTEGER DEFAULT 0, watchers INTEGER DEFAULT 0, issues INTEGER DEFAULT 0,
        clones_count INTEGER DEFAULT 0, clones_uniques INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0, views_uniques INTEGER DEFAULT 0, prs INTEGER DEFAULT 0, PRIMARY KEY (repo_id, date));
      INSERT INTO repos VALUES (1, 'me/app', 'App', 0, 1, 0, 0);
      INSERT INTO repo_stats (repo_id, date, stars, views_count) VALUES (1, '2021-03-24T00:00:00Z', 3, 40), (1, '${today}T00:00:00Z', 11, 50);`);
    old.close();

    const sync = createGitHubSync({ dbPath: join(dir, 'studio', 'github.db'), getToken: async () => 'tok', fetchImpl: fakeGitHub().fetchImpl, log: {} });
    await sync.sync();
    const counts = sync.importFrom(src);
    assert.equal(counts.repo_stats, 1, 'only the missing 2021 day is new');
    const db = new DatabaseSync(sync.dbPath, { readOnly: true });
    const rows = db.prepare('SELECT substr(date,1,10) d, stars, views_count v FROM repo_stats ORDER BY date').all();
    const attached = db.prepare('PRAGMA database_list').all().map((r) => r.name);
    db.close();
    assert.equal(rows[0].d, '2021-03-24');
    const todayRow = rows.find((r) => r.d === today);
    assert.deepEqual([todayRow.stars, todayRow.v], [12, 50], 'same day: larger values win');
    assert.deepEqual(attached, ['main']);
    assert.equal(githubOverview(sync.dbPath, '1y').historyStart, '2021-03-24', 'imported history extends coverage');
    assert.throws(() => sync.importFrom(join(dir, 'nope.db')), /No database/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
