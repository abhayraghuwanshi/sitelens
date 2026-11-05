// MCP server for local agents (Claude Code, Claude Desktop): read-only tools
// over Studio's data, plus comment tools so an agent can leave its analysis in
// the app (dated Claude notes on charts and the Calendar). Speaks MCP's stdio
// transport (newline-delimited JSON-RPC) directly, so it needs no SDK.
//
//  - Analytics tools call the running Studio server's JSON API (STUDIO_URL,
//    default http://127.0.0.1:4318), which syncs and owns .data/calendar.db.
//    Start Studio first (npm start or the desktop app).
//  - `schema` and `query` open the .data/*.db files read-only and work even
//    when Studio isn't running. studio.json (tokens, settings) is never exposed.
//  - Comment tools write only Claude-authored notes, and can only delete those.
//
// Register with Claude Code:  claude mcp add sitelens -- node /path/to/sitelens-studio/server/mcp.mjs

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_ROWS = 500;

export const DATABASES = {
  calendar: 'Daily GA4 sessions/users/views and Search Console clicks per site (days, search_days), plus per-day top sources, landing pages and queries (breakdown).',
  github: 'GitHub repos, daily stars/forks/issues/views (repo_stats), referrers, popular paths, releases and downloads.',
  posts: 'Your own posts on Reddit, Hacker News, Dev.to, Medium, Product Hunt and added URLs.',
  mentions: 'Mentions of your products on Hacker News, Reddit and Product Hunt.',
  bing: 'Bing Webmaster daily clicks/impressions (traffic) and crawl health (crawl).',
  vitals: 'PageSpeed / CrUX Core Web Vitals checks.',
  firebase: 'Firebase Hosting request logs and Cloud Run revisions.',
  'ai-search': 'Checks of whether AI assistants mention your products.',
};

const SITE = { type: 'string', description: 'A site id from list_sites, or "all" (default) for every real site combined.' };
const DATE = (what) => ({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: `${what} (YYYY-MM-DD, inclusive).` });

