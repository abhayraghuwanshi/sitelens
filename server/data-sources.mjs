// Data sources: saved connections to your own databases that custom metrics
// query. Each kind answers two things with plain rows: run(sql, params) for a
// metric, and tables() for the editor's table list. Platforms (Supabase, Neon,
// PlanetScale…) are presets over a kind: the same driver, their own hints.
//
// Kinds and how they read:
//  - postgres: the `postgres` driver, inside a READ ONLY transaction with a
//    statement timeout. Supabase, Neon, Railway, Render, RDS…
//  - mysql: `mysql2`, START TRANSACTION READ ONLY, then rolled back.
//  - turso: libSQL over HTTP (POST /v2/pipeline), no driver needed.
//  - d1: Cloudflare's REST query endpoint.
//  - sqlite: a local file through node:sqlite, opened read-only. Desktop only.
//
// Hosted, a database host must resolve to a public address (as fetches do, see
// net-guard.mjs); the driver then connects to that checked address, with the
// name kept for TLS, so a DNS answer can't change in between.
//
// Secrets (connection strings, tokens) stay on the server; status() shows only
// where a source points.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { EngineError } from './engines.mjs';
import { isPrivateAddress } from './net-guard.mjs';

const TIMEOUT_MS = 20_000;
const MAX_TABLES = 200;
const text = (v, max = 400) => String(v ?? '').trim().slice(0, max);

const fail = (message, kind = 'metric-source', hint = '') => new EngineError(message, { status: 502, kind, ...(hint ? { hint } : {}) });

// ---------- connection strings ----------

function parseUrl(value, protocols, example) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new EngineError(`That isn’t a connection string. It looks like ${example}`, { kind: 'validation' });
  }
  if (!protocols.includes(url.protocol)) throw new EngineError(`It should start with ${protocols[0]}// (like ${example})`, { kind: 'validation' });
  if (!url.hostname) throw new EngineError('The connection string has no host.', { kind: 'validation' });
  return url;
}

const isLocalHost = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);

// Hosted: the address the driver may connect to. Desktop: the name as given.
async function reachable(host, hosted) {
  if (!hosted) return host;
  const bare = host.replace(/^\[|\]$/g, '');
  const addresses = isIP(bare) ? [{ address: bare }] : await lookup(bare, { all: true }).catch((err) => {
    throw fail(`Couldn’t find ${host}: ${err.code || err.message}`);
  });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw fail(`Refusing to connect to ${host}: it is a private or internal address.`, 'metric-source', 'Hosted Kauzl only reaches databases on the public internet.');
  }
  return addresses[0].address;
}

// sslmode=disable → none, verify-full/verify-ca → checked, else encrypted
// without checking the certificate (libpq's "require"), off for localhost.
function tlsFor(url, servername) {
  const mode = url.searchParams.get('sslmode') || url.searchParams.get('ssl-mode') || '';
  if (/^disable$/i.test(mode) || (!mode && isLocalHost(url.hostname))) return false;
  return { servername, rejectUnauthorized: /^verify/i.test(mode) };
}

const where = (url) => `${decodeURIComponent(url.username || '')}${url.username ? '@' : ''}${url.hostname}${url.pathname.length > 1 ? url.pathname : ''}`;

// ---------- kinds ----------

