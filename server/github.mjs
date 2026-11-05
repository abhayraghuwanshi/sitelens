// Reads GitHub stats from Studio's own SQLite file (.data/github.db), written by
// github-sync.mjs. The schema is ghstats' (github.com/vladkens/ghstats), so an
// imported ghstats history reads the same way. Opened read-only per request.
//
// Column semantics (same as ghstats):
//  - repo_stats.stars/forks/watchers/issues/prs: running totals snapshotted per
//    day; 0 means "not recorded that day" and carries the previous value forward.
//  - repo_stats.views_*/clones_*: daily counts, summed over a range.
//  - release_stats.downloads: running total of all non-draft asset downloads,
//    snapshotted per day (with gaps); daily downloads = snapshot differences.
//  - repo_referrers / repo_popular_paths: GitHub's rolling 14-day totals;
//    count_delta is the per-day increase, summed over a range.

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

export class SourceError extends Error {
  constructor(message, { kind = 'source', hint = '' } = {}) {
    super(message);
    this.kind = kind;
    this.hint = hint;
  }
}

export const HISTORY_RANGES = [
  { key: '7d', label: '7d', days: 7 },
  { key: '28d', label: '28d', days: 28 },
  { key: '90d', label: '90d', days: 90 },
  { key: '1y', label: '1y', days: 365 },
];

const DAY = 86_400_000;

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// UTC days, matching ghstats' 'YYYY-MM-DDT00:00:00Z' dates. Ends today.
export function historyRange(rangeKey = '28d', now = Date.now()) {
  const option = HISTORY_RANGES.find((r) => r.key === rangeKey) || HISTORY_RANGES[1];
  const end = isoDay(now);
  const start = isoDay(now - (option.days - 1) * DAY);
  const days = Array.from({ length: option.days }, (_, i) => isoDay(Date.parse(`${start}T00:00:00Z`) + i * DAY));
  return { key: option.key, days: option.days, start, end, dates: days };
}

// Release assets carry no platform metadata; guess from the file name (ported
// from ghstats' platform_for_asset — macOS first because "darwin" contains "win").
export function platformForAsset(name) {
  const n = String(name).toLowerCase();
  const has = (needles) => needles.some((x) => n.includes(x));
  if (n.endsWith('.sig')) return 'other';
  if (has(['darwin', 'macos', 'osx', 'apple', '-mac', '_mac', 'mac-', 'mac_', '.dmg', '.pkg', 'app.tar.gz', '.app.zip'])) return 'macos';
  if (has(['windows', 'win32', 'win64', '-win', '_win', 'win-', 'win_', '.exe', '.msi'])) return 'windows';
  if (has(['linux', 'appimage', '.deb', '.rpm', '.snap', '.flatpak'])) return 'linux';
  return 'other';
}

function open(path) {
  if (!path || !existsSync(path)) {
    throw new SourceError('No GitHub data yet.', { kind: 'needs-github', hint: 'Add a GitHub token in Settings → GitHub.' });
  }
  // timeout: wait out the ghstats writer's short transactions instead of failing with SQLITE_BUSY.
  return new DatabaseSync(path, { readOnly: true, timeout: 3000 });
}

