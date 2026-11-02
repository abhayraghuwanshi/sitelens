import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMcp, checkSql, TOOLS } from '../server/mcp.mjs';

async function dataDir() {
  const dir = await mkdtemp(join(tmpdir(), 'studio-mcp-'));
  const db = new DatabaseSync(join(dir, 'calendar.db'));
  db.exec(`CREATE TABLE days (site TEXT, date TEXT, sessions INTEGER, PRIMARY KEY (site, date));
    INSERT INTO days VALUES ('a', '2026-10-01', 10), ('a', '2026-10-02', 30);`);
  db.close();
  return dir;
}

const text = (result) => result.content[0].text;

test('checkSql allows one SELECT and nothing else', () => {
  assert.equal(checkSql(' SELECT 1; '), 'SELECT 1');
  assert.equal(checkSql("with x as (select ';' as s) select * from x"), "with x as (select ';' as s) select * from x");
  assert.throws(() => checkSql('DELETE FROM days'), /Only SELECT/);
  assert.throws(() => checkSql('select 1; drop table days'), /one statement/);
  assert.throws(() => checkSql(''), /Pass a SQL/);
});

test('initialize, tools/list and unknown methods', async () => {
  const mcp = createMcp({ dataDir: '/nowhere' });
  const init = await mcp.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(init.result.protocolVersion, '2025-03-26');
  assert.equal(init.result.serverInfo.name, 'sitelens-studio');
  assert.equal((await mcp.handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).result.protocolVersion, '2025-06-18');
  assert.equal(await mcp.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const list = await mcp.handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  assert.ok(list.result.tools.every((t) => t.annotations.readOnlyHint && t.inputSchema.type === 'object'));
  assert.equal((await mcp.handle({ jsonrpc: '2.0', id: 4, method: 'nope' })).error.code, -32601);
  assert.equal((await mcp.handle({ id: 5 })).error.code, -32600);
});

test('schema and query read the local databases read-only', async () => {
  const dir = await dataDir();
  try {
    const mcp = createMcp({ dataDir: dir });
    const s = JSON.parse(text(await mcp.callTool('schema', { database: 'calendar' })));
    assert.deepEqual(s.tables[0], { table: 'days', rows: 2, columns: ['site TEXT PK', 'date TEXT PK', 'sessions INTEGER'] });
    const q = JSON.parse(text(await mcp.callTool('query', { database: 'calendar', sql: 'SELECT date, sessions FROM days ORDER BY sessions DESC' })));
    assert.deepEqual(q.rows, [{ date: '2026-10-02', sessions: 30 }, { date: '2026-10-01', sessions: 10 }]);
    assert.equal(q.truncated, false);

    const bad = await mcp.callTool('query', { database: 'calendar', sql: 'SELECT nope FROM days' });
    assert.equal(bad.isError, true);
    assert.match(text(bad), /SQL error/);
    // Even a write that slips past the statement check hits a read-only connection.
    assert.equal((await mcp.callTool('query', { database: 'calendar', sql: "WITH x AS (SELECT 1) SELECT * FROM x WHERE (SELECT COUNT(*) FROM days) > 0" })).isError, undefined);
    assert.match(text(await mcp.callTool('query', { database: 'github', sql: 'SELECT 1' })), /No github data yet/);
    assert.match(text(await mcp.callTool('schema', { database: '../studio' })), /Unknown database/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('analytics tools call Studio and explain when it is not running', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/api/state')) return Response.json({ sites: [{ id: 'a', label: 'A', host: 'a.com', propertyId: '1', modes: { api: true } }] });
    if (url.includes('/day?')) return Response.json({ date: '2026-10-14', headline: 'Big day', sites: [{ id: 'a', trend: [1, 2] }] });
    return Response.json({ error: 'Pass from and to as YYYY-MM-DD.' }, { status: 400 });
  };
  const mcp = createMcp({ baseUrl: 'http://127.0.0.1:1', dataDir: '/nowhere', fetchImpl });
  assert.deepEqual(JSON.parse(text(await mcp.callTool('list_sites'))), [{ id: 'a', label: 'A', host: 'a.com', demo: false, sources: { api: true } }]);
  const day = JSON.parse(text(await mcp.callTool('day_story', { date: '2026-10-14', site: 'a' })));
  assert.deepEqual(day.sites, [{ id: 'a' }]);
  assert.equal(calls[1], 'http://127.0.0.1:1/api/calendar/day?date=2026-10-14&site=a');
  const bad = await mcp.callTool('daily_metrics', { from: 'x', to: 'y' });
  assert.equal(bad.isError, true);
  assert.equal(text(bad), 'Pass from and to as YYYY-MM-DD.');
  await mcp.callTool('breakdown', { from: '2026-10-01', to: '2026-10-31', by: 'page', limit: 10 });
  assert.equal(calls.at(-1), 'http://127.0.0.1:1/api/calendar/breakdown?from=2026-10-01&to=2026-10-31&by=page&limit=10');

  const offline = createMcp({ baseUrl: 'http://127.0.0.1:1', dataDir: '/nowhere', fetchImpl: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); } });
  assert.match(text(await offline.callTool('list_sites')), /isn't reachable at http:\/\/127\.0\.0\.1:1 \(ECONNREFUSED\)/);
});

test('stdio: newline-delimited JSON-RPC end to end', async () => {
  const dir = await dataDir();
  const child = spawn(process.execPath, ['--no-warnings', fileURLToPath(new URL('../server/mcp.mjs', import.meta.url))], {
    env: { ...process.env, STUDIO_DATA_DIR: dir, STUDIO_URL: 'http://127.0.0.1:1' },
  });
  try {
    const replies = [];
    let buffer = '';
    const waitFor = (n) => new Promise((done) => {
      const check = () => (replies.length >= n ? done(replies) : setTimeout(check, 10));
      check();
    });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        replies.push(JSON.parse(buffer.slice(0, i)));
        buffer = buffer.slice(i + 1);
      }
    });
    const send = (msg) => child.stdin.write(`${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`);
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'query', arguments: { database: 'calendar', sql: 'SELECT SUM(sessions) AS total FROM days' } } });
    send('not json');
    const out = await waitFor(3);
    assert.equal(out[0].id, 1);
    assert.deepEqual(JSON.parse(out[1].result.content[0].text).rows, [{ total: 40 }]);
    assert.equal(out[2].error.code, -32700);
  } finally {
    child.kill();
    await rm(dir, { recursive: true, force: true });
  }
});
