import { useState } from 'preact/hooks';
import { api } from '../../api.js';
import { useAsync } from '../../hooks.js';
import { Loading, ErrorState } from '../../components/ui.jsx';
import { Icon } from '../../components/icons.jsx';
import { BrandIcon } from '../../components/BrandIcon.jsx';
import { ConnectionHero, Section, Steps, Facts } from './ConnectionKit.jsx';

// Single-quote for zsh/bash, so paths with spaces ("Kauzl.app") survive.
const sh = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function claudeCodeCommand({ command, args, env }) {
  const envFlags = Object.entries(env).map(([k, v]) => `-e ${k}=${sh(v)}`);
  return ['claude mcp add sitelens -s user', ...envFlags, '--', sh(command), ...args.map(sh)].join(' \\\n  ');
}

function claudeDesktopConfig(setup) {
  return JSON.stringify({ mcpServers: { sitelens: setup } }, null, 2);
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
  return <div class="cx-page">{hosted ? <HostedMcp /> : <LocalMcp />}<McpTools /></div>;
}

const AGENT_TAGLINE = 'Ask Claude about your traffic, search and launches. It reads your Kauzl numbers over MCP, and can leave comments and to-dos and save a site’s .sitelens.yml. Nothing else, and only your own data.';

// The tools, grouped the way people think about them; a tool not named here lands in Other.
const GROUPS = [
  ['Sites and traffic', ['list_sites', 'daily_metrics', 'custom_metrics', 'breakdown', 'day_story', 'events']],
  ['Search', ['search_rankings', 'search_demand', 'index_status', 'page_review', 'get_article']],
  ['To-dos', ['list_todos', 'get_todo', 'add_todo', 'report_todo']],
  ['Comments', ['add_comment', 'list_comments', 'delete_comment']],
  ['Config file (.sitelens.yml)', ['site_config', 'draft_site_config', 'check_site_config', 'save_site_config']],
  ['Raw data', ['schema', 'query']],
];
// A tool's first sentence is enough for the list; the rest is for Claude.
const firstSentence = (text) => String(text).split(/(?<=[.:])\s/)[0].replace(/:$/, '.');