function withDb(path, fn) {
  const db = open(path);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

const day = (date) => String(date).slice(0, 10);

// Per repo: totals carried forward to each day of the range, plus the value before it.
function carry(rows, field, range) {
  let value = 0;
  let before = null;
  let firstInRange = null;
  const byDay = new Map();
  for (const row of rows) {
    if (row[field] > 0) value = row[field];
    const d = day(row.date);
    if (d < range.start) before = value;
    else {
      byDay.set(d, value);
      if (firstInRange === null && value > 0) firstInRange = value;
    }
  }
  // Without a snapshot before the range, gains count from the first one inside it,
  // so a brand-new history doesn't report every existing star as gained.
  const baseline = before ?? firstInRange ?? value;
  let last = before ?? 0;
  const series = range.dates.map((d) => {
    if (byDay.has(d)) last = Math.max(last, byDay.get(d));
    return last;
  });
  return { before: baseline, now: value, series };
}

// Downloads per day from cumulative snapshots. The first snapshot ever has no
// baseline, so its total is not attributed to any day.
function downloadDeltas(snapshots, range) {
  const perDay = new Map();
  let prev = null;
  for (const s of snapshots) {
    if (prev !== null && s.downloads >= prev) perDay.set(day(s.date), (perDay.get(day(s.date)) || 0) + (s.downloads - prev));
    prev = s.downloads;
  }
  return range.dates.map((d) => perDay.get(d) || 0);
}

function loadAll(db, range, repoFilter = null) {
  const repos = db
    .prepare('SELECT id, name, description, archived, fork FROM repos WHERE hidden = 0 ORDER BY name')
    .all()
    .filter((r) => !repoFilter || (typeof repoFilter === 'string' ? r.name === repoFilter : repoFilter.has(r.name)));
  const ids = new Set(repos.map((r) => r.id));
  const stats = new Map();
  for (const row of db.prepare('SELECT * FROM repo_stats ORDER BY date').all()) {
    if (!ids.has(row.repo_id)) continue;
    if (!stats.has(row.repo_id)) stats.set(row.repo_id, []);
    stats.get(row.repo_id).push(row);
  }
  const releases = new Map();
  for (const row of db.prepare('SELECT repo_id, date, downloads FROM release_stats ORDER BY date').all()) {
    if (!ids.has(row.repo_id)) continue;
    if (!releases.has(row.repo_id)) releases.set(row.repo_id, []);
    releases.get(row.repo_id).push(row);
  }
  const totalDownloads = new Map(
    db
      .prepare(`SELECT a.repo_id, SUM(a.download_count) AS n FROM release_assets a
        JOIN releases r ON r.repo_id = a.repo_id AND r.id = a.release_id
        WHERE r.draft = 0 AND a.name NOT LIKE '%.sig' GROUP BY a.repo_id`)
      .all()
      .map((r) => [r.repo_id, r.n]),
  );

  return repos.map((repo) => {
    const rows = stats.get(repo.id) || [];
    const inRange = rows.filter((r) => day(r.date) >= range.start && day(r.date) <= range.end);
    const daily = (field) => range.dates.map((d) => inRange.find((r) => day(r.date) === d)?.[field] || 0);
    const stars = carry(rows, 'stars', range);
    const forks = carry(rows, 'forks', range);
    const downloads = downloadDeltas(releases.get(repo.id) || [], range);
    const series = {
      views: daily('views_count'),
      uniques: daily('views_uniques'),
      clones: daily('clones_count'),
      cloners: daily('clones_uniques'),
      downloads,
      stars: stars.series,
    };
    const sum = (list) => list.reduce((a, b) => a + b, 0);
    return {
      name: repo.name,
      description: repo.description || '',
      fork: Boolean(repo.fork),
      archived: Boolean(repo.archived),
      stars: stars.now,
      starsGained: Math.max(0, stars.now - stars.before),
      forks: forks.now,
      views: sum(series.views),
      uniques: sum(series.uniques),
      clones: sum(series.clones),
      downloads: sum(downloads),
      downloadsTotal: totalDownloads.get(repo.id) || 0,
      lastSeen: rows.length ? day(rows.at(-1).date) : '',
      series,
    };
  });
}

// `names` (a Set) limits the overview to those repos, e.g. the ones a site links to.
export function githubOverview(path, rangeKey, names = null) {
  const range = historyRange(rangeKey);
  return withDb(path, (db) => {
    const repos = loadAll(db, range, names);
    const totals = { views: 0, uniques: 0, clones: 0, downloads: 0, downloadsTotal: 0, stars: 0, starsGained: 0, forks: 0 };
    const series = { views: range.dates.map(() => 0), clones: range.dates.map(() => 0), downloads: range.dates.map(() => 0), stars: range.dates.map(() => 0) };
    for (const r of repos) {
      for (const key of Object.keys(totals)) totals[key] += r[key];
      for (const key of Object.keys(series)) r.series[key].forEach((v, i) => (series[key][i] += v));
    }
    const lastSync = db.prepare('SELECT MAX(date) AS d FROM repo_stats').get().d;
    const meta = readMeta(db);
    const coverage = meta.history_from || (meta.first_sync ? new Date(Date.parse(`${meta.first_sync}T00:00:00Z`) - 13 * DAY).toISOString().slice(0, 10) : '');
    return {
      range,
      totals,
      series,
      lastSync: lastSync ? day(lastSync) : '',
      historyStart: coverage || range.start,
      repos: repos.map(({ series: s, ...rest }) => ({ ...rest, spark: s.views })),
    };
  });
}

export function githubRepo(path, name, rangeKey) {
  const range = historyRange(rangeKey);
  return withDb(path, (db) => {
    const [repo] = loadAll(db, range, name);
    if (!repo) throw new SourceError(`ghstats has no visible repo named ${name}.`, { kind: 'notfound' });
    const popular = (table, col, extra = '') =>
      db
        .prepare(`SELECT ${col} AS name${extra}, SUM(t.count_delta) AS count, SUM(t.uniques_delta) AS uniques
          FROM ${table} t JOIN repos r ON r.id = t.repo_id
          WHERE r.name = ? AND t.date >= ? GROUP BY ${col} HAVING count > 0 ORDER BY count DESC LIMIT 15`)
        .all(name, range.start);
    const assets = db
      .prepare(`SELECT rl.tag_name AS tag, rl.name AS release, rl.published_at AS published, rl.prerelease,
          a.name AS asset, a.download_count AS downloads
        FROM releases rl JOIN repos r ON r.id = rl.repo_id
        LEFT JOIN release_assets a ON a.repo_id = rl.repo_id AND a.release_id = rl.id
        WHERE r.name = ? AND rl.draft = 0
        ORDER BY COALESCE(rl.published_at, '') DESC, a.id`)
      .all(name);

    const releases = [];
    const platforms = { macos: 0, windows: 0, linux: 0, other: 0 };
    for (const a of assets) {
      let rel = releases.at(-1);
      if (!rel || rel.tag !== a.tag) releases.push((rel = { tag: a.tag, name: a.release || a.tag, published: a.published || '', prerelease: Boolean(a.prerelease), downloads: 0, assets: [] }));
      if (!a.asset || a.asset.endsWith('.sig')) continue;
      rel.assets.push({ name: a.asset, downloads: a.downloads, platform: platformForAsset(a.asset) });
      rel.downloads += a.downloads;
      platforms[platformForAsset(a.asset)] += a.downloads;
    }

    return {
      range,
      repo,
      referrers: popular('repo_referrers', 't.referrer'),
      paths: popular('repo_popular_paths', 't.path', ', MAX(t.title) AS title'),
      releases,
      platforms,
    };
  });
}

function readMeta(db) {
  const has = db.prepare("SELECT name FROM sqlite_master WHERE name = 'sync_meta'").get();
  return has ? Object.fromEntries(db.prepare('SELECT key, value FROM sync_meta').all().map((r) => [r.key, r.value])) : {};
}

export function githubStatus(path) {
  try {
    return withDb(path, (db) => {
      const meta = readMeta(db);
      return { ok: true, repos: db.prepare('SELECT COUNT(*) AS n FROM repos WHERE hidden = 0').get().n, lastSync: meta.last_sync || '', login: meta.login || '' };
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Daily series for a set of repos over any { start, end, dates } range, e.g. a
// doubled range for previous-period deltas. Used by the product page.
export function githubRepoSeries(path, names, range) {
  const wanted = new Set(names);
  return withDb(path, (db) => loadAll(db, range).filter((r) => wanted.has(r.name)));
}
