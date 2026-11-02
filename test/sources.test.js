import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { githubOverview, githubRepo, platformForAsset, historyRange } from '../server/github.mjs';
import { parseListing, parseExtensionId, parseDashboardCsv, extensionView } from '../server/cws.mjs';
import { findListingProperty } from '../server/cws-ga.mjs';

const DAY = 86_400_000;
const iso = (offset) => `${new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)}T00:00:00Z`;

// A ghstats-shaped database: running totals with 0 gaps, daily traffic, cumulative download snapshots.
async function fixtureDb() {
  const dir = await mkdtemp(join(tmpdir(), 'ghstats-'));
  const path = join(dir, 'ghstats.db');
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE repos (id INTEGER PRIMARY KEY, name TEXT, description TEXT, archived BOOLEAN DEFAULT 0, stars_synced BOOLEAN DEFAULT 0, fork BOOLEAN DEFAULT 0, hidden BOOLEAN DEFAULT 0);
    CREATE TABLE repo_stats (repo_id INTEGER, date TEXT, stars INTEGER DEFAULT 0, forks INTEGER DEFAULT 0, watchers INTEGER DEFAULT 0, issues INTEGER DEFAULT 0,
      clones_count INTEGER DEFAULT 0, clones_uniques INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0, views_uniques INTEGER DEFAULT 0, prs INTEGER DEFAULT 0, PRIMARY KEY (repo_id, date));
    CREATE TABLE repo_referrers (repo_id INTEGER, date TEXT, referrer TEXT, count INTEGER, uniques INTEGER, count_delta INTEGER, uniques_delta INTEGER);
    CREATE TABLE repo_popular_paths (repo_id INTEGER, date TEXT, path TEXT, title TEXT, count INTEGER, uniques INTEGER, count_delta INTEGER, uniques_delta INTEGER);
    CREATE TABLE releases (repo_id INTEGER, id INTEGER, tag_name TEXT, name TEXT, published_at TEXT, prerelease BOOLEAN DEFAULT 0, draft BOOLEAN DEFAULT 0);
    CREATE TABLE release_assets (repo_id INTEGER, release_id INTEGER, id INTEGER, name TEXT, download_count INTEGER);
    CREATE TABLE release_stats (repo_id INTEGER, date TEXT, downloads INTEGER);
    INSERT INTO repos (id, name, description) VALUES (1, 'me/app', 'An app'), (2, 'me/lib', NULL);
    INSERT INTO repos (id, name, hidden) VALUES (3, 'me/secret', 1);
  `);
  const stat = db.prepare('INSERT INTO repo_stats (repo_id, date, stars, views_count, views_uniques, clones_count) VALUES (?, ?, ?, ?, ?, ?)');
  stat.run(1, iso(-40), 10, 0, 0, 0); // before a 28d range
  stat.run(1, iso(-5), 0, 4, 2, 1); // 0 stars = not recorded, carries 10 forward
  stat.run(1, iso(-2), 13, 6, 3, 0);
  stat.run(2, iso(-1), 5, 1, 1, 0);
  stat.run(3, iso(-1), 99, 99, 99, 99);
  const rel = db.prepare('INSERT INTO release_stats VALUES (1, ?, ?)');
  rel.run(iso(-30), 100); // baseline before the range
  rel.run(iso(-3), 140);
  rel.run(iso(-1), 150);
  db.exec(`
    INSERT INTO releases VALUES (1, 7, 'v1', 'App v1', '2026-10-01T00:00:00Z', 0, 0), (1, 8, 'v0', 'Draft', NULL, 0, 1);
    INSERT INTO release_assets VALUES (1, 7, 1, 'App-darwin.zip', 30), (1, 7, 2, 'App_x64.msi', 110), (1, 7, 3, 'App_x64.msi.sig', 50), (1, 8, 4, 'Draft.exe', 999);
    INSERT INTO repo_referrers VALUES (1, '${iso(-2)}', 'reddit.com', 9, 5, 4, 2), (1, '${iso(-1)}', 'reddit.com', 12, 6, 3, 1), (1, '${iso(-60)}', 'old.com', 50, 50, 50, 50);
  `);
  db.close();
  return { path, dir };
}

test('github overview: daily traffic sums, totals carry forward, downloads from snapshot deltas', async () => {
  const { path, dir } = await fixtureDb();
  try {
    const o = githubOverview(path, '28d');
    assert.deepEqual(o.repos.map((r) => r.name), ['me/app', 'me/lib'], 'hidden repos excluded');
    const app = o.repos.find((r) => r.name === 'me/app');
    assert.equal(app.views, 10);
    assert.equal(app.stars, 13);
    assert.equal(app.starsGained, 3, '13 now vs 10 before the range');
    assert.equal(app.downloads, 50, '150 - 100 baseline');
    assert.equal(app.downloadsTotal, 140, 'drafts and .sig files excluded');
    assert.equal(o.totals.stars, 18);
    assert.equal(o.series.stars.at(-1), 18);
    assert.equal(o.series.views.length, 28);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('github repo detail: referrers sum deltas in range, releases split by platform', async () => {
  const { path, dir } = await fixtureDb();
  try {
    const d = githubRepo(path, 'me/app', '28d');
    assert.deepEqual(d.referrers.map((r) => [r.name, r.count]), [['reddit.com', 7]]);
    assert.deepEqual(d.platforms, { macos: 30, windows: 110, linux: 0, other: 0 });
    assert.deepEqual(d.releases.map((r) => [r.tag, r.downloads]), [['v1', 140]]);
    assert.throws(() => githubRepo(path, 'me/secret', '28d'), /no visible repo/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('platform guess matches ghstats rules', () => {
  assert.equal(platformForAsset('CoolDesk_2.0.16_aarch64.dmg'), 'macos');
  assert.equal(platformForAsset('tool-x86_64-apple-darwin.tar.gz'), 'macos', 'darwin before win');
  assert.equal(platformForAsset('CoolDesk_x64-setup.exe'), 'windows');
  assert.equal(platformForAsset('CoolDesk_amd64.AppImage'), 'linux');
  assert.equal(platformForAsset('CoolDesk.exe.sig'), 'other');
  assert.equal(platformForAsset('latest.json'), 'other');
});

test('web store listing parser', () => {
  const html = `<title>New Tab by Cooldesk - Chrome Web Store</title><meta property="og:image" content="https://lh3/icon.png">
    <div>4.9 out of 5</div><span>7 ratings</span><div>1,234 users</div>
    <div>Version</div><div class="x">2.0.16</div><div>Updated</div><div class="x">October 8, 2026</div>`;
  assert.deepEqual(parseListing(html), {
    title: 'New Tab by Cooldesk', users: 1234, usersPlus: false, rating: 4.9, ratings: 7,
    version: '2.0.16', updated: 'October 8, 2026', icon: 'https://lh3/icon.png',
  });
  assert.equal(parseListing('<title>X - Chrome Web Store</title><div>10,000+ users</div>').usersPlus, true);
  assert.equal(parseListing('<title>X</title><div>1.2K ratings</div>').ratings, 1200);
  assert.throws(() => parseListing('<html>captcha</html>'), /Could not read/);
});

test('extension IDs come from links or bare IDs', () => {
  assert.equal(parseExtensionId('https://chromewebstore.google.com/detail/new-tab/ioggffobciopdddacpclplkeodllhjko?hl=en'), 'ioggffobciopdddacpclplkeodllhjko');
  assert.throws(() => parseExtensionId('not-an-id'), /32-letter/);
});

test('dashboard CSV: skips title and total rows, handles quotes and US dates', () => {
  const { metrics } = parseDashboardCsv('﻿Weekly users\r\nDate,Weekly users,"Installs, total"\r\n10/1/26,"1,204",5\r\n2026-10-02,1210,\r\nTotal,,5\r\n');
  assert.deepEqual(metrics, { 'Weekly users': { '2026-10-01': 1204, '2026-10-02': 1210 }, 'Installs, total': { '2026-10-01': 5 } });
  assert.throws(() => parseDashboardCsv('just,a,header\n'), /header row/);
});

test('extension view: change since the range started, imports aligned to range days', () => {
  const range = historyRange('7d', Date.parse('2026-10-30T12:00:00Z'));
  const view = extensionView({
    id: 'ioggffobciopdddacpclplkeodllhjko',
    history: [{ date: '2026-10-01', users: 40 }, { date: '2026-10-28', users: 55 }, { date: '2026-10-30', users: 58 }],
    imports: { Installs: { '2026-10-29': 3, '2026-09-01': 99 } },
  }, range);
  assert.equal(view.usersChange, 18, '58 now vs 40 before the range');
  assert.equal(view.history.length, 2);
  assert.deepEqual(view.imports.Installs, [null, null, null, null, null, 3, null]);
});

test('the store-listing GA4 property is the one named after the extension ID', () => {
  const props = [
    { id: '501374073', name: 'cooldesk-896b9', account: 'Default Account for Firebase' },
    { id: '521233089', name: 'ioggffobciopdddacpclplkeodllhjko', account: 'Chrome Web Store developer properties' },
  ];
  assert.equal(findListingProperty(props, 'ioggffobciopdddacpclplkeodllhjko').id, '521233089');
  assert.equal(findListingProperty(props, 'lgmmijdpaemlkihjmelodijggablcgdf'), null);
});
