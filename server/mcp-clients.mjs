// Which local MCP clients (Claude Code, Claude Desktop, OpenCode) already have the SiteLens server registered, so
// Settings can say "connected" instead of asking for the setup again.
// Reads the clients' own config files; never writes them.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

// JSON with comments and trailing commas (OpenCode's opencode.jsonc), read
// as plain JSON. Skips over strings so "https://..." keeps its slashes.
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      out += text.slice(start, i + 1);
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

async function readJsonc(file) {
  try {
    return parseJsonc(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

const MCP_SCRIPT = /[/\\]server[/\\]mcp\.mjs$/;

// The entry that launches some copy of server/mcp.mjs, whatever it's named.
function findEntry(servers) {
  for (const [name, entry] of Object.entries(servers || {})) {
    const script = (entry?.args || []).find((a) => MCP_SCRIPT.test(String(a)));
    if (script) return { name, command: entry.command, script };
  }
  return null;
}

// OpenCode keeps the command and its arguments in one array, under
// mcp.servers (2.x) or straight under mcp (1.x).
function findOpenCodeEntry(config) {
  const mcp = config?.mcp || {};
  const servers = mcp.servers && typeof mcp.servers === 'object' && !Array.isArray(mcp.servers) ? { ...mcp, ...mcp.servers } : mcp;
  for (const [name, entry] of Object.entries(servers)) {
    if (entry?.type !== 'local' || !Array.isArray(entry.command) || entry.enabled === false) continue;
    const script = entry.command.slice(1).find((a) => MCP_SCRIPT.test(String(a)));
    if (script) return { name, command: entry.command[0], script };
  }
  return null;
}

// Global config first (where `opencode mcp add --global` writes), then the project's.
async function openCodeEntry(home, cwd, env) {
  const dir = env.XDG_CONFIG_HOME ? join(env.XDG_CONFIG_HOME, 'opencode') : join(home, '.config', 'opencode');
  for (const [file, scope] of [[join(dir, 'opencode.json'), 'user'], [join(dir, 'opencode.jsonc'), 'user'], [join(cwd, 'opencode.json'), 'local'], [join(cwd, 'opencode.jsonc'), 'local']]) {
    const entry = findOpenCodeEntry(await readJsonc(file));
    if (entry) return { entry, scope };
  }
  return { entry: null };
}

// state: 'connected' (launches this install), 'stale' (another or a missing
// copy), 'missing' (not registered).
function judge(entry, mcpPath, scope) {
  if (!entry) return { state: 'missing' };
  const ok = resolve(entry.script) === resolve(mcpPath) && existsSync(entry.script) && (!entry.command?.startsWith('/') || existsSync(entry.command));
  return { state: ok ? 'connected' : 'stale', name: entry.name, scope, script: entry.script };
}

export async function detectMcpClients({ mcpPath, home = homedir(), cwd = process.cwd(), env = process.env }) {
  const code = (await readJson(join(home, '.claude.json'))) || {};
  const user = findEntry(code.mcpServers);
  const local = findEntry(code.projects?.[cwd]?.mcpServers);
  const desktop = findEntry((await readJson(join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')))?.mcpServers);
  const opencode = await openCodeEntry(home, cwd, env);
  return {
    claudeCode: user ? judge(user, mcpPath, 'user') : judge(local, mcpPath, 'local'),
    claudeDesktop: judge(desktop, mcpPath),
    opencode: judge(opencode.entry, mcpPath, opencode.scope),
  };
}
