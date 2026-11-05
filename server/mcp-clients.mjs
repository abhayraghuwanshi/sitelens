// Which local MCP clients already have the SiteLens server registered, so
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

// The entry that launches some copy of server/mcp.mjs, whatever it's named.
function findEntry(servers) {
  for (const [name, entry] of Object.entries(servers || {})) {
    const script = (entry?.args || []).find((a) => /[/\\]server[/\\]mcp\.mjs$/.test(String(a)));
    if (script) return { name, command: entry.command, script };
  }
  return null;
}

// state: 'connected' (launches this install), 'stale' (another or a missing
// copy), 'missing' (not registered).
function judge(entry, mcpPath, scope) {
  if (!entry) return { state: 'missing' };
  const ok = resolve(entry.script) === resolve(mcpPath) && existsSync(entry.script) && (!entry.command?.startsWith('/') || existsSync(entry.command));
  return { state: ok ? 'connected' : 'stale', name: entry.name, scope, script: entry.script };
}

export async function detectMcpClients({ mcpPath, home = homedir(), cwd = process.cwd() }) {
  const code = (await readJson(join(home, '.claude.json'))) || {};
  const user = findEntry(code.mcpServers);
  const local = findEntry(code.projects?.[cwd]?.mcpServers);
  const desktop = findEntry((await readJson(join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')))?.mcpServers);
  return {
    claudeCode: user ? judge(user, mcpPath, 'user') : judge(local, mcpPath, 'local'),
    claudeDesktop: judge(desktop, mcpPath),
  };
}