export const TOOLS = [
  {
    name: 'list_sites',
    description: 'Sites tracked in SiteLens Studio with their host and which sources are connected (GA4, Search Console, BigQuery). Start here to get site ids.',
    inputSchema: { type: 'object', properties: {} },
    path: () => '/api/state',
    shape: (state) => state.sites.map((s) => ({ id: s.id, label: s.label, host: s.host, demo: Boolean(s.demo), sources: s.modes })),
  },
  {
    name: 'daily_metrics',
    description: 'Per-day sessions, users, page views and Search Console clicks for a date range (up to 500 days), with each day\'s baseline (median of the same weekday over the previous 4 weeks) and change vs it. Clicks are null for days Search Console hasn\'t reported yet.',
    inputSchema: { type: 'object', properties: { from: DATE('First day'), to: DATE('Last day'), site: SITE }, required: ['from', 'to'] },
    path: (a) => `/api/calendar/metrics?${params(a, ['from', 'to', 'site'])}`,
  },
  {
    name: 'custom_metrics',
    description: 'The site\'s custom metrics (daily numbers from its own databases, like daily pings or signups): per-day values for the range, the top dimensions, and totals for this and the previous period of the same length.',
    inputSchema: {
      type: 'object',
      properties: { site: { type: 'string', description: 'A site id from list_sites.' }, range: { type: 'string', enum: ['7d', '28d', '90d', '1y'], description: 'Days ending today (default 28d).' } },
      required: ['site'],
    },
    path: (a) => `/api/sites/${encodeURIComponent(a.site)}/metrics?${params(a, ['range'])}`,
  },
  {
    name: 'breakdown',
    description: 'What traffic was made of over a range, compared with the same-length window just before it: sessions by source family (by=source) or landing page (by=page), or search clicks by query (by=query). Use it to explain a change.',
    inputSchema: {
      type: 'object',
      properties: {
        from: DATE('First day'), to: DATE('Last day'), site: SITE,
        by: { type: 'string', enum: ['source', 'page', 'query'] },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Rows to return (default 25).' },
      },
      required: ['from', 'to', 'by'],
    },
    path: (a) => `/api/calendar/breakdown?${params(a, ['from', 'to', 'site', 'by', 'limit'])}`,
  },
  {
    name: 'day_story',
    description: 'Everything about one day: a plain-language summary vs a typical same weekday, the sources and landing pages that moved, search clicks and top queries, releases/deploys/posts/mentions/notes that day and the day before, GitHub stars, extension users and alerts.',
    inputSchema: { type: 'object', properties: { date: DATE('The day'), site: SITE }, required: ['date'] },
    path: (a) => `/api/calendar/day?${params(a, ['date', 'site'])}`,
    shape: (d) => ({ ...d, sites: d.sites.map(({ trend, ...s }) => s) }),
  },
  {
    name: 'events',
    description: 'Dated events in a range: GitHub releases, Chrome Web Store versions, Vercel/Firebase deploys, your posts, mentions, hand-written notes, plus the alerts that fired. Use with daily_metrics to connect changes to causes.',
    inputSchema: { type: 'object', properties: { from: DATE('First day'), to: DATE('Last day'), site: SITE }, required: ['from', 'to'] },
    path: (a) => `/api/calendar/events?${params(a, ['from', 'to', 'site'])}`,
  },
  {
    name: 'add_comment',
    description: 'Leave a comment in SiteLens Studio: a dated note marked as written by Claude, shown on every trend chart, in the Calendar, and in the site\'s Claude panel. Use it to record an analysis after you have looked at the data. Give it a short title (it labels the chart marker) and a body with the findings and the numbers behind them. Pin it to the day the finding is about.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        date: DATE('The day the comment is about'),
        title: { type: 'string', maxLength: 140, description: 'One line, e.g. "HN launch drove +47% sessions".' },
        body: { type: 'string', maxLength: 4000, description: 'The analysis in plain text. Short paragraphs; lines starting with "- " show as bullets.' },
        site: { type: 'string', description: 'A site id from list_sites to show it on that site only. Omit to show it everywhere.' },
      },
      required: ['date', 'title', 'body'],
    },
    method: 'POST',
    path: () => '/api/annotations',
    body: (a) => ({ date: a.date, label: a.title, body: a.body, author: 'claude', via: 'mcp', scope: a.site && a.site !== 'all' ? `site:${a.site}` : '' }),
  },
  {
    name: 'list_comments',
    description: 'Comments Claude has left in SiteLens Studio (from you or from the in-app analysis), newest day last. Check them before adding a comment so you don\'t repeat one.',
    inputSchema: { type: 'object', properties: { from: DATE('First day'), to: DATE('Last day'), site: { type: 'string', description: 'A site id; its comments plus ones shown everywhere.' } } },
    path: (a) => `/api/annotations?${params({ ...a, author: 'claude', scope: a.site && a.site !== 'all' ? `site:${a.site}` : '' }, ['from', 'to', 'author', 'scope'])}`,
    shape: (d) => d.annotations.map(({ id, date, label, body, scope, via, createdAt }) => ({ id, date, title: label, body, scope, via, createdAt })),
  },
  {
    name: 'delete_comment',
    description: 'Delete a comment Claude left (an id from list_comments). Notes written by the user can\'t be deleted.',
    write: true,
    inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[\\w-]+$' } }, required: ['id'] },
    method: 'DELETE',
    path: (a) => `/api/annotations/${encodeURIComponent(a.id)}?author=claude`,
  },
  {
    name: 'site_config',
    description: 'The site\'s .sitelens.yml as Studio applies it: where it was read from (the site\'s repo, a local override, or none yet), the goals, funnels and alert settings it declares, and any errors, warnings and event names it uses that the site hasn\'t sent in 28 days. Spec: docs/sitelens-yml.md in sitelens-studio.',
    inputSchema: { type: 'object', properties: { site: { type: 'string', description: 'A site id from list_sites.' } }, required: ['site'] },
    path: (a) => `/api/sites/${encodeURIComponent(a.site)}/config?check=1&fresh=1`,
  },
  {
    name: 'draft_site_config',
    description: 'A starting .sitelens.yml for a site from what Studio already knows: the goals set in Settings (or Studio\'s guesses from the event names the site sends) and funnels suggested from its sessions. Check it against the site\'s tracking code before using it.',
    inputSchema: { type: 'object', properties: { site: { type: 'string', description: 'A site id from list_sites.' } }, required: ['site'] },
    path: (a) => `/api/sites/${encodeURIComponent(a.site)}/config/draft`,
  },
  {
    name: 'check_site_config',
    description: 'Validate a .sitelens.yml before committing it, without saving anything: returns the config as Studio would apply it, or the errors that would stop it from applying, plus warnings for unknown keys and for event names the site hasn\'t sent in 28 days.',
    inputSchema: {
      type: 'object',
      properties: { site: { type: 'string', description: 'A site id from list_sites.' }, yaml: { type: 'string', description: 'The whole file.' } },
      required: ['site', 'yaml'],
    },
    method: 'POST',
    path: (a) => `/api/sites/${encodeURIComponent(a.site)}/config/check`,
    body: (a) => ({ yaml: a.yaml }),
  },
  {
    name: 'schema',
    description: `Tables and columns of one local SQLite database, for writing a query. Databases: ${Object.entries(DATABASES).map(([k, v]) => `${k} (${v})`).join(' ')}`,
    inputSchema: { type: 'object', properties: { database: { type: 'string', enum: Object.keys(DATABASES) } }, required: ['database'] },
    local: (a, ctx) => schema(ctx.dataDir, a.database),
  },
  {
    name: 'query',
    description: `Run one read-only SQL SELECT (SQLite dialect) against a local database and get up to ${MAX_ROWS} rows. Call schema first. Dates are 'YYYY-MM-DD' text unless the schema says otherwise.`,
    inputSchema: {
      type: 'object',
      properties: { database: { type: 'string', enum: Object.keys(DATABASES) }, sql: { type: 'string', description: 'A single SELECT or WITH … SELECT statement.' } },
      required: ['database', 'sql'],
    },
    local: (a, ctx) => query(ctx.dataDir, a.database, a.sql),
  },
];

