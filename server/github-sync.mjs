// Studio's own GitHub sync: a personal access token, the GitHub REST API, and
// a SQLite file under .data/. The schema matches ghstats' (github.com/vladkens/ghstats)
// so github.mjs reads either, and a ghstats database can be imported once to
// keep history older than GitHub's 14-day traffic window.

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SourceError } from './github.mjs';

const API = 'https://api.github.com';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT NULL,
  archived BOOLEAN DEFAULT FALSE, stars_synced BOOLEAN DEFAULT FALSE,
  fork BOOLEAN DEFAULT FALSE, hidden BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS repo_stats (
  repo_id INTEGER NOT NULL, date TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0, forks INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0, issues INTEGER NOT NULL DEFAULT 0,
  clones_count INTEGER NOT NULL DEFAULT 0, clones_uniques INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0, views_uniques INTEGER NOT NULL DEFAULT 0,
  prs INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (repo_id, date)
);
CREATE TABLE IF NOT EXISTS repo_referrers (
  repo_id INTEGER NOT NULL, date TEXT NOT NULL, referrer TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0, uniques INTEGER NOT NULL DEFAULT 0,
  count_delta INTEGER NOT NULL DEFAULT 0, uniques_delta INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (repo_id, date, referrer)
);
CREATE TABLE IF NOT EXISTS repo_popular_paths (
  repo_id INTEGER NOT NULL, date TEXT NOT NULL, path TEXT NOT NULL, title TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0, uniques INTEGER NOT NULL DEFAULT 0,
  count_delta INTEGER NOT NULL DEFAULT 0, uniques_delta INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (repo_id, date, path)
);
CREATE TABLE IF NOT EXISTS releases (
  repo_id INTEGER NOT NULL, id INTEGER NOT NULL, tag_name TEXT NOT NULL, name TEXT DEFAULT NULL,
  published_at TEXT DEFAULT NULL, prerelease BOOLEAN NOT NULL DEFAULT FALSE, draft BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (repo_id, id)
);
CREATE TABLE IF NOT EXISTS release_assets (
  repo_id INTEGER NOT NULL, release_id INTEGER NOT NULL, id INTEGER NOT NULL,
  name TEXT NOT NULL, download_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (repo_id, id)
);
CREATE TABLE IF NOT EXISTS release_stats (
  repo_id INTEGER NOT NULL, date TEXT NOT NULL, downloads INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (repo_id, date)
);
CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT);
`;

const TABLES = ['repos', 'repo_stats', 'repo_referrers', 'repo_popular_paths', 'releases', 'release_assets', 'release_stats'];

export function openWritable(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

const todayKey = (now = Date.now()) => `${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`;
const dayKey = (timestamp) => `${String(timestamp).slice(0, 10)}T00:00:00Z`;

// GitHub's popular referrers/paths are rolling 14-day totals; ghstats stores
// each day's snapshot and the per-day increase (never negative).
export function recomputeDeltas(db) {
  for (const [table, col] of [['repo_referrers', 'referrer'], ['repo_popular_paths', 'path']]) {
    db.exec(`
      WITH cte AS (
        SELECT repo_id, date, ${col}, uniques, count,
          LAG(uniques) OVER (PARTITION BY repo_id, ${col} ORDER BY date) AS prev_uniques,
          LAG(count) OVER (PARTITION BY repo_id, ${col} ORDER BY date) AS prev_count
        FROM ${table}
      )
      UPDATE ${table} AS t SET
        uniques_delta = MAX(0, cte.uniques - COALESCE(cte.prev_uniques, 0)),
        count_delta = MAX(0, cte.count - COALESCE(cte.prev_count, 0))
      FROM cte
      WHERE t.repo_id = cte.repo_id AND t.date = cte.date AND t.${col} = cte.${col};`);
  }
}

export function createGitHubSync({ dbPath, getToken, fetchImpl = fetch, log = console }) {
  let running = null;
  const state = { lastRun: 0, lastError: '', repos: 0, rateRemaining: null, login: '', scopes: '' };

  async function gh(path, token, { optional = false } = {}) {
    const res = await fetchImpl(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'kauzl',
      },
      signal: AbortSignal.timeout(30_000),
    });
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining !== null) state.rateRemaining = Number(remaining);
    if (res.headers.get('x-oauth-scopes') !== null) state.scopes = res.headers.get('x-oauth-scopes');
    // Traffic endpoints need push access; repos the token can read but not push are skipped.
    if (optional && (res.status === 403 || res.status === 404)) return null;
    if (res.status === 401) throw new SourceError('GitHub rejected the token (401). Create a new one and save it in Settings.', { kind: 'auth' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new SourceError(`GitHub ${path}: ${body.message || `HTTP ${res.status}`}`, { kind: 'source' });
    }
    return { data: await res.json(), next: /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '')?.[1]?.replace(API, '') };
  }

  async function paginate(path, token) {
    const out = [];
    let next = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
    for (let page = 0; next && page < 30; page += 1) {
      const res = await gh(next, token);
      out.push(...res.data);
      next = res.next;
    }
    return out;
  }

  async function syncRepo(db, repo, token, date) {
    const name = repo.full_name;
    const [views, clones, refs, paths, releases] = await Promise.all([
      gh(`/repos/${name}/traffic/views`, token, { optional: true }),
      gh(`/repos/${name}/traffic/clones`, token, { optional: true }),
      gh(`/repos/${name}/traffic/popular/referrers`, token, { optional: true }),
      gh(`/repos/${name}/traffic/popular/paths`, token, { optional: true }),
      paginate(`/repos/${name}/releases`, token).catch(() => []),
    ]);

    // Running totals for today; traffic rows are daily counts keyed by GitHub's own dates.
    db.prepare(`INSERT INTO repo_stats (repo_id, date, stars, forks, watchers, issues) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo_id, date) DO UPDATE SET stars = excluded.stars, forks = excluded.forks,
        watchers = excluded.watchers, issues = excluded.issues`)
      .run(repo.id, date, repo.stargazers_count, repo.forks_count, repo.subscribers_count ?? repo.watchers_count ?? 0, repo.open_issues_count);
    const traffic = (rows, countCol, uniqCol) => {
      const stmt = db.prepare(`INSERT INTO repo_stats (repo_id, date, ${countCol}, ${uniqCol}) VALUES (?, ?, ?, ?)
        ON CONFLICT(repo_id, date) DO UPDATE SET ${countCol} = MAX(${countCol}, excluded.${countCol}), ${uniqCol} = MAX(${uniqCol}, excluded.${uniqCol})`);
      for (const r of rows || []) stmt.run(repo.id, dayKey(r.timestamp), r.count, r.uniques);
    };
    traffic(views?.data.views, 'views_count', 'views_uniques');
    traffic(clones?.data.clones, 'clones_count', 'clones_uniques');

    const popular = (rows, table, col, title) => {
      const stmt = db.prepare(`INSERT INTO ${table} (repo_id, date, ${col}${title ? ', title' : ''}, count, uniques)
        VALUES (?, ?, ?${title ? ', ?' : ''}, ?, ?)
        ON CONFLICT DO UPDATE SET count = excluded.count, uniques = excluded.uniques`);
      for (const r of rows || []) {
        const args = [repo.id, date, r[col]];
        if (title) args.push(r.title || '');
        stmt.run(...args, r.count, r.uniques);
      }
    };
    popular(refs?.data, 'repo_referrers', 'referrer', false);
    popular(paths?.data, 'repo_popular_paths', 'path', true);

    const relStmt = db.prepare(`INSERT INTO releases (repo_id, id, tag_name, name, published_at, prerelease, draft) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo_id, id) DO UPDATE SET tag_name = excluded.tag_name, name = excluded.name,
        published_at = excluded.published_at, prerelease = excluded.prerelease, draft = excluded.draft`);
    const assetStmt = db.prepare(`INSERT INTO release_assets (repo_id, release_id, id, name, download_count) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(repo_id, id) DO UPDATE SET name = excluded.name, download_count = MAX(download_count, excluded.download_count)`);
    let total = 0;
    for (const rel of releases) {
      relStmt.run(repo.id, rel.id, rel.tag_name, rel.name || null, rel.published_at || null, rel.prerelease ? 1 : 0, rel.draft ? 1 : 0);
      for (const a of rel.assets || []) {
        assetStmt.run(repo.id, rel.id, a.id, a.name, a.download_count);
        if (!rel.draft) total += a.download_count;
      }
    }
    if (releases.length) {
      db.prepare(`INSERT INTO release_stats (repo_id, date, downloads) VALUES (?, ?, ?)
        ON CONFLICT(repo_id, date) DO UPDATE SET downloads = MAX(downloads, excluded.downloads)`).run(repo.id, date, total);
    }
  }

  async function syncAll() {
    const token = await getToken();
    if (!token) throw new SourceError('Add a GitHub token in Settings to sync GitHub stats.', { kind: 'needs-github' });
    const db = openWritable(dbPath);
    try {
      const me = await gh('/user', token);
      state.login = me.data.login;
      const repos = (await paginate('/user/repos?affiliation=owner,collaborator,organization_member&visibility=all', token))
        .filter((r) => r.permissions?.push || r.permissions?.admin);
      const date = todayKey();
      const upsert = db.prepare(`INSERT INTO repos (id, name, description, archived, fork, hidden) VALUES (?, ?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
          archived = excluded.archived, fork = excluded.fork, hidden = 0`);
      for (const r of repos) upsert.run(r.id, r.full_name, r.description, r.archived ? 1 : 0, r.fork ? 1 : 0);
      // Repos that disappeared (deleted, access lost) stay in history but leave the views, as in ghstats.
      const live = new Set(repos.map((r) => r.id));
      for (const row of db.prepare('SELECT id FROM repos WHERE hidden = 0').all()) {
        if (!live.has(row.id)) db.prepare('UPDATE repos SET hidden = 1 WHERE id = ?').run(row.id);
      }

      const queue = [...repos];
      const failures = [];
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (let repo = queue.shift(); repo; repo = queue.shift()) {
            try {
              await syncRepo(db, repo, token, date);
            } catch (err) {
              if (err.kind === 'auth') throw err;
              failures.push(`${repo.full_name}: ${err.message}`);
            }
          }
        }),
      );
      recomputeDeltas(db);
      state.repos = repos.length;
      state.lastRun = Date.now();
      state.lastError = failures.length ? `${failures.length} repos failed, e.g. ${failures[0]}` : '';
      const meta = db.prepare('INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      meta.run('last_sync', new Date().toISOString());
      meta.run('login', state.login);
      // Traffic coverage begins 13 days before the first sync (GitHub's 14-day window).
      db.prepare("INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('first_sync', ?)").run(date.slice(0, 10));
      return { repos: repos.length, failures: failures.length, rateRemaining: state.rateRemaining };
    } finally {
      db.close();
    }
  }

  return {
    dbPath,
    status: () => ({ ...state, running: Boolean(running) }),
    // A new token: the last error was about the old one (or none at all).
    reset() {
      state.lastError = '';
    },
    hasDb: () => existsSync(dbPath),
    // One sync at a time; concurrent callers share it.
    sync() {
      running ||= syncAll()
        .catch((err) => {
          state.lastError = err.message;
          throw err;
        })
        .finally(() => {
          running = null;
        });
      return running;
    },
    async verify(token) {
      const me = await gh('/user', token);
      return { login: me.data.login, scopes: state.scopes, rateRemaining: state.rateRemaining };
    },
    // Copies another ghstats-schema database in once. Existing rows win per key,
    // except running totals and traffic, which keep the larger value.
    importFrom(sourcePath) {
      if (!existsSync(sourcePath)) throw new SourceError(`No database at ${sourcePath}.`, { kind: 'validation' });
      const db = openWritable(dbPath);
      try {
        db.exec(`ATTACH DATABASE '${sourcePath.replaceAll("'", "''")}' AS src`);
        const srcTables = new Set(db.prepare("SELECT name FROM src.sqlite_master WHERE type = 'table'").all().map((r) => r.name));
        if (!srcTables.has('repos') || !srcTables.has('repo_stats')) throw new SourceError('That file is not a ghstats database.', { kind: 'validation' });
        const counts = {};
        db.exec('BEGIN');
        for (const table of TABLES) {
          if (!srcTables.has(table)) continue;
          const cols = db.prepare(`PRAGMA src.table_info(${table})`).all().map((c) => c.name)
            .filter((c) => db.prepare(`PRAGMA main.table_info(${table})`).all().some((m) => m.name === c));
          const list = cols.join(', ');
          const before = db.prepare(`SELECT COUNT(*) AS n FROM main.${table}`).get().n;
          db.exec(`INSERT OR IGNORE INTO main.${table} (${list}) SELECT ${list} FROM src.${table}`);
          counts[table] = db.prepare(`SELECT COUNT(*) AS n FROM main.${table}`).get().n - before;
        }
        // Same day in both: keep the larger traffic/total values.
        db.exec(`UPDATE main.repo_stats AS m SET
            stars = MAX(m.stars, s.stars), forks = MAX(m.forks, s.forks),
            views_count = MAX(m.views_count, s.views_count), views_uniques = MAX(m.views_uniques, s.views_uniques),
            clones_count = MAX(m.clones_count, s.clones_count), clones_uniques = MAX(m.clones_uniques, s.clones_uniques)
          FROM src.repo_stats AS s WHERE m.repo_id = s.repo_id AND m.date = s.date`);
        const from = db.prepare('SELECT MIN(date) AS d FROM src.repo_stats').get().d;
        if (from) {
          db.prepare(`INSERT INTO sync_meta (key, value) VALUES ('history_from', ?)
            ON CONFLICT(key) DO UPDATE SET value = MIN(value, excluded.value)`).run(from.slice(0, 10));
        }
        db.exec('COMMIT');
        recomputeDeltas(db);
        db.exec('DETACH DATABASE src');
        return counts;
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          /* not in a transaction */
        }
        throw err;
      } finally {
        db.close();
      }
    },
    // Hourly, like ghstats.
    start() {
      const run = () => this.sync().catch((err) => log.warn?.(`  GitHub sync: ${err.message}`));
      const first = setTimeout(run, 2000);
      const timer = setInterval(run, 60 * 60_000);
      first.unref();
      timer.unref();
      return () => {
        clearTimeout(first);
        clearInterval(timer);
      };
    },
  };
}
