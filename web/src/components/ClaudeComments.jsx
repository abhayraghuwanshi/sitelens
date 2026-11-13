import { useState } from 'preact/hooks';
import { formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card } from './ui.jsx';
import { Icon } from './icons.jsx';

// Plain text from Claude (or light Markdown from Claude Code): blank lines split
// paragraphs, "- " / "1. " lines become lists, "#" lines and lines ending in ":"
// before a list read as headings, **bold** is kept.
const BULLET = /^\s*[-•*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

function Inline({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <b key={i}>{part.slice(2, -2)}</b>;
    if (/^`[^`]+`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function parseBlocks(text) {
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
    para = [];
  };
  for (const raw of String(text || '').trim().split('\n')) {
    const line = raw.trimEnd();
    const list = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null;
    if (!line.trim()) {
      flush();
    } else if (list) {
      flush();
      const item = line.replace(list === 'ul' ? BULLET : NUMBERED, '');
      const last = blocks.at(-1);
      if (last?.type === list) last.items.push(item);
      else blocks.push({ type: list, items: [item] });
    } else if (/^#{1,6}\s+/.test(line)) {
      flush();
      blocks.push({ type: 'h', text: line.replace(/^#{1,6}\s+/, '') });
    } else if (/^\s{2,}\S/.test(line) && ['ul', 'ol'].includes(blocks.at(-1)?.type) && !para.length) {
      blocks.at(-1).items.push(`${blocks.at(-1).items.pop()} ${line.trim()}`); // wrapped list item
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

export function CommentBody({ text }) {
  return (
    <div class="claude-body">
      {parseBlocks(text).map((b, i) => {
        if (b.type === 'ul' || b.type === 'ol') {
          const List = b.type;
          return <List key={i}>{b.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</List>;
        }
        if (b.type === 'h') return <p key={i} class="claude-h"><Inline text={b.text} /></p>;
        return <p key={i} class={/:$/.test(b.text) && !b.text.includes('\n') ? 'claude-h' : undefined}><Inline text={b.text} /></p>;
      })}
    </div>
  );
}

// Claude's comments for a site (or every site) over a range or one day, plus
// "Analyze with Claude" when there's a site and an API key.
// siteId: a site id, or '' / 'all' for every site (comments only, no analysis).
export function ClaudeComments({ siteId, from, to, date, onChange, title = 'Claude' }) {
  const lo = date || from;
  const hi = date || to;
  const single = siteId && siteId !== 'all';
  const comments = useAsync(() => (lo ? api.get(`/annotations${qs({ author: 'claude', from: lo, to: hi, scope: single ? `site:${siteId}` : '' })}`) : { annotations: [] }), [siteId, lo, hi]);
  const status = useAsync(() => api.get('/claude/status'), []);
  const mcp = useAsync(() => api.get('/mcp/setup').catch(() => null), []);
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const list = [...(comments.data?.annotations || [])].sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const hasKey = Boolean(status.data?.source);
  const inputId = `claude-q-${date ? 'day' : 'range'}`;
  const codeConnected = mcp.data?.clients?.claudeCode?.state === 'connected';
  // What to paste into Claude Code; it reads through the sitelens MCP tools and comments back here.
  const ask = `Use the sitelens MCP tools to look at ${single ? `site "${siteId}"` : 'each of my sites'} ${date ? `on ${date}` : `from ${from} to ${to}`}: what moved and why. Leave your analysis as a comment with add_comment.`;

  async function copyAsk() {
    try {
      await navigator.clipboard.writeText(ask);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard refused; the text is selectable */
    }
  }

  async function analyze(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const out = await api.post(`/sites/${siteId}/claude/analyze`, date ? { date, question } : { from, to, question });
      setQuestion('');
      setMsg({ ok: true, text: `Saved on ${formatDate(out.comment.date.replaceAll('-', ''))}. ${(out.usage.input + out.usage.output).toLocaleString()} tokens, ${out.turns} steps.` });
      comments.reload();
      onChange?.();
    } catch (err) {
      setMsg({ ok: false, text: err.hint ? `${err.message} ${err.hint}` : err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await api.del(`/annotations/${id}`);
      comments.reload();
      onChange?.();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  return (
    <Card title={title} sub={date ? 'Comments on this day' : 'Comments in this range'} class="claude-card">
      <div class="stack">
        {single && hasKey && (
          <form class="row gap-6" onSubmit={analyze}>
            <label class="sr-only" for={inputId}>Question for Claude (optional)</label>
            <input id={inputId} type="text" maxLength={500} value={question} disabled={busy} style={{ flex: '1', minWidth: '200px' }}
              placeholder={date ? 'Why did this day move? (optional)' : 'Anything specific? e.g. why did signups drop (optional)'}
              onInput={(e) => setQuestion(e.currentTarget.value)} />
            <button class="btn primary" type="submit" disabled={busy}>
              <Icon name="sparkles" size={13} /> {busy ? 'Reading the data…' : date ? 'Analyze this day' : 'Analyze with Claude'}
            </button>
          </form>
        )}
        {busy && <p class="note m-0">Claude is reading your numbers through the same tools Claude Code uses. This usually takes 20–60 seconds.</p>}
        {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}

        {list.map((c) => (
          <article key={c.id} class="claude-comment">
            <header>
              <span class="claude-mark" aria-hidden="true"><Icon name="sparkles" size={12} /></span>
              <b>{c.label}</b>
              <button type="button" class="btn ghost" aria-label={`Delete comment ${c.label}`} onClick={() => remove(c.id)}
                style={{ marginLeft: 'auto', padding: '0 6px', minHeight: '0' }}>×</button>
            </header>
            <div class="claude-meta">
              {formatDate(c.date.replaceAll('-', ''))} · {c.via === 'app' ? 'Analyze with Claude' : 'from Claude Code'}{!c.scope && ' · all sites'}
            </div>
            {c.body && <CommentBody text={c.body} />}
          </article>
        ))}

        {comments.data && !list.length && (
          <p class="muted small m-0">
            No comments from Claude {date ? 'on this day' : 'in this range'} yet.
            {!single && hasKey && ' Pick one site to analyze it here.'}
          </p>
        )}
        {status.data && !hasKey && mcp.data && (codeConnected ? (
          <div class="stack gap-6">
            <p class="small m-0">Claude Code is connected. Ask it in any session and its comment shows up here:</p>
            <div class="snippet">
              <div class="snippet-head">
                <span>Claude Code</span>
                <button class="btn ghost" type="button" onClick={copyAsk}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{ask}</pre>
            </div>
            <p class="muted small m-0">
              To analyze with a button here instead, add an Anthropic API key in <a href="#/settings?i=anthropic">Settings → Claude</a> (roughly $0.10–0.40 a run).
            </p>
          </div>
        ) : (
          <p class="note m-0">
            To analyze here, add an Anthropic API key in <a href="#/settings?i=anthropic">Settings → Claude</a> (each run costs roughly $0.10–0.40).
            Or <a href="#/settings?i=mcp">connect Claude Code</a>; it can leave comments here through the SiteLens MCP server.
          </p>
        ))}
      </div>
    </Card>
  );
}