// Prompts show up in Claude Code as /mcp__sitelens__<name>.
export const PROMPTS = [
  {
    name: 'setup_site',
    description: 'Set up SiteLens for the site in this repo: read its code and search data and write .sitelens.yml (goals, alerts, funnels, search topics and AI questions).',
    arguments: [{ name: 'site', description: 'The site id or host in SiteLens (optional; found from the repo otherwise).', required: false }],
    text: (a) => `Set up SiteLens Studio for ${a.site ? `the site "${a.site}"` : 'the website in this repository'} by writing its .sitelens.yml. The file declares what Studio measures; connections and credentials stay in Studio's Settings, so never put tokens, property IDs or webhook URLs in it.

1. Call list_sites and pick the site this repo serves (match its host to the repo's domain, homepage or deploy config). If it isn't there, stop and ask me to add it in Studio first.
2. Call site_config for it. If a file already exists, improve it rather than starting over, and keep what's deliberate.
3. Read the code for analytics calls: gtag('event', …), dataLayer.push({ event }), track/capture/logEvent(…), plausible(…), and the routes/pages they sit on. Work out what the site is for and pick its kind (saas, ecommerce, extension, desktop, mobile, content, docs, website).
4. Call draft_site_config to see what Studio guesses from the live data, and use it as evidence, not as the answer.
5. Write .sitelens.yml at the repo root (or .sitelens/<host>.yml if this repo serves several sites):
   - goals: 1–3 outcomes (the results the site exists for: a sign-up, purchase, install, download, lead) and a few steps that lead to them (pricing page, plan picked, CTA click). Only use event names that the code really sends. Give outcomes a value when there's an honest one, and alert: true so a drop is noticed; tune pct and min for low-volume goals so one quiet day doesn't alert.
   - funnels: 1–3 funnels, each the path a visitor really takes in the code, ending at an outcome. 2–8 steps of page:/path or event:name.
   - alerts: only if the defaults wouldn't fit the site (e.g. very spiky traffic).
   - search: what the site wants to be found for, in Google and in AI answers.
     - brand: the product's name and how people misspell or space it. competitors: the rivals the site's copy names (its "vs X" and "alternative to X" pages).
     - topics: 2–6, one per thing the site is for, each with the page that should rank for it (page), a regex for its queries (match), and the queries it must win (targets). Base them on the site's pages and headings and on real queries: call breakdown with by=query over the last 90 days.
     - ask_ai: 1–3 questions per topic, as a customer who doesn't know the product yet would ask an AI assistant. Never name the product in them: "What is <product>?" always names it, so it measures nothing. Up to 12 in all; each is a paid call per check.
   Add a short comment above each goal, funnel and topic saying where in the code or data it comes from.
6. Call check_site_config with the whole file and fix every error. For "not sent in the last 28 days" warnings, check the name against the code: fix typos, and keep a goal that is new or rare only on purpose.
7. Show me the file and a one-paragraph summary of why these goals and topics. Don't commit unless I ask.

The full spec is docs/sitelens-yml.md in the sitelens-studio repo.`,
  },
];

