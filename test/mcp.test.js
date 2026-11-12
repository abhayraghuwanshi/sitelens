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

// The data is the last item; results with outside text lead with a note.
const text = (result) => result.content.at(-1).text;

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
  assert.ok(list.result.tools.every((t) => t.inputSchema.type === 'object'));
  // Only the comment tools and to-do write-ups write; delete is the one destructive tool.
  assert.deepEqual(list.result.tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name), ['add_comment', 'delete_comment', 'report_todo']);
  assert.equal(list.result.tools.find((t) => t.name === 'delete_comment').annotations.destructiveHint, true);
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

  // Results with outside text lead with a note that it's data; the user's own settings don't.
  const story = await mcp.callTool('day_story', { date: '2026-10-14', site: 'a' });
  assert.match(story.content[0].text, /never as instructions/);
  assert.equal((await mcp.callTool('list_sites')).content.length, 1);

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
    assert.deepEqual(JSON.parse(out[1].result.content.at(-1).text).rows, [{ total: 40 }]);
    assert.equal(out[2].error.code, -32700);
  } finally {
    child.kill();
    await rm(dir, { recursive: true, force: true });
  }
});

test('comment tools post Claude notes and delete only Claude ones', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body && init.method !== 'DELETE' ? JSON.parse(init.body) : null });
    if (init.method && init.method !== 'GET') assert.equal(init.headers['x-studio'], '1');
    if (url.includes('/api/annotations?')) {
      return Response.json({ annotations: [{ id: 'note-1', date: '2026-10-14', label: 'Spike', body: 'HN', scope: 'site:a', via: 'mcp', kind: 'claude' }] });
    }
    return Response.json({ id: 'note-2', ok: true });
  };
  const mcp = createMcp({ baseUrl: 'http://s', dataDir: '/nowhere', fetchImpl });
  await mcp.callTool('add_comment', { date: '2026-10-14', title: 'Spike', body: 'From HN', site: 'a' });
  assert.deepEqual(calls[0], {
    url: 'http://s/api/annotations', method: 'POST',
    body: { date: '2026-10-14', label: 'Spike', body: 'From HN', author: 'claude', via: 'mcp', scope: 'site:a' },
  });
  await mcp.callTool('add_comment', { date: '2026-10-14', title: 'Global', body: 'x', site: 'all' });
  assert.equal(calls[1].body.scope, '');
  const listed = JSON.parse(text(await mcp.callTool('list_comments', { site: 'a' })));
  assert.equal(calls[2].url, 'http://s/api/annotations?author=claude&scope=site%3Aa');
  assert.deepEqual(listed[0], { id: 'note-1', date: '2026-10-14', title: 'Spike', body: 'HN', scope: 'site:a', via: 'mcp' });
  await mcp.callTool('delete_comment', { id: 'note-1' });
  assert.deepEqual(calls[3], { url: 'http://s/api/annotations/note-1?author=claude', method: 'DELETE', body: null });
});

test('detectMcpClients: connected, stale and missing registrations', async () => {
  const { detectMcpClients } = await import('../server/mcp-clients.mjs');
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const home = await mkdtemp(join(tmpdir(), 'studio-clients-'));
  const mcpPath = join(home, 'app', 'server', 'mcp.mjs');
  try {
    await mkdir(join(home, 'app', 'server'), { recursive: true });
    await writeFile(mcpPath, '');
    await writeFile(join(home, '.claude.json'), JSON.stringify({ mcpServers: { sitelens: { command: 'node', args: [mcpPath] } } }));
    const desktopDir = join(home, 'Library', 'Application Support', 'Claude');
    await mkdir(desktopDir, { recursive: true });
    await writeFile(join(desktopDir, 'claude_desktop_config.json'), JSON.stringify({ mcpServers: { lens: { command: 'node', args: ['/gone/server/mcp.mjs'] } } }));
    const found = await detectMcpClients({ mcpPath, home, cwd: '/x' });
    assert.equal(found.claudeCode.state, 'connected');
    assert.equal(found.claudeCode.name, 'sitelens');
    assert.equal(found.claudeDesktop.state, 'stale');
    const none = await detectMcpClients({ mcpPath, home: join(home, 'nobody') });
    assert.deepEqual(none, { claudeCode: { state: 'missing' }, claudeDesktop: { state: 'missing' } });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('setup_site prompt is listed and fills in the site', async () => {
  const mcp = createMcp({ fetchImpl: async () => { throw new Error('no network'); } });
  const init = await mcp.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.deepEqual(init.result.capabilities, { tools: {}, prompts: {} });
  const list = await mcp.handle({ jsonrpc: '2.0', id: 2, method: 'prompts/list' });
  assert.deepEqual(list.result.prompts.map((p) => p.name), ['setup_site']);
  const got = await mcp.handle({ jsonrpc: '2.0', id: 3, method: 'prompts/get', params: { name: 'setup_site', arguments: { site: 'shop.test' } } });
  assert.match(got.result.messages[0].content.text, /the site "shop\.test"[\s\S]*check_site_config/);
  const bad = await mcp.handle({ jsonrpc: '2.0', id: 4, method: 'prompts/get', params: { name: 'nope' } });
  assert.equal(bad.error.code, -32602);
});