// What Claude can do once connected: every tool by group, the ones that change something marked.
function McpTools() {
  const list = useAsync(() => api.get('/mcp/tools'), []);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading height={240} />;
  const { tools, prompts } = list.data;
  const named = new Set(GROUPS.flatMap(([, names]) => names));
  const groups = [...GROUPS, ['Other', tools.filter((t) => !named.has(t.name)).map((t) => t.name)]]
    .map(([label, names]) => [label, names.map((n) => tools.find((t) => t.name === n)).filter(Boolean)])
    .filter(([, list]) => list.length);
  if (prompts.length) groups.push(['Prompts', prompts]);
  const writes = tools.filter((t) => t.writes).length;
  return (
    <Section title="What Claude can do" sub={`${tools.length} tools. ${writes} change something in Kauzl (marked Changes); the rest only read.`}>
      <div class="ag-tools">
        {groups.map(([label, items]) => (
          <div key={label} class="ag-group">
            <h4 class="ag-group-h">{label}<span class="muted">{items.length}</span></h4>
            <ul>
              {items.map((t) => (
                <li key={t.name}>
                  <span class="ag-tool-top"><code>{t.name}</code>{t.writes && <span class="chip accent">Changes</span>}</span>
                  <span class="small muted">{firstSentence(t.description)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p class="small muted m-0">A session started before Kauzl added a tool won’t list it: reconnect with <code>/mcp</code> in Claude Code, or restart Claude Desktop.</p>
    </Section>
  );
}

// One agent: logo, name, its state, and (until it's connected) how to set it up.
function AgentRow({ name, state, detail, children }) {
  const [open, setOpen] = useState(false);
  const tone = state === 'connected' ? 'on' : state === 'stale' ? 'warn' : 'off';
  const label = state === 'connected' ? 'Connected' : state === 'stale' ? 'Points elsewhere' : 'Not set up';
  return (
    <div class="ag-row">
      <div class="ag-row-head">
        <BrandIcon name="claude" title="Claude" />
        <span class="ag-row-name"><b>{name}</b><span class="small muted">{detail}</span></span>
        <span class={`cx-pill ${tone}`}><span class={`dot${tone === 'on' ? ' on' : ''}`} />{label}</span>
        {children && <button class="btn ghost" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : state === 'connected' ? 'Show setup' : 'Set up'}</button>}
      </div>
      {open && children && <div class="ag-row-body">{children}</div>}
    </div>
  );
}

function LocalMcp() {
  const setup = useAsync(() => api.get('/mcp/setup'), []);
  if (setup.error) return <ErrorState error={setup.error} onRetry={setup.reload} />;
  if (!setup.data) return <Loading height={320} />;
  const { clients = {}, ...s } = setup.data;
  const code = clients.claudeCode;
  const desktop = clients.claudeDesktop;
  const connected = [code, desktop].filter((c) => c?.state === 'connected').length;
  const stale = [code, desktop].some((c) => c?.state === 'stale');
  const detail = (c, fallback) => (c?.state === 'connected' ? `Server “${c.name}”. Restart open sessions if the tools don’t show.`
    : c?.state === 'stale' ? `“${c.name}” points at another copy of Kauzl. Run the setup again.` : fallback);

  return (
    <>
      <ConnectionHero brand="claude" name="Claude Code & Claude Desktop" tagline={AGENT_TAGLINE}
        status={{ on: connected > 0, warn: stale, text: connected ? `Connected in ${connected} of 2 apps` : 'No agent set up yet' }} />

      <Section title="Your agents" actions={<button class="btn ghost" type="button" onClick={setup.reload}><Icon name="refresh" size={13} /> Check again</button>}>
        <div class="ag-rows">
          <AgentRow name="Claude Code" state={code?.state} detail={detail(code, 'Run one command in a terminal.')}>
            <p class="small m-0">Run this once in a terminal, then check it with <code>claude mcp list</code>.</p>
            <Snippet label="Terminal" text={claudeCodeCommand(s)} />
          </AgentRow>
          <AgentRow name="Claude Desktop" state={desktop?.state} detail={detail(desktop, 'Optional. Add a few lines to its config file.')}>
            <p class="small m-0">Add this to <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (merge it into any existing <code>mcpServers</code>), then restart Claude Desktop.</p>
            <Snippet label="claude_desktop_config.json" text={claudeDesktopConfig(s)} />
          </AgentRow>
        </div>
      </Section>

      <Section title="Good to know">
        <Facts items={[
          { label: 'Runs', value: 'Your agent starts Kauzl’s server itself when it needs it. Nothing to keep running here.' },
          { label: 'Needs Kauzl open', value: <>For the analytics tools (<code>daily_metrics</code>, <code>breakdown</code>, <code>day_story</code>, <code>events</code>). <code>schema</code> and <code>query</code> read the local databases and work without it.</> },
          { label: 'Private', value: 'Tokens and settings in studio.json are never exposed to Claude.' },
          { label: 'Moved the app?', value: 'The setup points at this install. Copy the command again after moving it.' },
        ]} />
      </Section>
    </>
  );
}

// Hosted: Claude reaches https://<host>/mcp with a personal access token.
function HostedMcp() {
  const list = useAsync(() => api.get('/mcp/tokens'), []);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(null);
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading height={240} />;
  const { url, tokens, days: lengths = [30, 90, 365, 0], defaultDays = 90 } = list.data;
  const lasts = days ?? defaultDays;
  const live = tokens.filter((t) => !t.expired);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMade(await api.post('/mcp/tokens', { label: label.trim() || 'Claude Code', days: lasts }));
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
  const day = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <>
      <ConnectionHero brand="claude" name="Claude Code & Claude Desktop" tagline={AGENT_TAGLINE}
        status={{ on: live.length > 0, text: live.length ? `${live.length} access ${live.length === 1 ? 'token' : 'tokens'}` : 'No access token yet' }} />

      {!live.length && !made && (
        <Section title="Set up">
          <Steps items={[
            { title: 'Create an access token below', body: 'One per computer or agent, so you can revoke one without the others.' },
            { title: 'Run the command it gives you', body: 'In a terminal for Claude Code, or in Claude Desktop’s config file.' },
            { title: 'Ask Claude about your sites', body: 'Try “Why did traffic drop last Tuesday?”' },
          ]} />
        </Section>
      )}

      <Section title="New access token">
        <form class="cx-key-form" onSubmit={create}>
          <div class="settings-grid">
            <label class="field m-0">Name
              <input placeholder="MacBook Claude Code" value={label} onInput={(e) => setLabel(e.currentTarget.value)} maxLength={60} />
            </label>
            <label class="field m-0">Lasts
              <select value={lasts} onChange={(e) => setDays(Number(e.currentTarget.value))}>
                {lengths.map((d) => <option key={d} value={d}>{d ? (d === 365 ? '1 year' : `${d} days`) : 'Never expires'}</option>)}
              </select>
            </label>
          </div>
          <div class="row"><button class="btn primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create access token'}</button></div>
          {error && <ErrorState error={error} />}
        </form>
      </Section>

      {made && (
        <Section title="Connect with your new token" sub={`Shown once${made.expiresAt ? `, good until ${day(made.expiresAt)}` : ''}. Copy one of these now.`}>
          <div class="ag-rows">
            <AgentRow name="Claude Code" state="missing" detail="Run once in a terminal, then check with claude mcp list.">
              <Snippet label="Terminal" text={code} />
            </AgentRow>
            <AgentRow name="Claude Desktop" state="missing" detail="Optional. Needs Node.js.">
              <p class="small m-0">Add to <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>, merged into any existing <code>mcpServers</code>, then restart Claude Desktop.</p>
              <Snippet label="claude_desktop_config.json" text={desktop} />
            </AgentRow>
          </div>
        </Section>
      )}

      {tokens.length > 0 && (
        <Section title="Access tokens">
          <div class="cx-list">
            {tokens.map((t) => (
              <div key={t.id} class="cx-list-row">
                <span class="cx-list-name">
                  <b>{t.label}</b>
                  <span class="small muted">
                    Created {day(t.createdAt)} · {t.lastUsed ? `last used ${new Date(t.lastUsed).toLocaleString()}` : 'never used'} · {t.expired
                      ? <span class="text-bad">expired {day(t.expiresAt)}</span>
                      : t.expiresAt ? `expires ${day(t.expiresAt)}` : 'never expires'}
                  </span>
                </span>
                <button class="btn ghost danger" type="button" onClick={() => revoke(t.id)}>Revoke</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Good to know">
        <Facts items={[
          { label: 'Stored', value: 'Kauzl keeps only a fingerprint of each token, never the token itself.' },
          { label: 'Treat it like a password', value: 'Anyone with a token can read your Kauzl data.' },
          { label: 'When one expires', value: 'Claude says “access token required”. Make a new one and run its command again.' },
        ]} />
      </Section>
    </>
  );
}