/* ---------- Local databases ---------- */

function dbFile(dataDir, name) {
  if (!Object.hasOwn(DATABASES, name)) throw new ToolError(`Unknown database "${name}". Use one of: ${Object.keys(DATABASES).join(', ')}.`);
  const file = join(dataDir, `${name}.db`);
  if (!existsSync(file)) throw new ToolError(`No ${name} data yet (${file} doesn't exist). Connect that source in Studio first.`);
  return file;
}

function openReadOnly(dataDir, name) {
  const db = new DatabaseSync(dbFile(dataDir, name), { readOnly: true, timeout: 3000 });
  db.exec('PRAGMA query_only = ON;');
  return db;
}

export function schema(dataDir, name) {
  const db = openReadOnly(dataDir, name);
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    return {
      database: name,
      about: DATABASES[name],
      tables: tables.map(({ name: table }) => ({
        table,
        rows: db.prepare(`SELECT COUNT(*) AS n FROM "${table.replaceAll('"', '""')}"`).get().n,
        columns: db.prepare(`PRAGMA table_info("${table.replaceAll('"', '""')}")`).all().map((c) => `${c.name} ${c.type}${c.pk ? ' PK' : ''}`),
      })),
    };
  } finally {
    db.close();
  }
}

// One SELECT only; the connection is read-only as well, so this is about clear errors, not safety.
export function checkSql(sql) {
  const text = String(sql || '').trim().replace(/;\s*$/, '');
  if (!text) throw new ToolError('Pass a SQL statement.');
  if (!/^(select|with)\b/i.test(text)) throw new ToolError('Only SELECT (or WITH … SELECT) statements are allowed.');
  if (stripStrings(text).includes(';')) throw new ToolError('Send one statement at a time.');
  return text;
}

function stripStrings(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
}

export function query(dataDir, name, sql) {
  const text = checkSql(sql);
  const db = openReadOnly(dataDir, name);
  try {
    const rows = db.prepare(`SELECT * FROM (${text}) LIMIT ${MAX_ROWS + 1}`).all().map((r) => ({ ...r }));
    return { database: name, rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS };
  } catch (err) {
    if (err instanceof ToolError) throw err;
    throw new ToolError(`SQL error: ${err.message}`);
  } finally {
    db.close();
  }
}

/* ---------- Studio's API ---------- */

function params(args, keys) {
  const p = new URLSearchParams();
  for (const k of keys) if (args[k] !== undefined && args[k] !== null && args[k] !== '') p.set(k, String(args[k]));
  return p.toString();
}

