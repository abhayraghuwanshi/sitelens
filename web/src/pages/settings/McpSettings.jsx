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

export function McpSettings({ hosted = false }) {
  return hosted ? <HostedMcp /> : <LocalMcp />;
}

// Hosted: Claude reaches https://<host>/mcp with a personal access token.
function HostedMcp() {
  const list = useAsync(() => api.get('/mcp/tokens'), []);
  const [label, setLabel] = useState('');
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading height={240} />;
  const { url, tokens } = list.data;

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMade(await api.post('/mcp/tokens', { label: label.trim() || 'Claude Code' }));
      setLabel('');
      list.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    await api.del(`/mcp/tokens/${id}`);
    if (made?.id === id) setMade(null);
    list.reload();
  }

  const header = `Authorization: Bearer ${made?.token || '<your token>'}`;
  const code = `claude mcp add --transport http sitelens ${url} \\\n  --header ${sh(header)} -s user`;
  const desktop = JSON.stringify({ mcpServers: { sitelens: { command: 'npx', args: ['-y', 'mcp-remote@0.15.2', url, '--header', header] } } }, null, 2);

  return (
    <Card title="Claude Code & Claude Desktop" sub="Lets Claude read your Studio numbers over MCP and leave its analysis as comments on your charts and to-dos. It can’t change anything else, and it only ever sees your own data.">
      <div class="stack">
        <form class="row" onSubmit={create}>
          <input style={{ flex: '1', minWidth: '220px', maxWidth: '320px' }} placeholder="Name, e.g. MacBook Claude Code" value={label}
            onInput={(e) => setLabel(e.currentTarget.value)} aria-label="Token name" maxLength={60} />
          <button class="btn primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create access token'}</button>
        </form>
        {error && <ErrorState error={error} />}
        {made && (
          <p class="small" style={{ margin: 0, color: 'var(--good-ink)' }}>
            Token created. It’s in the commands below and won’t be shown again, so copy one now.
          </p>
        )}
        <p class="small" style={{ margin: 0 }}><b>Claude Code:</b> run this once in a terminal, then check it with <code>claude mcp list</code>.</p>
        <Snippet label="Terminal" text={code} />
        <p class="small" style={{ margin: 0 }}>
          <b>Claude Desktop</b> (optional): add this to <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>, merged into any
          existing <code>mcpServers</code>, then restart Claude Desktop. It needs Node.js installed.
        </p>
        <Snippet label="claude_desktop_config.json" text={desktop} />
        {tokens.length > 0 && (
          <table class="data">
            <thead><tr><th>Token</th><th>Created</th><th>Last used</th><th /></tr></thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>{t.label}</td>
                  <td class="small">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td class="small">{t.lastUsed ? new Date(t.lastUsed).toLocaleString() : <span class="muted">never</span>}</td>
                  <td class="num"><button class="btn ghost danger" type="button" onClick={() => revoke(t.id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p class="note" style={{ margin: 0 }}>
          One token per computer or agent, so you can revoke one without the others. Studio keeps only a fingerprint of each token, never the token itself.
          Anyone with a token can read your Studio data, so treat it like a password.
        </p>
      </div>
    </Card>
  );
}

function LocalMcp() {
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