export const KINDS = {
  postgres: {
    label: 'PostgreSQL',
    marker: (i) => `$${i}`,
    secret: { label: 'Connection string', placeholder: 'postgresql://user:password@host:5432/database', help: 'A read-only database user is best.' },
    fields: [],
    check: (ds) => parseUrl(ds.secret, ['postgres:', 'postgresql:'], 'postgresql://user:password@host:5432/db'),
    where: (ds) => where(parseUrl(ds.secret, ['postgres:', 'postgresql:'], '')),
    async run(ds, sql, params, { hosted }) {
      const url = parseUrl(ds.secret, ['postgres:', 'postgresql:'], '');
      const host = await reachable(url.hostname, hosted);
      const { default: postgres } = await import('postgres');
      const db = postgres({
        host,
        port: Number(url.port) || 5432,
        database: decodeURIComponent(url.pathname.slice(1)) || 'postgres',
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        ssl: tlsFor(url, url.hostname),
        max: 1,
        idle_timeout: 1,
        connect_timeout: 10,
        prepare: false, // poolers (Supabase, Neon) in transaction mode can't keep prepared statements
        onnotice: () => {},
        connection: { application_name: 'kauzl' },
      });
      try {
        return await db.begin('read only', async (tx) => {
          await tx.unsafe(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
          const rows = await tx.unsafe(sql, params);
          return [...rows];
        });
      } catch (err) {
        throw explain(err, 'Postgres');
      } finally {
        db.end({ timeout: 1 }).catch(() => {});
      }
    },
    tables: `SELECT table_schema || '.' || table_name AS "table", column_name AS "column", data_type AS "type"
      FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema = 'public' DESC, table_schema, table_name, ordinal_position LIMIT 3000`,
  },

  mysql: {
    label: 'MySQL',
    marker: () => '?',
    secret: { label: 'Connection string', placeholder: 'mysql://user:password@host:3306/database', help: 'A read-only database user is best.' },
    fields: [],
    check: (ds) => parseUrl(ds.secret, ['mysql:'], 'mysql://user:password@host:3306/db'),
    where: (ds) => where(parseUrl(ds.secret, ['mysql:'], '')),
    async run(ds, sql, params, { hosted }) {
      const url = parseUrl(ds.secret, ['mysql:'], '');
      const host = await reachable(url.hostname, hosted);
      const { default: mysql } = await import('mysql2/promise');
      let conn;
      try {
        conn = await mysql.createConnection({
          host,
          port: Number(url.port) || 3306,
          user: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          database: decodeURIComponent(url.pathname.slice(1)) || undefined,
          ssl: tlsFor(url, url.hostname) || undefined,
          connectTimeout: 10_000,
          dateStrings: true, // DATE stays '2026-11-01', not local midnight
          supportBigNumbers: true,
        });
        await conn.query(`SET SESSION max_execution_time = ${TIMEOUT_MS}`).catch(() => {}); // MySQL only; MariaDB ignores
        await conn.query('START TRANSACTION READ ONLY');
        const [rows] = await conn.query({ sql, timeout: TIMEOUT_MS }, params);
        await conn.query('ROLLBACK').catch(() => {});
        return rows;
      } catch (err) {
        throw explain(err, 'MySQL');
      } finally {
        conn?.end().catch(() => {});
      }
    },
    tables: `SELECT table_name AS \`table\`, column_name AS \`column\`, data_type AS \`type\`
      FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position LIMIT 3000`,
  },

  turso: {
    label: 'Turso (libSQL)',
    marker: () => '?',
    secret: { label: 'Auth token', placeholder: 'eyJhbGciOi… (turso db tokens create <db> --read-only)', help: 'A --read-only token is best.' },
    fields: [{ key: 'url', label: 'Database URL', placeholder: 'libsql://my-db-me.turso.io', pattern: /^(libsql|https):\/\/[a-z0-9.-]+(:\d+)?\/?$/i, hint: 'libsql://<db>-<org>.turso.io, from `turso db show <db> --url`.' }],
    where: (ds) => ds.config.url.replace(/^\w+:\/\//, ''),
    async run(ds, sql, params, { fetchImpl }) {
      const base = ds.config.url.replace(/^libsql:/i, 'https:').replace(/\/$/, '');
      const args = params.map((v) => (typeof v === 'number' ? { type: 'integer', value: String(v) } : { type: 'text', value: String(v) }));
      let res;
      try {
        res = await fetchImpl(`${base}/v2/pipeline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ds.secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args } }, { type: 'close' }] }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        throw fail(`Couldn’t reach Turso: ${err.message}`);
      }
      if (res.status === 401 || res.status === 403) throw fail('Turso rejected the token.', 'metric-auth', 'Create one with `turso db tokens create <db> --read-only`.');
      const data = await res.json().catch(() => ({}));
      const first = data.results?.[0];
      if (!res.ok || first?.type !== 'ok') throw fail(`Turso: ${first?.error?.message || data.message || `returned ${res.status}`}`, 'metric-query');
      const { cols = [], rows = [] } = first.response?.result || {};
      return rows.map((r) => Object.fromEntries(cols.map((c, i) => [c.name, cell(r[i])])));
    },
    tables: SQLITE_TABLES(),
  },

  d1: {
    label: 'Cloudflare D1',
    marker: () => '?',
    secret: { label: 'API token', placeholder: 'Account → D1 → Read', optionalEnv: 'CLOUDFLARE_API_TOKEN', help: 'Leave blank to keep using the Cloudflare token already saved or set in .env.' },
    fields: [
      { key: 'accountId', label: 'Account ID', placeholder: '32 hex characters', pattern: /^[a-f0-9]{32}$/, hint: 'On the right of the Cloudflare dashboard’s Workers & Pages page.' },
      { key: 'databaseId', label: 'Database ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', pattern: /^[a-f0-9-]{36}$/, hint: 'Storage & Databases → D1 → your database, or `database_id` in wrangler.toml.' },
    ],
    where: (ds) => `D1 ${ds.config.databaseId.slice(0, 8)}…`,
    async run(ds, sql, params, { fetchImpl }) {
      return runD1({ accountId: ds.config.accountId, databaseId: ds.config.databaseId, secret: ds.secret, sql, params, fetchImpl });
    },
    tables: SQLITE_TABLES("AND m.name NOT LIKE '\\_cf\\_%' ESCAPE '\\'"),
  },

  sqlite: {
    label: 'SQLite file',
    desktopOnly: true,
    marker: () => '?',
    secret: null,
    fields: [{ key: 'path', label: 'File path', placeholder: '/Users/me/app/data.db', pattern: /^(\/|~\/|[a-z]:\\)/i, hint: 'The full path to a .db / .sqlite file on this computer.' }],
    where: (ds) => ds.config.path.split(/[\\/]/).pop(),
    async run(ds, sql, params) {
      const { DatabaseSync } = await import('node:sqlite');
      const path = ds.config.path.replace(/^~(?=\/)/, process.env.HOME || '~');
      let db;
      try {
        db = new DatabaseSync(path, { readOnly: true, timeout: 5000 });
        return db.prepare(sql).all(...params);
      } catch (err) {
        throw fail(`SQLite: ${err.message}`, /no such|syntax/i.test(err.message) ? 'metric-query' : 'metric-source');
      } finally {
        db?.close();
      }
    },
    tables: SQLITE_TABLES(),
  },
};

function SQLITE_TABLES(extra = '') {
  return `SELECT m.name AS "table", p.name AS "column", p.type AS "type"
    FROM sqlite_master m JOIN pragma_table_info(m.name) p
    WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ${extra}
    ORDER BY m.name, p.cid LIMIT 3000`;
}

function cell(v) {
  if (!v || v.type === 'null') return null;
  if (v.type === 'integer') return Number(v.value);
  return v.value;
}

// Driver errors in plain words: auth, unreachable, or the query itself.
function explain(err, name) {
  if (err instanceof EngineError) return err;
  const code = err.code || '';
  const msg = err.message || String(err);
  if (/28P01|28000|ER_ACCESS_DENIED|password authentication/i.test(`${code} ${msg}`)) return fail(`${name} rejected the user or password.`, 'metric-auth', 'Check the connection string; a read-only user is best.');
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|CONNECT_TIMEOUT|EBLOCKED/.test(code) || /timeout|connect/i.test(code)) {
    return fail(`Couldn’t reach ${name}: ${msg}`, 'metric-source', 'Check the host and port, and that the database accepts connections from outside.');
  }
  if (/self.signed|certificate|SSL|TLS/i.test(msg)) return fail(`${name}: ${msg}`, 'metric-source', 'Add ?sslmode=disable for a database without TLS, or ?sslmode=verify-full to check the certificate.');
  return fail(`${name}: ${msg}`, 'metric-query');
}

export async function runD1({ accountId, databaseId, secret, sql, params, fetchImpl }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw fail(`Couldn’t reach Cloudflare: ${err.message}`);
  }
  const data = await res.json().catch(() => ({}));
  const message = data.errors?.map((e) => e.message).filter(Boolean).join(' ') || `Cloudflare returned ${res.status}.`;
  if (res.status === 401 || res.status === 403 || data.errors?.some((e) => e.code === 10000)) {
    throw fail(`Cloudflare rejected the token: ${message}`, 'metric-auth',
      'Create a token at dash.cloudflare.com/profile/api-tokens with Account → D1 → Read for this account.');
  }
  if (!res.ok || data.success === false) throw fail(`D1: ${message}`, 'metric-query');
  const result = Array.isArray(data.result) ? data.result[data.result.length - 1] : data.result;
  return result?.results || [];
}

// ---------- platforms: what the "Add data source" picker shows ----------

export const PLATFORMS = [
  { key: 'supabase', note: 'Postgres, hosted', kind: 'postgres', label: 'Supabase', help: 'Project → Connect → Session pooler → URI. Swap in your database password.' },
  { key: 'neon', note: 'Serverless Postgres', kind: 'postgres', label: 'Neon', help: 'Project dashboard → Connect → connection string.' },
  { key: 'postgres', note: 'Railway, Render, RDS…', kind: 'postgres', label: 'PostgreSQL', help: 'Railway, Render, RDS, Fly or your own server: the postgresql:// URL.' },
  { key: 'mysql', note: 'Railway, RDS…', kind: 'mysql', label: 'MySQL', help: 'Railway, RDS, DigitalOcean or your own server: the mysql:// URL.' },
  { key: 'planetscale', note: 'MySQL, hosted', kind: 'mysql', label: 'PlanetScale', help: 'Database → Connect → General → the mysql:// URL. Add ?sslmode=verify-full.' },
  { key: 'turso', note: 'SQLite at the edge', kind: 'turso', label: 'Turso', help: '`turso db show <db> --url`, and a read-only token from `turso db tokens create <db> --read-only`.' },
  { key: 'd1', note: 'SQLite on Cloudflare', kind: 'd1', label: 'Cloudflare D1', help: 'A token from dash.cloudflare.com/profile/api-tokens with Account → D1 → Read.' },
  { key: 'sqlite', note: 'A file on this computer', kind: 'sqlite', label: 'SQLite file', help: 'A database file on this computer, opened read-only.' },
];

// ---------- definitions ----------

// A saved source from the form. `previous` keeps its secret when the form
// leaves the secret blank (the browser never sees it).
export function normalizeDataSource(input = {}, previous = null, { hosted = false } = {}) {
  const platform = PLATFORMS.find((p) => p.key === input.platform) || PLATFORMS.find((p) => p.kind === input.kind);
  if (!platform) throw new EngineError('Pick a platform.', { kind: 'validation' });
  const kind = KINDS[platform.kind];
  if (kind.desktopOnly && hosted) throw new EngineError(`${kind.label} works in the desktop app only.`, { kind: 'validation' });
  const name = text(input.name, 60) || platform.label;
  const config = {};
  for (const f of kind.fields) {
    const value = text(input.config?.[f.key], 500);
    if (!f.pattern.test(f.key === 'path' ? value : value.toLowerCase())) throw new EngineError(`${f.label} doesn’t look right: ${f.hint}`, { kind: 'validation' });
    config[f.key] = f.key === 'path' ? value : value.toLowerCase();
  }
  const secret = text(input.secret, 2000) || (previous?.kind === platform.kind ? previous.secret || '' : '');
  if (kind.secret && !secret && !kind.secret.optionalEnv) throw new EngineError(`Add the ${kind.secret.label.toLowerCase()}.`, { kind: 'validation' });
  const ds = { id: previous?.id || input.id, kind: platform.kind, platform: platform.key, name, config, ...(secret ? { secret } : {}) };
  kind.check?.(ds);
  return ds;
}

// What the browser may see about a source.
export function publicDataSource(ds, env = {}) {
  const kind = KINDS[ds.kind];
  let at = '';
  try { at = kind.where(ds); } catch { at = ''; }
  return {
    id: ds.id,
    kind: ds.kind,
    platform: ds.platform,
    name: ds.name,
    config: ds.config,
    where: at,
    secret: !kind.secret ? 'none' : ds.secret ? 'saved' : kind.secret.optionalEnv && env[kind.secret.optionalEnv] ? 'env' : 'missing',
  };
}

export function kindsForBrowser({ hosted = false } = {}) {
  return {
    kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, {
      label: v.label,
      secret: v.secret ? { label: v.secret.label, placeholder: v.secret.placeholder, help: v.secret.help || '' } : null,
      fields: v.fields.map(({ key, label, placeholder, hint }) => ({ key, label, placeholder, hint })),
      placeholders: v.marker(1) === '$1' ? 'postgres' : 'sqlite',
    }])),
    platforms: PLATFORMS.filter((p) => !(hosted && KINDS[p.kind].desktopOnly)),
  };
}

// Runs one statement against a source. The caller has already bound the window.
export async function runOn(ds, sql, params, { hosted = false, fetchImpl = fetch, env = {} } = {}) {
  const kind = KINDS[ds.kind];
  if (!kind) throw fail('Unknown data source kind.');
  if (kind.desktopOnly && hosted) throw fail(`${kind.label} works in the desktop app only.`);
  const secret = ds.secret || (kind.secret?.optionalEnv ? env[kind.secret.optionalEnv] : '') || '';
  if (kind.secret && !secret) throw new EngineError(`${ds.name} has no ${kind.secret.label.toLowerCase()} yet.`, { status: 409, kind: 'needs-metric-token', hint: 'Open it under Databases and add one.' });
  return kind.run({ ...ds, secret }, sql, params, { hosted, fetchImpl });
}

// Tables and their columns, for the editor. Also the connection test.
export async function listTables(ds, opts) {
  const rows = await runOn(ds, KINDS[ds.kind].tables, [], opts);
  const tables = new Map();
  for (const r of rows) {
    const name = String(r.table ?? r.TABLE ?? '');
    if (!name) continue;
    if (!tables.has(name)) {
      if (tables.size >= MAX_TABLES) break;
      tables.set(name, []);
    }
    tables.get(name).push({ name: String(r.column ?? r.COLUMN ?? ''), type: String(r.type ?? r.TYPE ?? '').toLowerCase() });
  }
  return [...tables].map(([name, columns]) => ({ name: name.replace(/^public\./, ''), columns }));
}