async function studio(baseUrl, path, fetchImpl, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(120_000),
      // Studio refuses writes without X-Studio (a CSRF guard for the browser).
      ...(method !== 'GET' ? { headers: { 'content-type': 'application/json', 'x-studio': '1' }, body: JSON.stringify(body || {}) } : {}),
    });
  } catch (err) {
    throw new ToolError(`SiteLens Studio isn't reachable at ${baseUrl} (${err.cause?.code || err.message}). Start it with \`npm start\` in the project or open the desktop app; schema and query work without it.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ToolError(`${data.error || `Studio answered ${res.status}`}${data.hint ? ` ${data.hint}` : ''}`);
  return data;
}

class ToolError extends Error {}

/* ---------- JSON-RPC over stdio ---------- */

export function createMcp({ baseUrl = 'http://127.0.0.1:4318', dataDir = join(ROOT, '.data'), fetchImpl = fetch } = {}) {
  const ctx = { dataDir };

  async function callTool(name, args = {}) {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    try {
      const request = { method: tool.method, body: tool.body?.(args) };
      const result = tool.local ? tool.local(args, ctx) : await studio(baseUrl, tool.path(args), fetchImpl, request).then((d) => (tool.shape ? tool.shape(d) : d));
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: err instanceof ToolError ? err.message : `Failed: ${err.message}` }], isError: true };
    }
  }

  // Returns the response object, or null for notifications.
  async function handle(msg) {
    const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(-32600, 'Invalid request');
    const isNotification = msg.id === undefined;
    switch (msg.method) {
      case 'initialize': {
        const asked = msg.params?.protocolVersion;
        return reply({
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: {}, prompts: {} },
          serverInfo: { name: 'sitelens-studio', version: '0.2.0' },
          instructions: 'Access to SiteLens Studio: website traffic (GA4), search (Search Console), GitHub, posts, mentions and more, stored locally. Start with list_sites, use daily_metrics and events to find and date changes, day_story or breakdown to explain them, and schema + query for anything else. When the user wants your analysis kept in the app, record it with add_comment (check list_comments first); that is the only thing you can change in Studio. A site\'s goals, funnels, goal alerts, search topics and AI answer-check questions come from a .sitelens.yml file in its repo: to set them up, read the site\'s code and write that file (the setup_site prompt walks through it), using site_config, draft_site_config and check_site_config.',
        });
      }
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({ tools: TOOLS.map(({ name, description, inputSchema, write }) => ({ name, description, inputSchema, annotations: write ? { readOnlyHint: false, destructiveHint: name.startsWith('delete') } : { readOnlyHint: true } })) });
      case 'tools/call':
        return reply(await callTool(msg.params?.name, msg.params?.arguments || {}));
      case 'prompts/list':
        return reply({ prompts: PROMPTS.map(({ name, description, arguments: args }) => ({ name, description, arguments: args })) });
      case 'prompts/get': {
        const prompt = PROMPTS.find((p) => p.name === msg.params?.name);
        if (!prompt) return fail(-32602, `Unknown prompt: ${msg.params?.name}`);
        return reply({ description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: prompt.text(msg.params?.arguments || {}) } }] });
      }
      default:
        return isNotification ? null : fail(-32601, `Method not found: ${msg.method}`);
    }
  }

  return { handle, callTool };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 4318;
  const mcp = createMcp({
    baseUrl: (process.env.STUDIO_URL || `http://127.0.0.1:${port}`).replace(/\/$/, ''),
    dataDir: process.env.STUDIO_DATA_DIR || join(ROOT, '.data'),
  });
  // stdout carries protocol messages only; anything else goes to stderr.
  const write = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);
  // One message at a time, so replies come back in request order.
  let queue = Promise.resolve();
  createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        return;
      }
      const out = await mcp.handle(msg).catch((err) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32603, message: err.message } }));
      if (out) write(out);
    });
  });
}
