import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Card, Loading, ErrorState } from '../../components/ui.jsx';

// Single-quote for zsh/bash, so paths with spaces ("SiteLens Studio.app") survive.
const sh = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function claudeCodeCommand({ command, args, env }) {
  const envFlags = Object.entries(env).map(([k, v]) => `-e ${k}=${sh(v)}`);
  return ['claude mcp add sitelens -s user', ...envFlags, '--', sh(command), ...args.map(sh)].join(' \\\n  ');
}

function claudeDesktopConfig(setup) {
  return JSON.stringify({ mcpServers: { sitelens: setup } }, null, 2);
}

// One client's registration: connected shows a line, anything else shows the setup.
function ClientStatus({ status, name }) {
  if (status?.state === 'connected') {
    return <p class="small" style={{ margin: 0, color: 'var(--good-ink)' }}>✓ <b>{name}</b> is connected (server “{status.name}”). Nothing to do; restart open sessions if the tools don’t show up.</p>;
  }
  if (status?.state === 'stale') {
    return <p class="small" style={{ margin: 0, color: 'var(--critical-ink)' }}><b>{name}</b> has “{status.name}” pointing at another copy (<code>{status.script}</code>). Run the setup below again to point it at this install.</p>;
  }
  return null;
}

function Snippet({ label, text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard refused; the text is selectable */
    }
  }
  return (
    <div class="snippet">
      <div class="snippet-head">
        <span>{label}</span>
        <button class="btn ghost" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

export function McpSettings() {
  const setup = useAsync(() => api.get('/mcp/setup'), []);
  if (setup.error) return <ErrorState error={setup.error} onRetry={setup.reload} />;
  if (!setup.data) return <Loading height={320} />;
  const { clients = {}, ...s } = setup.data;
  const code = clients.claudeCode;
  const desktop = clients.claudeDesktop;

  return (
    <Card title="Claude Code & Claude Desktop" actions={<button class="btn ghost" type="button" onClick={setup.reload}>Check again</button>} sub="Lets local agents read Studio’s numbers over MCP and leave their analysis as comments on your charts. They can’t change anything else. Your agent starts the server itself when it needs it, so there’s nothing to keep running here.">
      <div class="stack">
        <ClientStatus status={code} name="Claude Code" />
        {code?.state !== 'connected' && (
          <>
            <p class="small" style={{ margin: 0 }}>
              <b>Claude Code:</b> run this once in a terminal, then check it with <code>claude mcp list</code>.
            </p>
            <Snippet label="Terminal" text={claudeCodeCommand(s)} />
          </>
        )}
        <ClientStatus status={desktop} name="Claude Desktop" />
        {desktop?.state !== 'connected' && (
          <>
            <p class="small" style={{ margin: 0 }}>
              <b>Claude Desktop</b>{desktop?.state === 'missing' ? ' (optional, not set up yet)' : ''}: add this to <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (merge it into
              any existing <code>mcpServers</code>), then restart Claude Desktop.
            </p>
            <Snippet label="claude_desktop_config.json" text={claudeDesktopConfig(s)} />
          </>
        )}
        <p class="note" style={{ margin: 0 }}>
          The analytics tools (<code>daily_metrics</code>, <code>breakdown</code>, <code>day_story</code>, <code>events</code>) ask this app, so keep
          Studio open while you use them. <code>schema</code> and <code>query</code> read the local databases directly and work without it.
          Tokens and settings in <code>studio.json</code> are never exposed. These paths point at this install; if you move the app, copy the command again.
        </p>
      </div>
    </Card>
  );
}
