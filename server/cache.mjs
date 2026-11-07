// In-memory TTL cache that also de-duplicates concurrent requests for the same key.
//
// With `staleFor`, an expired entry is still answered at once (up to that age)
// while a fresh one loads in the background, and the request is marked stale so
// the browser can ask again once the refresh lands. With `db` (openCacheDb),
// entries also survive restarts.

import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Per API request: { wait, stale, refreshes }. `wait` (the X-Studio-Wait header)
// means "this is the follow-up: wait for refreshes already running".
export const requestContext = new AsyncLocalStorage();

// The request answered from stored data while `refresh` brings it up to date.
export function markStale(refresh) {
  const ctx = requestContext.getStore();
  if (!ctx) return;
  ctx.stale = true;
  ctx.refreshes.push(refresh);
}

export function wantsWait() {
  return Boolean(requestContext.getStore()?.wait);
}

// Background work runs outside the request, so it never marks it.
export function detached(fn) {
  return requestContext.exit(fn);
}

// One SQLite file of JSON entries, shared by every persisted cache.
export function openCacheDb(path) {
  let db = null;
  function open() {
    if (db) return db;
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, at INTEGER NOT NULL, value TEXT NOT NULL)');
    return db;
  }
  return {
    get(key) {
      const row = open().prepare('SELECT at, value FROM entries WHERE key = ?').get(key);
      return row ? { at: row.at, value: JSON.parse(row.value) } : null;
    },
    set(key, at, text) {
      open().prepare('INSERT OR REPLACE INTO entries (key, at, value) VALUES (?, ?, ?)').run(key, at, text);
    },
    delete(prefix, fragment) {
      open().prepare('DELETE FROM entries WHERE substr(key, 1, length(?)) = ? AND instr(key, ?) > 0').run(prefix, prefix, fragment);
    },
    prune(olderThan) {
      open().prepare('DELETE FROM entries WHERE at < ?').run(olderThan);
    },
    close() {
      db?.close();
      db = null;
    },
  };
}

// JSON text for a value that round-trips as JSON, else null (Maps, Sets, Dates stay in memory only).
function plainJson(value) {
  let plain = true;
  const text = JSON.stringify(value, function check(key, v) {
    const raw = this[key];
    if (raw instanceof Map || raw instanceof Set || raw instanceof Date) plain = false;
    return v;
  });
  return plain && text !== undefined ? text : null;
}

export function createCache({ maxEntries = 500, staleFor = 0, db = null, name = '', now = () => Date.now() } = {}) {
  const entries = new Map(); // key → { value (a promise), at, ttl }
  const refreshing = new Map(); // key → promise of the background load
  const prefix = name ? `${name}:` : '';
  if (db && staleFor) db.prune(now() - staleFor);

  function remember(key, entry) {
    entries.delete(key);
    entries.set(key, entry);
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }

  // In the background the old entry keeps answering until the new one lands.
  async function settle(key, ttl, load, { background = false } = {}) {
    const at = now();
    const value = load();
    if (!background) remember(key, { value, at, ttl });
    try {
      const data = await value;
      if (background) remember(key, { value, at, ttl });
      if (db) {
        const text = plainJson(data);
        if (text !== null) db.set(prefix + key, at, text);
      }
      return data;
    } catch (err) {
      if (entries.get(key)?.value === value) entries.delete(key);
      throw err;
    }
  }

  // An expired but usable entry: from memory, else from disk.
  function stored(key) {
    const hit = entries.get(key);
    if (hit) return hit;
    const row = db?.get(prefix + key);
    return row ? { value: Promise.resolve(row.value), at: row.at, ttl: 0 } : null;
  }

  function refresh(key, ttl, load) {
    if (!refreshing.has(key)) {
      const p = detached(() => settle(key, ttl, load, { background: true }))
        .catch(() => {})
        .finally(() => refreshing.delete(key));
      refreshing.set(key, p);
    }
    return refreshing.get(key);
  }

  return {
    async wrap(key, ttl, fresh, load) {
      const hit = entries.get(key);
      if (!fresh && hit && hit.at + ttl > now()) return hit.value;
      if (!fresh && staleFor) {
        const waited = refreshing.has(key) && wantsWait();
        if (waited) await refreshing.get(key);
        const old = stored(key);
        if (old && old.at + ttl > now()) return old.value;
        if (old && old.at + staleFor > now()) {
          // Keep it in memory, but expired, so the next caller doesn't hit disk.
          if (!hit) remember(key, { ...old, ttl });
          // A follow-up whose refresh failed stays stale without starting another.
          markStale(waited ? Promise.resolve() : refresh(key, ttl, load));
          return old.value;
        }
      }
      return settle(key, ttl, load);
    },
    clear(fragment = '') {
      for (const key of entries.keys()) if (!fragment || key.includes(fragment)) entries.delete(key);
      db?.delete(prefix, fragment);
    },
  };
}
